"use node";

import { action } from "./_generated/server";
import { v } from "convex/values";
import OpenAI from "openai";

const SYSTEM_PROMPT = `You are an expert educational assistant specializing in diagnosing student learning patterns using Newman’s Error Analysis (NEA).

Objectives:
1. Interpret student misconceptions.
2. Provide evidence-based explanations.
3. Always recall the student's response and the correct answer using backticks: \`student_answer\` and \`correct_answer\`.

Newman’s Error Stages:
- Reading: Misinterpreting symbols/text.
- Comprehension: Failure to grasp meaning.
- Transformation: Chose wrong math operation.
- Process Skills: Calculation error.
- Encoding: Incorrect final format.

DOMAIN LOGIC:
- Our dataset primarily records student ERRORS and struggles.
- If data for a specific student and question is MISSING, it means the student answered CORRECTLY.`;

type ChatMsg = { role: "user" | "assistant"; content: string };

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export const chat = action({
  args: {
    question: v.string(),
    context: v.optional(v.string()),
    // Better: pass structured history from the client
    chatHistory: v.optional(
      v.array(
        v.object({
          role: v.union(v.literal("user"), v.literal("assistant")),
          content: v.string(),
        })
      )
    ),
  },
  handler: async (_ctx, args) => {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error(
        "OPENAI_API_KEY is not set in the Convex environment. Add it in the Convex dashboard settings."
      );
    }

    const context = args.context ?? "No additional context provided.";
    const history: ChatMsg[] = args.chatHistory ?? [];

    // Keep history small (prevents token blowups)
    const trimmedHistory = history.slice(-12);

    const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "system", content: `Context:\n${context}` },
      ...trimmedHistory.map((m) => ({ role: m.role, content: m.content })),
      { role: "user", content: args.question },
    ];

    try {
      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages,
        temperature: 0.2,
      });

      const content = response.choices?.[0]?.message?.content;
      return content?.trim() || "I couldn't generate a response.";
    } catch (error: any) {
      console.error("OpenAI Error:", error);
      throw new Error(`Chat failed: ${error?.message || "Unknown error"}`);
    }
  },
});