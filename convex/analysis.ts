import { query } from "./_generated/server";
import { QueryCtx } from "./_generated/server";
import { v } from "convex/values";

async function getVisibleRecords(ctx: QueryCtx) {
  const defaultData = await ctx.db
    .query("studentErrors")
    .withIndex("by_createdBy", (q) => q.eq("createdBy", "system"))
    .collect();

  const identity = await ctx.auth.getUserIdentity();
  if (!identity) return defaultData;

  const userData = await ctx.db
    .query("studentErrors")
    .withIndex("by_createdBy", (q) => q.eq("createdBy", identity.subject))
    .collect();

  return userData.length > 0 ? userData : defaultData;
}

export const getStudentHistory = query({
  args: { studentId: v.string() },
  handler: async (ctx, args) => {
    const studentData = await ctx.db
      .query("studentErrors")
      .withIndex("by_studentId", (q) => q.eq("studentId", args.studentId))
      .collect();

    if (studentData.length === 0) return { avgGrade: 0, count: 0, recentErrors: [] };

    const avgGrade = studentData.reduce((acc, r) => acc + r.grade, 0) / studentData.length;
    return { avgGrade, count: studentData.length, recentErrors: studentData.slice(-3) };
  },
});

export const getAtRiskStudents = query({
  args: {
    threshold: v.optional(v.float64()),
  },
  handler: async (ctx, args) => {
    const minGrade = args.threshold ?? 0.5;
    const errors = await getVisibleRecords(ctx);

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

export const getQuestionIndices = query({
  handler: async (ctx) => {
    const records = await getVisibleRecords(ctx);
    if (records.length === 0) return { questions: [], studentCount: 0 };

    // Deduplicate: for students with multiple attempts on the same question, average their grades
    const gradeMap = new Map<string, { total: number; count: number }>();
    records.forEach((r) => {
      const key = `${r.studentId}||${r.question}`;
      const current = gradeMap.get(key) || { total: 0, count: 0 };
      gradeMap.set(key, { total: current.total + r.grade, count: current.count + 1 });
    });

    const dedupedRecords = Array.from(gradeMap.entries()).map(([key, stats]) => {
      const sep = key.indexOf("||");
      return {
        studentId: key.slice(0, sep),
        question: key.slice(sep + 2),
        grade: stats.total / stats.count,
      };
    });

    // 1. Rank students by their overall average grade
    const studentStats = new Map<string, { total: number; count: number }>();
    dedupedRecords.forEach((r) => {
      const current = studentStats.get(r.studentId) || { total: 0, count: 0 };
      studentStats.set(r.studentId, { total: current.total + r.grade, count: current.count + 1 });
    });

    const sortedStudents = Array.from(studentStats.entries())
      .map(([id, stats]) => ({ id, avg: stats.total / stats.count }))
      .sort((a, b) => b.avg - a.avg);

    const studentCount = sortedStudents.length;
    const boundary = Math.max(1, Math.floor(studentCount * 0.27));
    const topGroup = new Set(sortedStudents.slice(0, boundary).map(s => s.id));
    const bottomGroup = new Set(sortedStudents.slice(-boundary).map(s => s.id));

    // 2. Compute difficulty and discrimination indices per question
    const questionIds = [...new Set(dedupedRecords.map(r => r.question))];

    const questions = questionIds.map((q) => {
      const qRecords = dedupedRecords.filter(r => r.question === q);
      const difficultyIndex = qRecords.reduce((acc, r) => acc + r.grade, 0) / qRecords.length;

      const topGrades = qRecords.filter(r => topGroup.has(r.studentId));
      const bottomGrades = qRecords.filter(r => bottomGroup.has(r.studentId));

      const meanTop = topGrades.length > 0
        ? topGrades.reduce((a, b) => a + b.grade, 0) / topGrades.length : 0;
      const meanBottom = bottomGrades.length > 0
        ? bottomGrades.reduce((a, b) => a + b.grade, 0) / bottomGrades.length : 0;

      return {
        question: q,
        difficultyIndex: parseFloat(difficultyIndex.toFixed(2)),
        discriminationIndex: parseFloat((meanTop - meanBottom).toFixed(2)),
        sampleSize: qRecords.length,
      };
    });

    return { questions, studentCount };
  },
});

// Returns the full dataset formatted as structured text for use as chat context.
// Each student's answers, grades, error categories, and summaries are included
// so the AI can answer specific questions about individual students and questions.
export const getDetailedContext = query({
  handler: async (ctx) => {
    const records = await getVisibleRecords(ctx);
    if (records.length === 0) return null;

    // Group records by studentId
    type StudentEntry = {
      firstName?: string;
      surname?: string;
      email?: string;
      questions: Array<{
        question: string;
        grade: number;
        errorCategory: string[];
        errorSummary: string;
        response: string;
        rightAnswer: string;
      }>;
    };
    const studentMap = new Map<string, StudentEntry>();

    records.forEach(r => {
      if (!studentMap.has(r.studentId)) {
        studentMap.set(r.studentId, {
          firstName: r.firstName,
          surname: r.surname,
          email: r.email,
          questions: [],
        });
      }
      // Truncate free-text fields so one verbose record can't blow the context budget
      const truncate = (s: string, max: number) =>
        s && s.length > max ? s.slice(0, max) + "…" : s;

      studentMap.get(r.studentId)!.questions.push({
        question: r.question,
        grade: r.grade,
        errorCategory: r.errorCategory,
        errorSummary: truncate(r.errorSummary, 300),
        response:     truncate(r.response,     200),
        rightAnswer:  truncate(r.rightAnswer,  200),
      });
    });

    const allQuestions = [...new Set(records.map(r => r.question))];

    const lines: string[] = [
      "=== STUDENT ERROR DATASET ===",
      `Records: ${records.length} | Students: ${studentMap.size} | Questions: ${allQuestions.length}`,
      `Grade scale: 0 (wrong) to 1 (fully correct)`,
      `Questions in dataset: ${allQuestions.join(", ")}`,
      "",
    ];

    for (const [studentId, data] of studentMap.entries()) {
      const name = [data.firstName, data.surname].filter(Boolean).join(" ") || null;
      const header = name
        ? `Student ${studentId} (${name})`
        : `Student ${studentId}`;
      lines.push(header + (data.email ? ` <${data.email}>` : ""));

      for (const q of data.questions) {
        const errors = q.errorCategory.length > 0
          ? q.errorCategory.join(", ")
          : "No errors";
        lines.push(`  [${q.question}] grade: ${q.grade.toFixed(2)} | error types: ${errors}`);
        if (q.errorSummary) lines.push(`    Error detail: ${q.errorSummary}`);
        if (q.response)    lines.push(`    Student answer: "${q.response}"`);
        if (q.rightAnswer) lines.push(`    Correct answer: "${q.rightAnswer}"`);
      }
      lines.push("");
    }

    return lines.join("\n");
  },
});

// Returns a compact text summary of the current user's dataset for use as chat context
export const getDataSummary = query({
  handler: async (ctx) => {
    const records = await getVisibleRecords(ctx);
    if (records.length === 0) return null;

    const studentIds = [...new Set(records.map(r => r.studentId))];
    const questions  = [...new Set(records.map(r => r.question))];

    const categoryCounts: Record<string, number> = {};
    records.forEach(r => {
      r.errorCategory.forEach(cat => {
        categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
      });
    });

    const avgGrade = records.reduce((acc, r) => acc + r.grade, 0) / records.length;

    const topCategories = Object.entries(categoryCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([cat, count]) => `${cat} (${count})`)
      .join(", ");

    return [
      `Dataset: ${records.length} student-question records`,
      `Students: ${studentIds.length}`,
      `Questions: ${questions.join(", ")}`,
      `Average grade: ${avgGrade.toFixed(2)} (scale 0–1)`,
      `Top error categories: ${topCategories || "none"}`,
    ].join("\n");
  },
});