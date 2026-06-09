import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // Users table for session and identity management
  users: defineTable({
    clerkId: v.string(),
    email: v.string(),
    lastVisitedResource: v.optional(v.string()), 
    lastLoginAt: v.optional(v.number()),
  }).index("by_clerkId", ["clerkId"]),

  // Core dataset for student error analysis
  studentErrors: defineTable({
    studentId: v.string(),
    question: v.string(),
    seedId: v.string(),      
    response: v.string(),
    rightAnswer: v.string(),
    grade: v.float64(),
    errorCategory: v.array(v.string()), 
    errorSummary: v.string(),
    llmResponse: v.string(), 
    createdBy: v.string(), // "system" or User's Clerk ID
    firstName: v.optional(v.string()),
    surname: v.optional(v.string()),
    email: v.optional(v.string()),
    // Although RAG handles embeddings, keeping this allows for local vector operations
    embedding: v.optional(v.array(v.float64())),
  })
  .index("by_studentId", ["studentId"])
  .index("by_question", ["question"])
  .index("by_createdBy", ["createdBy"])
  .vectorIndex("by_embedding", {
    vectorField: "embedding",
    dimensions: 1536,
  }),

  // Integrated Messages table for the Agent Component
  // This replaces legacy message structures to support Agent Threads
  // messages: defineTable({
  //   userId: v.string(), // Clerk ID or anonymous ID
  //   role: v.union(v.literal("user"), v.literal("assistant"), v.literal("system"), v.literal("tool")),
  //   content: v.string(),
  //   threadId: v.optional(v.string()), // Links to the Agent Thread ID
  //   timestamp: v.number(),
  //   status: v.optional(v.string()), // e.g., "pending", "success", "failed"
  // })
  // .index("by_userId", ["userId"])
  // .index("by_threadId", ["threadId"]),

  // Feedback and contact data
  feedback: defineTable({
    name: v.optional(v.string()),
    email: v.optional(v.string()),
    message: v.string(),
    type: v.string(), // "contact" or "feedback"
    createdAt: v.number(),
  }),

  // Documents table for RAG chunks
  documents: defineTable({
    text: v.string(),
    metadata: v.any(),
    embedding: v.array(v.float64()),
  }).vectorIndex("by_embedding", {
    vectorField: "embedding",
    dimensions: 1536,
  }),

  // Simple RAG: Documents without embeddings
  simple_documents: defineTable({
    name: v.string(),
    text: v.string(),
    createdBy: v.string(), // Clerk ID or "system"
    createdAt: v.number(),
  })
  .index("by_createdBy", ["createdBy"])
  .searchIndex("search_text", {
    searchField: "text",
    filterFields: ["createdBy"],
  }),

  // Persisted chatbot conversation history per user
  chat_messages: defineTable({
    userId: v.string(),
    role: v.union(v.literal("user"), v.literal("assistant")),
    content: v.string(),
    createdAt: v.number(),
  }).index("by_userId", ["userId"]),

  // RAG Context Usage Logging
  contextUsed: defineTable({
    messageId: v.string(),
    entries: v.any(), // Flexible storage for RAG context entries
    results: v.any(), // Flexible storage for search results
  }).index("by_messageId", ["messageId"]),
});