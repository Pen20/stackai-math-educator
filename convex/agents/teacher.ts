import { Agent, createTool } from "@convex-dev/agent";
import { openai } from "@ai-sdk/openai";
import { v } from "convex/values";
import { api, internal, components } from "../_generated/api";
import { z } from "zod";
import { ActionCtx } from "../_generated/server";

export const teacherAssistant: any = new Agent(components.agent as any, {
  name: "teacherAssistant",
  languageModel: openai("gpt-4o") as any, // Use the provider function directly
  instructions: `You are an expert educational AI assistant specializing in Mathematics and Error Analysis. 
  Your primary role is to analyze student performance data using RAG techniques to:
  1. Identify students at higher risk of failure or consistent struggle.
  2. Detect common mistakes students make on specific questions.
  3. Categorize student errors according to Newman's Error Analysis framework (Reading, Comprehension, Transformation, Process Skills, Encoding).
  
  Use the provided tools to search for error patterns, retrieve student reports, and classify misconceptions. Provide actionable pedagogical insights.`,
  tools: {
    // Tool 1: Semantic Search via RAG
    searchSimilarPatterns: createTool({
      description: "Search for similar mathematical error patterns and pedagogical summaries.",
      args: z.object({ query: z.string() }),
      handler: async (ctx: ActionCtx, { query }) => {
        // Use native RAG search
        const results = await ctx.runAction((internal as any).rag.native.searchAction, { 
          query,
          limit: 5 
        });
        
        // Format results from the `documents` table
        return results.map((r: any) => r.text).join("\n\n");
      },
    }),
    // Tool 2: Analytical Aggregation
    getStudentReport: createTool({
      description: "Calculate the average grade and common error categories for a specific student.",
      args: z.object({ studentId: z.string() }),
      handler: async (ctx: ActionCtx, { studentId }) => {
        const result: any = await ctx.runQuery(api.analysis.getStudentHistory, { studentId });
        return JSON.stringify(result);
      },
    }),
  },
  maxSteps: 10,
});
