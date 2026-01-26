import { Agent } from "@convex-dev/agent";
import { components } from "../_generated/api";
import { openai } from "@ai-sdk/openai";

export const agent = new Agent(components.agent, {
  name: "simple",
  languageModel: openai("gpt-4o") as any,
});
