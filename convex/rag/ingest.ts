"use node";

import { action } from "../_generated/server";
import { internal, components } from "../_generated/api";
import { RAG } from "@convex-dev/rag";
import { openai } from "@ai-sdk/openai";

const rag = new RAG(components.rag, {
  textEmbeddingModel: openai.embedding("text-embedding-3-small") as any,
  embeddingDimension: 1536,
});

export const ingestFromDatabase = action({
  handler: async (ctx) => {
    // 1. Fetch data from Convex (V8 runtime)
    // We use the internal query 'getAllErrors' we defined earlier, 
    // or 'getErrors' if we change it to internal. 
    // The user snippet says 'internal.studentErrors.getErrors'. 
    // We'll stick to 'getAllErrors' if that's what we have, or alias it.
    // Let's check studentErrors.ts content. 
    // We have getAllErrors as internalQuery. We will use that to match the intent.
    const errors = await ctx.runQuery(internal.studentErrors.getAllErrors);
    
    let count = 0;
    for (const error of errors) {
      if (!error.question || !error.response) continue;

      // 2. Build a searchable text representation
      const text = `Question: ${error.question} | Response: ${error.response} | Summary: ${error.errorSummary}`;
      
      // 3. Add to RAG vector store
      await rag.add(ctx, {
        namespace: "student-misconceptions",
        text,
        metadata: { studentId: error.studentId, category: error.errorCategory },
      });
      count++;
    }
    return `Ingested ${count} records.`;
  },
});
