import { internalQuery } from "../_generated/server";
import { v } from "convex/values";

export const searchQuery = internalQuery({
  args: {
    embedding: v.array(v.float64()),
    limit: v.number(),
  },
  handler: async (ctx, args): Promise<any[]> => {
    return await ctx.db
      .query("documents" as any)
      .withSearchIndex("by_embedding", (q) =>
        q.search("embedding", args.embedding as any)
      )
      .take(args.limit);
  },
});
