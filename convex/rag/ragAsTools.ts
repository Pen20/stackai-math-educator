import { createTool } from "@convex-dev/agent";
import { v } from "convex/values";
import { z } from "zod";
import { api, internal } from "../_generated/api";
import { action } from "../_generated/server";
import { teacherAssistant } from "../agents/teacher";

// FIX: Removed the backslash before the backticks
const NEWMAN_STAGES_GUIDE = `
1. Reading: decoding the problem's text and symbols.
2. Comprehension: understanding the meaning of the problem.
3. Transformation: selecting the appropriate mathematical strategy/formula.
4. Process Skills: performing the calculation steps.
5. Encoding: formulating and expressing the final answer.
`;

export const sendMessage = action({
  args: { threadId: v.string(), prompt: v.string() },
  handler: async (ctx, { threadId, prompt }) => {
    
    await teacherAssistant.generateText(
      ctx,
      { threadId },
      {
        prompt,
        tools: {
          // TOOL 1: Semantic Search for Patterns
          searchSimilarPatterns: createTool({
            description: "Search for similar student math errors and misconceptions in the pedagogy database.",
            args: z.object({
              query: z.string().describe("The error description or mathematical concept to search for."),
            }),
            handler: async (ctx, args) => {
              const results = await ctx.runAction((internal as any).rag.native.searchAction, {
                query: args.query,
                limit: 3,
              });
              
              // FIX: Removed backslashes from the mapping template
              const contextText = results
                .map((r: any) => `Content: ${r.text}`)
                .join("\n---\n");
                
              return `Found similar past errors:\n${contextText}`;
            },
          }),

          // TOOL 2: Class Analytics
          getClassAnalytics: createTool({
            description: "Get a list of at-risk students and general class performance indices.",
            args: z.object({
              threshold: z.number().optional().describe("The grade threshold to define at-risk (default 0.5)"),
            }),
            handler: async (ctx, args) => {
              const atRisk = await ctx.runQuery(api.analysis.getAtRiskStudents, {
                threshold: args.threshold ?? 0.5,
              });
              
              return JSON.stringify({
                summary: `Found ${atRisk.length} at-risk students.`,
                students: atRisk,
              });
            },
          }),

          // TOOL 3: Newman Diagnostic Framework
          newmanDiagnostic: createTool({
            description: "Analyze an error using the 5 Newman stages. Returns the framework guide and similar classified examples.",
            args: z.object({
              errorDescription: z.string().describe("The student's error or response to analyze."),
            }),
            handler: async (ctx, args) => {
              const similarErrors = await ctx.runAction((internal as any).rag.native.searchAction, {
                query: args.errorDescription,
                limit: 3,
              });
              
              const examples = similarErrors
                .map((r: any) => `Example: ${r.text}`)
                .join("\n");

              // FIX: Removed backslashes from the multi-line return string
              return `
# Newman's Error Analysis Framework
${NEWMAN_STAGES_GUIDE}

# Similar Examples from Database
${examples}

Instructions: Compare the input error to the examples and classifications above. Determine which Newman stage the error likely falls into.
`;
            },
          }),
        },
      },
    );
  },
});