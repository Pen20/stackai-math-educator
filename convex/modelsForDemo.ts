import { openai } from "@ai-sdk/openai";

export const textEmbeddingModel = openai.embedding("text-embedding-3-small");
