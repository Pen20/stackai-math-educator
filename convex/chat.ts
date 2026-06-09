import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const getMessages = query({
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    return await ctx.db
      .query("chat_messages")
      .withIndex("by_userId", (q) => q.eq("userId", identity.subject))
      .order("asc")
      .collect();
  },
});

export const saveMessage = mutation({
  args: {
    role: v.union(v.literal("user"), v.literal("assistant")),
    content: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return;

    await ctx.db.insert("chat_messages", {
      userId: identity.subject,
      role: args.role,
      content: args.content,
      createdAt: Date.now(),
    });
  },
});

export const clearHistory = mutation({
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return;

    const messages = await ctx.db
      .query("chat_messages")
      .withIndex("by_userId", (q) => q.eq("userId", identity.subject))
      .collect();

    await Promise.all(messages.map((m) => ctx.db.delete(m._id)));
  },
});
