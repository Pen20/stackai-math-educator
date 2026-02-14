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
- Reading: A reading error occurs when a student is unable to accurately
decode the text, symbols, or mathematical notation used in the
problem. This includes misreading words, numbers, symbols, or
formal mathematical language, leading to an incorrect initial
interpretation of the problem statement.
- Comprehension: A comprehension error arises when a student can read the problem
correctly but fails to understand its meaning, intent, or
underlying mathematical relationships. At this stage, the
student is unable to clearly articulate what the problem is
asking or distinguish between given information and required
outcomes.
- Transformation: A transformation error occurs when a student understands the
problem contextually but is unable to correctly translate it
into an appropriate mathematical representation or strategy.
This includes failure to identify relevant components, select
suitable variables, or choose the correct mathematical
operations or methods.
- Process Skills: A process skills error is evident when a student selects an
appropriate mathematical strategy but makes errors during
execution. These errors may involve incorrect calculations,
flawed algebraic manipulation, procedural mistakes, or logical
inconsistencies within the solution process.
- Encoding: An encoding error occurs when a student arrives at a correct or
near-correct solution but fails to express the final answer
accurately or appropriately. This may include incorrect
notation, missing units, incomplete conclusions, or failure to
clearly state the final result in relation to the original
problem.

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