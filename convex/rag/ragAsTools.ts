import { createTool } from "@convex-dev/agent";
import { v } from "convex/values";
import { z } from "zod"; // Using zod (v3 is compatible, usually imports from "zod")
import { components, api } from "../_generated/api";
import { action } from "../_generated/server";
import { agent } from "../agents/simple";
import { RAG } from "@convex-dev/rag";
import { textEmbeddingModel } from "../modelsForDemo";

const rag = new RAG(components.rag, {
  textEmbeddingModel: textEmbeddingModel as any,
  embeddingDimension: 1536,
});

const NEWMAN_STAGES_GUIDE = \`
1. Reading: decoding the problem's text and symbols.
2. Comprehension: understanding the meaning of the problem.
3. Transformation: selecting the appropriate mathematical strategy/formula.
4. Process Skills: performing the calculation steps.
5. Encoding: formulating and expressing the final answer.
\`;

export const sendMessage = action({
  args: { threadId: v.string(), prompt: v.string() },
  handler: async (ctx, { threadId, prompt }) => {
    
    await agent.generateText(
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
              const results = await rag.search(ctx, {
                namespace: "student-misconceptions-csv",
                query: args.query,
                limit: 3,
              });
              
              const contextText = results.results
                .map((r) => \`Content: \${r.content[0]?.text}\`)
                .join("\\n---\\n");
                
              return \`Found similar past errors:\\n\${contextText}\`;
            },
          }),

          // TOOL 2: Class Analytics
          getClassAnalytics: createTool({
            description: "Get a list of at-risk students and general class performance indices.",
            args: z.object({
              threshold: z.number().optional().describe("The grade threshold to define at-risk (default 0.5)"),
            }),
            handler: async (ctx, args) => {
              // Call the existing at-risk students query
              const atRisk = await ctx.runQuery(api.analysis.getAtRiskStudents, {
                threshold: args.threshold ?? 0.5,
              });
              // Optionally call getQuestionIndices if needed for "general indices"
              // For now, we return the at-risk list and a summary.
              
              return JSON.stringify({
                summary: \`Found \${atRisk.length} at-risk students.\`,
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
              // 1. Search for examples of this specific error
              const similarErrors = await rag.search(ctx, {
                namespace: "student-misconceptions-csv",
                query: args.errorDescription,
                limit: 3,
              });
              
              const examples = similarErrors.results
                .map(r => \`Example: \${r.content[0]?.text}\`)
                .join("\\n");

              // 2. Return the Framework + Examples so the Agent can classify the current error
              return \`
# Newman's Error Analysis Framework
\${NEWMAN_STAGES_GUIDE}

# Similar Examples from Database
\${examples}

Instructions: Compare the input error to the examples and classifications above. Determine which Newman stage the error likely falls into.
\`;
            },
          }),
        },
      },
    );
  },
});
