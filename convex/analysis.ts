import { mutation, query } from "./_generated/server";
import { QueryCtx } from "./_generated/server";
import { v } from "convex/values";

async function getVisibleRecords(ctx: Pick<QueryCtx, "db" | "auth">) {
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

export const getAssessmentSettings = query({
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;
    return await ctx.db
      .query("assessmentSettings")
      .withIndex("by_userId", (q) => q.eq("userId", identity.subject))
      .unique();
  },
});

export const saveAssessmentSettings = mutation({
  args: { totalStudentCount: v.number() },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Authentication is required.");
    const records = await getVisibleRecords(ctx);
    const representedCount = new Set(records.map((record) => record.studentId)).size;
    const totalStudentCount = Math.floor(args.totalStudentCount);
    if (!Number.isFinite(totalStudentCount) || totalStudentCount < representedCount) {
      throw new Error(`Total cohort must be at least ${representedCount}.`);
    }
    const existing = await ctx.db
      .query("assessmentSettings")
      .withIndex("by_userId", (q) => q.eq("userId", identity.subject))
      .unique();
    if (existing) {
      await ctx.db.patch(existing._id, { totalStudentCount, updatedAt: Date.now() });
    } else {
      await ctx.db.insert("assessmentSettings", {
        userId: identity.subject,
        totalStudentCount,
        updatedAt: Date.now(),
      });
    }
    return { totalStudentCount, representedCount };
  },
});

export const getQuestionIndices = query({
  args: { totalStudentCount: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const records = await getVisibleRecords(ctx);
    if (records.length === 0) return { questions: [], studentCount: 0 };

    const representedStudentIds = [...new Set(records.map((record) => record.studentId))];
    const identity = await ctx.auth.getUserIdentity();
    const savedSettings = identity
      ? await ctx.db.query("assessmentSettings")
          .withIndex("by_userId", (q) => q.eq("userId", identity.subject))
          .unique()
      : null;
    const requestedCohortSize = args.totalStudentCount ?? savedSettings?.totalStudentCount;
    if (requestedCohortSize !== undefined && requestedCohortSize < representedStudentIds.length) {
      throw new Error(`Total cohort must be at least ${representedStudentIds.length}.`);
    }
    const suppliedCohortSize = requestedCohortSize === undefined
      ? representedStudentIds.length
      : Math.floor(requestedCohortSize);
    const syntheticCorrectStudents = Array.from(
      { length: suppliedCohortSize - representedStudentIds.length },
      (_, index) => `__all_correct_${index + 1}`,
    );
    const studentIds = [...representedStudentIds, ...syntheticCorrectStudents];
    const questionIds = [...new Set(records.map((record) => record.question))];
    const observedGrades = new Map<string, number>();
    for (const record of records) {
      observedGrades.set(`${record.studentId}||${record.question}`, record.grade);
    }
    const gradeFor = (studentId: string, question: string) =>
      observedGrades.get(`${studentId}||${question}`) ?? 1;

    const studentCount = studentIds.length;
    const boundary = Math.max(1, Math.floor(studentCount * 0.27));

    const questions = questionIds.map((q) => {
      const questionErrorRecords = records.filter((record) => record.question === q);
      const allGrades = studentIds.map((studentId) => gradeFor(studentId, q));
      const difficultyIndex = allGrades.reduce((sum, grade) => sum + grade, 0) / allGrades.length;
      // Rank on the rest score (all other questions), avoiding part-whole
      // inflation from using the analysed question to define its own groups.
      const otherQuestions = questionIds.filter((question) => question !== q);
      const ranked = studentIds
        .map((id) => ({
          id,
          restScore: otherQuestions.length
            ? otherQuestions.reduce((sum, question) => sum + gradeFor(id, question), 0) / otherQuestions.length
            : 0,
        }))
        .sort((a, b) => b.restScore - a.restScore || a.id.localeCompare(b.id));
      const topIds = ranked.slice(0, boundary).map((student) => student.id);
      const bottomIds = ranked.slice(-boundary).map((student) => student.id);
      const meanTop = topIds.reduce((sum, id) => sum + gradeFor(id, q), 0) / topIds.length;
      const meanBottom = bottomIds.reduce((sum, id) => sum + gradeFor(id, q), 0) / bottomIds.length;

      return {
        question: q,
        difficultyIndex: parseFloat(difficultyIndex.toFixed(2)),
        discriminationIndex: otherQuestions.length
          ? parseFloat((meanTop - meanBottom).toFixed(2))
          : null,
        sampleSize: studentIds.length,
        observedErrorResponses: questionErrorRecords.length,
        reconstructedCorrectResponses: studentIds.length - questionErrorRecords.length,
      };
    });

    return {
      questions,
      studentCount,
      representedStudentCount: representedStudentIds.length,
      suppliedCohortSize: requestedCohortSize ?? null,
      cohortSizeConfirmed: requestedCohortSize !== undefined,
      allCorrectStudentsAdded: syntheticCorrectStudents.length,
      reconstructionRule: "Missing student-question records, including supplied cohort members with no error rows, are treated as fully correct responses (grade 1).",
      discriminationRule: "Upper and lower 27% groups are ranked separately for each question using the reconstructed mean score on all other questions.",
    };
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
      `Recorded errors: ${records.length} incorrect or partially correct responses`,
      `Students represented: ${studentIds.length}`,
      `Questions: ${questions.join(", ")}`,
      `Average grade: ${avgGrade.toFixed(2)} (scale 0–1)`,
      `Top error categories: ${topCategories || "none"}`,
    ].join("\n").replace("Average grade:", "Mean grade among recorded incorrect and partially correct responses:");
  },
});

// ---------------------------------------------------------------------------
// Conversational analytics
//
// The imported STACK dataset contains only incorrect and partially correct
// responses. Every student is expected to answer every question, so a missing
// student-question record is reconstructed as a fully correct response (1.0)
// when calculating item indices. Error-focused summaries never silently add
// those reconstructed responses.

const round = (value: number, digits = 3) => {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
};

const normaliseCategory = (category: string) =>
  category.trim().toLowerCase().replace(/\s+errors?$/, "").replace(/\s+/g, "_");

const mean = (values: number[]) =>
  values.length === 0 ? 0 : values.reduce((sum, value) => sum + value, 0) / values.length;

const median = (values: number[]) => {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[middle - 1] + sorted[middle]) / 2
    : sorted[middle];
};

const gradeBands = (grades: number[]) => {
  const bands = [
    { label: "0.0-0.2", min: 0, max: 0.2, count: 0 },
    { label: "0.2-0.4", min: 0.2, max: 0.4, count: 0 },
    { label: "0.4-0.6", min: 0.4, max: 0.6, count: 0 },
    { label: "0.6-0.8", min: 0.6, max: 0.8, count: 0 },
    { label: "0.8-1.0", min: 0.8, max: 1.000001, count: 0 },
  ];
  for (const grade of grades) {
    const band = bands.find((item, index) =>
      grade >= item.min && (index === bands.length - 1 ? grade <= item.max : grade < item.max)
    );
    if (band) band.count += 1;
  }
  return bands.map(({ label, count }) => ({
    label,
    count,
    percentage: grades.length ? round((count / grades.length) * 100, 1) : 0,
  }));
};

function categoryStatistics(records: Array<{ studentId: string; errorCategory: string[] }>) {
  const occurrences = new Map<string, number>();
  const students = new Map<string, Set<string>>();
  for (const record of records) {
    for (const rawCategory of record.errorCategory) {
      const category = normaliseCategory(rawCategory);
      if (!category) continue;
      occurrences.set(category, (occurrences.get(category) ?? 0) + 1);
      if (!students.has(category)) students.set(category, new Set());
      students.get(category)!.add(record.studentId);
    }
  }
  const totalOccurrences = [...occurrences.values()].reduce((sum, value) => sum + value, 0);
  return [...occurrences.entries()]
    .map(([category, occurrenceCount]) => ({
      category,
      occurrenceCount,
      shareOfCategoryOccurrences: totalOccurrences
        ? round((occurrenceCount / totalOccurrences) * 100, 1)
        : 0,
      affectedStudentCount: students.get(category)?.size ?? 0,
      responsePercentage: records.length
        ? round((occurrenceCount / records.length) * 100, 1)
        : 0,
    }))
    .sort((a, b) => b.occurrenceCount - a.occurrenceCount);
}

export const getErrorDatasetOverview = query({
  handler: async (ctx) => {
    const records = await getVisibleRecords(ctx);
    const students = new Set(records.map((record) => record.studentId));
    const questions = [...new Set(records.map((record) => record.question))].sort();
    const grades = records.map((record) => record.grade);
    return {
      scope: "Incorrect and partially correct STACK responses only; grade < 1.",
      errorRecordCount: records.length,
      representedStudentCount: students.size,
      questionCount: questions.length,
      questions,
      seedVariantCount: new Set(records.map((record) => record.seedId)).size,
      meanGradeAmongErrorResponses: round(mean(grades)),
      medianGradeAmongErrorResponses: round(median(grades)),
      gradeDistribution: gradeBands(grades),
      categories: categoryStatistics(records),
    };
  },
});

export const getQuestionErrorProfile = query({
  args: { question: v.string() },
  handler: async (ctx, args) => {
    const allRecords = await getVisibleRecords(ctx);
    const records = allRecords.filter((record) => record.question === args.question);
    const grades = records.map((record) => record.grade);
    const combinations = new Map<string, number>();
    for (const record of records) {
      const key = record.errorCategory.map(normaliseCategory).filter(Boolean).sort().join(" + ") || "uncategorised";
      combinations.set(key, (combinations.get(key) ?? 0) + 1);
    }
    return {
      scope: "Incorrect and partially correct responses for the selected question only.",
      question: args.question,
      errorResponseCount: records.length,
      affectedStudentCount: new Set(records.map((record) => record.studentId)).size,
      meanGradeAmongErrorResponses: round(mean(grades)),
      medianGradeAmongErrorResponses: round(median(grades)),
      gradeDistribution: gradeBands(grades),
      categories: categoryStatistics(records),
      commonCategoryCombinations: [...combinations.entries()]
        .map(([combination, count]) => ({ combination, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10),
    };
  },
});

export const getStudentErrorProfile = query({
  args: { studentId: v.string() },
  handler: async (ctx, args) => {
    const allRecords = await getVisibleRecords(ctx);
    const records = allRecords.filter((record) => record.studentId === args.studentId);
    const categoryCounts = new Map<string, number>();
    for (const record of records) {
      for (const rawCategory of record.errorCategory) {
        const category = normaliseCategory(rawCategory);
        categoryCounts.set(category, (categoryCounts.get(category) ?? 0) + 1);
      }
    }
    return {
      scope: "Error profile only. Missing student-question records are treated as correct responses.",
      studentId: args.studentId,
      recordedErrorCount: records.length,
      recordedCorrectCount: Math.max(0, new Set(allRecords.map((record) => record.question)).size - records.length),
      meanGradeAmongErrorResponses: records.length ? round(mean(records.map((record) => record.grade))) : null,
      recurringErrors: [...categoryCounts.entries()]
        .map(([category, count]) => ({ category, count }))
        .sort((a, b) => b.count - a.count),
      responses: records.map((record) => ({
        question: record.question,
        seedId: record.seedId,
        grade: record.grade,
        categories: record.errorCategory.map(normaliseCategory),
        errorSummary: record.errorSummary,
        response: record.response,
        rightAnswer: record.rightAnswer,
      })),
    };
  },
});

export const getErrorExamples = query({
  args: {
    category: v.string(),
    question: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const wanted = normaliseCategory(args.category);
    const records = (await getVisibleRecords(ctx)).filter((record) =>
      (!args.question || record.question === args.question) &&
      record.errorCategory.some((category) => normaliseCategory(category) === wanted)
    );
    const limit = Math.min(Math.max(Math.floor(args.limit ?? 5), 1), 10);
    return {
      scope: "Representative records from incorrect and partially correct responses.",
      category: wanted,
      question: args.question ?? null,
      matchingRecordCount: records.length,
      examples: records.slice(0, limit).map((record) => ({
        studentId: record.studentId,
        question: record.question,
        seedId: record.seedId,
        grade: record.grade,
        response: record.response,
        rightAnswer: record.rightAnswer,
        errorSummary: record.errorSummary,
        categories: record.errorCategory.map(normaliseCategory),
      })),
    };
  },
});

export const getSupportPriorityStudents = query({
  args: {
    maximumMeanErrorGrade: v.optional(v.number()),
    maximumSingleGrade: v.optional(v.number()),
    minimumErrorResponses: v.optional(v.number()),
    minimumQuestionsAffected: v.optional(v.number()),
    minimumRepeatedCategoryCount: v.optional(v.number()),
    errorCategory: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const records = await getVisibleRecords(ctx);
    const byStudent = new Map<string, typeof records>();
    for (const record of records) {
      if (!byStudent.has(record.studentId)) byStudent.set(record.studentId, []);
      byStudent.get(record.studentId)!.push(record);
    }
    const wantedCategory = args.errorCategory ? normaliseCategory(args.errorCategory) : null;
    const minimumErrors = Math.max(1, Math.floor(args.minimumErrorResponses ?? 3));
    const minimumQuestions = Math.max(1, Math.floor(args.minimumQuestionsAffected ?? 2));
    const minimumRecurrence = Math.max(1, Math.floor(args.minimumRepeatedCategoryCount ?? 2));
    const maximumMean = args.maximumMeanErrorGrade ?? 0.5;
    const limit = Math.min(Math.max(Math.floor(args.limit ?? 25), 1), 50);

    const matches = [...byStudent.entries()].flatMap(([studentId, studentRecords]) => {
      const categoryCounts = new Map<string, number>();
      for (const record of studentRecords) {
        for (const rawCategory of record.errorCategory) {
          const category = normaliseCategory(rawCategory);
          categoryCounts.set(category, (categoryCounts.get(category) ?? 0) + 1);
        }
      }
      const meanErrorGrade = mean(studentRecords.map((record) => record.grade));
      const questionsAffected = new Set(studentRecords.map((record) => record.question)).size;
      const maxRecurrence = Math.max(0, ...categoryCounts.values());
      const hasCategory = !wantedCategory || (categoryCounts.get(wantedCategory) ?? 0) > 0;
      const hasSevereError = args.maximumSingleGrade === undefined ||
        studentRecords.some((record) => record.grade <= args.maximumSingleGrade!);
      if (
        studentRecords.length < minimumErrors ||
        questionsAffected < minimumQuestions ||
        maxRecurrence < minimumRecurrence ||
        meanErrorGrade > maximumMean ||
        !hasCategory ||
        !hasSevereError
      ) return [];
      return [{
        studentId,
        errorResponseCount: studentRecords.length,
        questionsAffected,
        meanGradeAmongErrorResponses: round(meanErrorGrade),
        lowestGrade: Math.min(...studentRecords.map((record) => record.grade)),
        recurringErrors: [...categoryCounts.entries()]
          .map(([category, count]) => ({ category, count }))
          .sort((a, b) => b.count - a.count),
      }];
    }).sort((a, b) =>
      b.errorResponseCount - a.errorResponseCount ||
      a.meanGradeAmongErrorResponses - b.meanGradeAmongErrorResponses
    );

    return {
      scope: "Support-priority screening among students with recorded errors; this is not a definitive risk classification.",
      criteria: {
        maximumMeanErrorGrade: maximumMean,
        maximumSingleGrade: args.maximumSingleGrade ?? null,
        minimumErrorResponses: minimumErrors,
        minimumQuestionsAffected: minimumQuestions,
        minimumRepeatedCategoryCount: minimumRecurrence,
        errorCategory: wantedCategory,
      },
      totalMatchingStudents: matches.length,
      students: matches.slice(0, limit),
      truncated: matches.length > limit,
    };
  },
});

export const compareQuestionErrors = query({
  args: { questions: v.array(v.string()) },
  handler: async (ctx, args) => {
    const records = await getVisibleRecords(ctx);
    return {
      scope: "Comparison of incorrect and partially correct responses only.",
      questions: args.questions.map((question) => {
        const selected = records.filter((record) => record.question === question);
        return {
          question,
          errorResponseCount: selected.length,
          affectedStudentCount: new Set(selected.map((record) => record.studentId)).size,
          meanGradeAmongErrorResponses: selected.length
            ? round(mean(selected.map((record) => record.grade)))
            : null,
          categories: categoryStatistics(selected),
        };
      }),
    };
  },
});

export const compareSeedVariants = query({
  args: { question: v.string() },
  handler: async (ctx, args) => {
    const records = (await getVisibleRecords(ctx)).filter((record) => record.question === args.question);
    const bySeed = new Map<string, typeof records>();
    for (const record of records) {
      if (!bySeed.has(record.seedId)) bySeed.set(record.seedId, []);
      bySeed.get(record.seedId)!.push(record);
    }
    return {
      scope: "Descriptive comparison of recorded error responses by seed. Correct students' assigned seeds are unavailable, so seed-specific success rates cannot be calculated.",
      question: args.question,
      variants: [...bySeed.entries()].map(([seedId, selected]) => ({
        seedId,
        errorResponseCount: selected.length,
        meanGradeAmongErrorResponses: round(mean(selected.map((record) => record.grade))),
        categories: categoryStatistics(selected).slice(0, 5),
      })).sort((a, b) => b.errorResponseCount - a.errorResponseCount),
    };
  },
});
