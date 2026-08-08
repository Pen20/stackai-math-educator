import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

const errorRecordValidator = v.object({
  studentId: v.string(),
  question: v.string(),
  seedId: v.string(),
  response: v.string(),
  rightAnswer: v.string(),
  grade: v.float64(),
  errorCategory: v.array(v.string()),
  errorSummary: v.string(),
  llmResponse: v.string(),
  createdBy: v.optional(v.string()),
  firstName: v.optional(v.string()),
  surname: v.optional(v.string()),
  email: v.optional(v.string()),
});

export const getErrors = query({
  handler: async (ctx) => {
    return await ctx.db.query("studentErrors").collect();
  },
});

export const getVisibleErrors = query({
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    
    // 1. Always get the "System" default data
    const defaultData = await ctx.db
      .query("studentErrors")
      .withIndex("by_createdBy", (q) => q.eq("createdBy", "system"))
      .collect();

    if (!identity) return defaultData;

    // 2. Get the user's private uploads
    const userData = await ctx.db
      .query("studentErrors")
      .withIndex("by_createdBy", (q) => q.eq("createdBy", identity.subject))
      .collect();

    // If the user has uploaded their own data, show that instead of the default
    return userData.length > 0 ? userData : defaultData;
  },
});

export const seedStudentErrors = mutation({
  args: {
    errors: v.array(errorRecordValidator),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    const userId = identity ? identity.subject : "system";

    for (const error of args.errors) {
      await ctx.db.insert("studentErrors", {
        ...error,
        createdBy: error.createdBy || userId, // Prefer passed value, fallback to auth/system
      });
    }
  },
});

// Replaces the authenticated educator's active dataset in one transaction so
// repeated uploads cannot mix cohorts or create duplicate student-question rows.
export const replaceStudentErrors = mutation({
  args: { errors: v.array(errorRecordValidator) },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Authentication is required to replace a dataset.");

    const seen = new Set<string>();
    for (const error of args.errors) {
      if (!Number.isFinite(error.grade) || error.grade < 0 || error.grade >= 1) {
        throw new Error(`Invalid grade for student ${error.studentId}, ${error.question}. Expected 0 <= grade < 1.`);
      }
      const key = `${error.studentId}\u0000${error.question}`;
      if (seen.has(key)) {
        throw new Error(`Duplicate student-question record: ${error.studentId}, ${error.question}.`);
      }
      seen.add(key);
    }

    const existing = await ctx.db
      .query("studentErrors")
      .withIndex("by_createdBy", (q) => q.eq("createdBy", identity.subject))
      .collect();
    for (const record of existing) await ctx.db.delete(record._id);
    const oldSettings = await ctx.db
      .query("assessmentSettings")
      .withIndex("by_userId", (q) => q.eq("userId", identity.subject))
      .collect();
    for (const settings of oldSettings) await ctx.db.delete(settings._id);
    for (const error of args.errors) {
      await ctx.db.insert("studentErrors", { ...error, createdBy: identity.subject });
    }
    return { removed: existing.length, inserted: args.errors.length };
  },
});

export const getByStudentAndQuestion = query({
  args: {
    studentId: v.string(),
    question: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("studentErrors")
      .filter(q =>
        q.and(
          q.eq(q.field("studentId"), args.studentId),
          q.eq(q.field("question"), args.question)
        )
      )
      .collect();
  },
});

import { internalQuery } from "./_generated/server";

export const getAllErrors = internalQuery({
  handler: async (ctx) => {
    return await ctx.db.query("studentErrors").collect();
  },
});
