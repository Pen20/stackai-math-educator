"use node";

import { action } from "../_generated/server";
import { v } from "convex/values";
import { api } from "../_generated/api";
import OpenAI from "openai";

const MAX_HISTORY_MESSAGES = 12;
const MAX_CONTEXT_CHARS = 100_000;

export const chat = action({
  args: {
    question: v.string(),
    chatHistory: v.optional(v.array(v.object({
      role: v.union(v.literal("user"), v.literal("assistant")),
      content: v.string(),
    }))),
  },
  handler: async (ctx, args): Promise<string> => {
    const docs = (await ctx.runQuery(api.rag.simple.searchDocuments, {
      query: args.question
    })) as any[];

    const context = docs.length > 0
      ? docs.map((d: any) => `File: ${d.name}\nContent: ${d.text}`).join("\n\n---\n\n")
      : "No relevant documents found.";

    const safeContext = context.length > MAX_CONTEXT_CHARS
      ? context.slice(0, MAX_CONTEXT_CHARS) + "\n\n[Context truncated due to length]"
      : context;

    const systemPrompt = `You are a helpful assistant. Answer questions based on the documents provided below.
If the answer cannot be found in the documents, say so clearly rather than guessing.

Context:
${safeContext}`;

    // Keep only the most recent messages to stay within token limits
    const recentHistory = (args.chatHistory || []).slice(-MAX_HISTORY_MESSAGES);

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error("OpenAI API key is not configured.");

    const openaiClient = new OpenAI({ apiKey });

    try {
      const response = await openaiClient.chat.completions.create({
        model: "gpt-4o",
        messages: [
          { role: "system", content: systemPrompt },
          ...recentHistory.map(m => ({ role: m.role, content: m.content })),
          { role: "user", content: args.question },
        ],
        temperature: 0.3,
      });

      return response.choices[0].message.content || "No response generated.";
    } catch (error: any) {
      const message = error?.message ?? "Unknown error";
      throw new Error(`Failed to get a response from the AI: ${message}`);
    }
  },
});
