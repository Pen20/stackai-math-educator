import { internalMutation } from "../_generated/server";
import { v } from "convex/values";

export const recordContextUsed = internalMutation({
  args: {
    messageId: v.string(),
    entries: v.any(),
    results: v.any(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("contextUsed", {
      messageId: args.messageId,
      entries: args.entries,
      results: args.results,
    });
  },
});
