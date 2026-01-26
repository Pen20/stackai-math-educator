import { createAgent, createTool } from "@convex-dev/agent";
import { openai } from "@ai-sdk/openai";
import { v } from "convex/values";
import { components, api } from "./_generated/api";
import { z } from "zod";
import { RAG } from "@convex-dev/rag";
import { ActionCtx } from "./_generated/server";
import { textEmbeddingModel } from "./modelsForDemo";

const rag = new RAG(components.rag, {
  textEmbeddingModel,
  embeddingDimension: 1536,
});

export const teacherAssistant = createAgent({
  model: openai("gpt-4o"), // Use the provider function directly
  instructions: \`You are a world-class, patient, and expert university-level Mathematics tutor specializing in Linear Algebra and Differential Calculus. Your primary goal is to foster deep understanding, not just provide answers.\`,
  tools: {
    // Tool 1: Semantic Search via RAG
    searchSimilarPatterns: createTool({
      description: "Search for similar mathematical error patterns and pedagogical summaries.",
      args: z.object({ query: z.string() }),
      handler: async (ctx: ActionCtx, { query }) => {
        const results = await rag.search(ctx, { namespace: "student-misconceptions", query });
        return results.results.map(r => r.content.map(c => c.text).join(" ")).join("\\n");
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