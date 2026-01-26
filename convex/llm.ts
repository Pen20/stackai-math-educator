"use node";

import { action } from "./_generated/server";
import { v } from "convex/values";
import { openai } from "@ai-sdk/openai";
import { generateText } from "ai";

/**
 * Updated SYSTEM_PROMPT: 
 * We keep the core pedagogical logic here but rely on the Agent 
 * for complex tool-use and thread history.
 */
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
- Encoding: Incorrect final format.`;

export const chat = action({
  args: {
    question: v.string(),
    context: v.optional(v.string()),
    chatHistory: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // 1. Setup the prompt with provided context
    const context = args.context || "No additional context provided.";
    const history = args.chatHistory || "";

    const userPrompt = `
      Context: ${context}
      History: ${history}
      User Question: ${args.question}
    `.trim();

    // 2. Use the AI SDK generateText wrapper
    // This replaces the manual OpenAI client setup for better type safety
    const { text } = await generateText({
      model: openai("gpt-4o") as any,
      system: SYSTEM_PROMPT,
      prompt: userPrompt,
      temperature: 0.2,
    });

    return text;
  },
});