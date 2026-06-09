import { mutation, query } from "../_generated/server";
import { v } from "convex/values";

export const ingest = mutation({
  args: {
    name: v.string(),
    text: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    const userId = identity ? identity.subject : "system";

    // Split text into overlapping word-boundary-aligned chunks for better search quality.
    // Raw byte slicing cuts words in half, which degrades full-text search recall.
    const CHUNK_SIZE = 1500;  // characters (~375 tokens)
    const OVERLAP    = 150;   // characters carried into next chunk for context continuity
    const chunks: string[] = [];
    let start = 0;

    while (start < args.text.length) {
      let end = start + CHUNK_SIZE;
      if (end >= args.text.length) {
        chunks.push(args.text.slice(start));
        break;
      }
      // Walk back to the nearest word boundary so we never cut mid-word
      const boundary = args.text.lastIndexOf(" ", end);
      end = boundary > start ? boundary : end;
      chunks.push(args.text.slice(start, end));
      start = end - OVERLAP;
    }

    const ids = [];
    for (const chunk of chunks) {
      const id = await ctx.db.insert("simple_documents", {
        name: args.name,
        text: chunk,
        createdBy: userId,
        createdAt: Date.now(),
      });
      ids.push(id);
    }
    return ids;
  },
});

export const searchDocuments = query({
  args: { 
    query: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    const userId = identity ? identity.subject : "system";

    return await ctx.db
      .query("simple_documents")
      .withSearchIndex("search_text", (q) => 
        q.search("text", args.query).eq("createdBy", userId)
      )
      .take(10); // Take top 10 relevant chunks
  },
});

export const listDocuments = query({
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    const userId = identity ? identity.subject : "system";

    const allChunks = await ctx.db
      .query("simple_documents")
      .withIndex("by_createdBy", (q) => q.eq("createdBy", userId))
      .collect();
    
    // Group chunks by name to show unique files in UI
    const uniqueDocs = new Map();
    for (const chunk of allChunks) {
      if (!uniqueDocs.has(chunk.name)) {
        uniqueDocs.set(chunk.name, {
          _id: chunk._id, // Use one ID for reference
          name: chunk.name,
          createdAt: chunk.createdAt,
          chunkCount: 1,
        });
      } else {
        uniqueDocs.get(chunk.name).chunkCount++;
      }
    }

    return Array.from(uniqueDocs.values()).sort((a, b) => b.createdAt - a.createdAt);
  },
});

export const deleteDocument = mutation({
  args: { name: v.string() }, // Delete by name to remove all chunks
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");
    
    const chunks = await ctx.db
      .query("simple_documents")
      .withIndex("by_createdBy", (q) => q.eq("createdBy", identity.subject))
      .filter(q => q.eq(q.field("name"), args.name))
      .collect();

    for (const chunk of chunks) {
      await ctx.db.delete(chunk._id);
    }
  },
});

