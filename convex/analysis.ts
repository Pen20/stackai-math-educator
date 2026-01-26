import { query } from "./_generated/server";
import { v } from "convex/values";

export const getStudentHistory = query({
  args: { studentId: v.string() },
  handler: async (ctx, args) => {
    const studentData = await ctx.db
      .query("studentErrors")
      .withIndex("by_studentId", (q) => q.eq("studentId", args.studentId))
      .collect();
    
    // Safety check for empty data
    if (studentData.length === 0) return { avgGrade: 0, count: 0, recentErrors: [] };

    const avgGrade = studentData.reduce((acc, r) => acc + r.grade, 0) / studentData.length;
    return { avgGrade, count: studentData.length, recentErrors: studentData.slice(-3) };
  },
});

/**
 * Diagnostic Query: Identifies students with an average grade below a threshold.
 * This can be called directly by the UI or used as a reference for an Agent Tool.
 */
export const getAtRiskStudents = query({
  args: {
    threshold: v.optional(v.float64()),
  },
  handler: async (ctx, args) => {
    const minGrade = args.threshold ?? 0.5;
    const errors = await ctx.db.query("studentErrors").collect();

    // Group errors by studentId to calculate performance metrics
    const studentPerformance = new Map<string, { totalGrade: number; count: number; categories: string[] }>();

    for (const error of errors) {
      if (!studentPerformance.has(error.studentId)) {
        studentPerformance.set(error.studentId, { totalGrade: 0, count: 0, categories: [] });
      }
      const data = studentPerformance.get(error.studentId)!;
      data.totalGrade += error.grade;
      data.count += 1;
      if (error.errorCategory) {
        data.categories.push(...error.errorCategory);
      }
    }

    const atRiskStudents = [];
    for (const [studentId, data] of studentPerformance.entries()) {
      const average = data.totalGrade / data.count;
      if (average < minGrade) {
        atRiskStudents.push({
          studentId: `Student #${studentId}`,
          averageGrade: average.toFixed(2),
          errorCount: data.count,
          primaryMisconceptions: [...new Set(data.categories)],
        });
      }
    }

    return atRiskStudents.sort((a, b) => parseFloat(a.averageGrade) - parseFloat(b.averageGrade));
  },
});

/**
 * Pedagogical Analysis: Renamed to match the expected 'getQuestionIndices' call.
 */
export const getQuestionIndices = query({
  handler: async (ctx) => {
    const records = await ctx.db.query("studentErrors").collect();
    if (records.length === 0) return [];

    // 1. Calculate overall student averages to identify Top/Bottom groups
    const studentStats = new Map<string, { total: number; count: number }>();
    records.forEach((r) => {
      const current = studentStats.get(r.studentId) || { total: 0, count: 0 };
      studentStats.set(r.studentId, { 
        total: current.total + r.grade, 
        count: current.count + 1 
      });
    });

    const sortedStudents = Array.from(studentStats.entries())
      .map(([id, stats]) => ({ id, avg: stats.total / stats.count }))
      .sort((a, b) => b.avg - a.avg);

    const boundary = Math.max(1, Math.floor(sortedStudents.length * 0.27));
    const topGroup = new Set(sortedStudents.slice(0, boundary).map(s => s.id));
    const bottomGroup = new Set(sortedStudents.slice(-boundary).map(s => s.id));

    // 2. Generate indices per question
    const questions = [...new Set(records.map(r => r.question))];
    
    return questions.map((q) => {
      const qRecords = records.filter(r => r.question === q);
      const difficultyIndex = qRecords.reduce((acc, r) => acc + r.grade, 0) / qRecords.length;

      const topGrades = qRecords.filter(r => topGroup.has(r.studentId));
      const bottomGrades = qRecords.filter(r => bottomGroup.has(r.studentId));
      
      const meanTop = topGrades.length > 0 ? topGrades.reduce((a, b) => a + b.grade, 0) / topGrades.length : 0;
      const meanBottom = bottomGrades.length > 0 ? bottomGrades.reduce((a, b) => a + b.grade, 0) / bottomGrades.length : 0;

      return {
        question: q,
        difficultyIndex: difficultyIndex.toFixed(2),
        discriminationIndex: (meanTop - meanBottom).toFixed(2),
        sampleSize: qRecords.length
      };
    });
  },
});