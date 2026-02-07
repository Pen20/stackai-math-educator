"use node";

import { action } from "../_generated/server";
import { v } from "convex/values";
import { api } from "../_generated/api";
import OpenAI from "openai";

export const chat = action({
  args: {
    question: v.string(),
    chatHistory: v.optional(v.array(v.object({
      role: v.union(v.literal("user"), v.literal("assistant")),
      content: v.string(),
    }))),
  },
  // FIX: Explicitly define return type to solve TS inference loops
  handler: async (ctx, args): Promise<string> => {
    console.log("DIAGNOSTIC: Running simpleActions.ts VERSION_2024 (Direct OpenAI)");
    // FIX: Cast result to any[] to break the circular dependency
    const docs = (await ctx.runQuery(api.rag.simple.searchDocuments, { 
      query: args.question 
    })) as any[];
    
    const context = docs.length > 0 
      ? docs.map((d: any) => `File: ${d.name}\nContent: ${d.text}`).join("\n\n---\n\n")
      : "No documents found.";

    // CRITICAL: Truncate context to stay within OpenAI context window (128k tokens)
    // 100,000 chars is roughly 25k-30k tokens, which is safe.
    const safeContext = context.slice(0, 100000);

    const systemPrompt = `Use these documents to answer.
    
    IMPORTANT DOMAIN LOGIC:
    - Our dataset primarily records student ERRORS and struggles.
    - If a student/question record is MISSING from the context, it definitively means the student ANSWERED CORRECTLY and performed well.
    
    Context:\n${safeContext}`;

    const openaiClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const response = await openaiClient.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemPrompt },
        ...(args.chatHistory || []).map(m => ({ role: m.role, content: m.content })),
        { role: "user", content: args.question }
      ],
      temperature: 0.3,
    });

    return response.choices[0].message.content || "No response generated.";
  },
});