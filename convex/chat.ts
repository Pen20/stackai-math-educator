"use node";

import { action } from "./_generated/server";
import { v } from "convex/values";
import { teacherAssistant } from "./agents/teacher";

/**
 * Modern Chat Action
 * Manages threads and executes the NEA Specialist Bot.
 */
export const askAi = action({
  args: {
    prompt: v.string(),
    threadId: v.optional(v.string()), 
  },
  handler: async (ctx, args) => {
    // Correctly manage the thread lifecycle
    const { thread } = args.threadId 
      ? await teacherAssistant.continueThread(ctx, { threadId: args.threadId })
      : await teacherAssistant.createThread(ctx);

    // This method handles the internal AI SDK call correctly
    const result = await thread.generateText({ 
      prompt: args.prompt 
    });

    return {
      text: result.text,
      threadId: thread.threadId
    };
  },
});