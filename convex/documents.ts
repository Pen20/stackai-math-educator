import { internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";

export const insertDocument = internalMutation({
  args: {
    text: v.string(),
    embedding: v.array(v.float64()),
    metadata: v.any(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("documents", {
      text: args.text,
      embedding: args.embedding,
      metadata: args.metadata,
    });
  },
});

export const getDocuments = internalQuery({
  handler: async (ctx) => {
    return await ctx.db.query("documents").collect();
  },
});
