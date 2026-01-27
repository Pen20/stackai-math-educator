"use node";

import { action } from "../_generated/server";
import { v } from "convex/values";
import { internal } from "../_generated/api";
import { RecursiveCharacterTextSplitter } from "./lib/textSplitter";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// --- Helper: Embed ---
async function embed(text: string) {
  const response = await openai.embeddings.create({
    model: "text-embedding-3-small", 
    input: text,
    dimensions: 1536,
  });
  return response.data[0].embedding;
}

// --- Ingestion ---

export const ingest = action({
  args: {
    text: v.string(),
    metadata: v.any(),
  },
  handler: async (ctx, args) => {
    const splitter = new RecursiveCharacterTextSplitter({
      chunkSize: 1000,
      chunkOverlap: 200, 
    });
    
    const chunks = splitter.splitText(args.text);
    console.log(`Split into ${chunks.length} chunks.`);

    for (const chunk of chunks) {
      const embedding = await embed(chunk);
      await ctx.runMutation(internal.documents.insertDocument, {
        text: chunk,
        embedding,
        metadata: args.metadata,
      });
    }

    return chunks.length;
  },
});

// --- Retrieval ---

export const searchAction = action({
  args: {
    query: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args): Promise<any[]> => {
    const embedding = await embed(args.query);
    
    // Updated to point to the new queries file
    const results = await ctx.runQuery(internal.rag.queries.searchQuery, {
      embedding,
      limit: args.limit || 5,
    });
    
    return results;
  },
});
