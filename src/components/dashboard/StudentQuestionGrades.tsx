"use client";

import { useMemo } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

type StudentGradeRecord = {
  studentId: string;
  question: string;
  grade: number;
};

export default function StudentQuestionGrades({
  data,
  studentId,
}: {
  data: StudentGradeRecord[];
  studentId: string;
}) {
  const chartData = useMemo(() => data
    .filter((record) => record.studentId === studentId && Number.isFinite(record.grade))
    .map((record) => ({ question: record.question, grade: record.grade }))
    .sort((a, b) => a.question.localeCompare(b.question, undefined, { numeric: true })), [data, studentId]);

  if (chartData.length === 0) {
    return <div className="flex h-full items-center justify-center text-sm text-slate-400">No recorded grades found for this student.</div>;
  }

  return (
    <div className="flex h-full min-h-[320px] flex-col gap-4">
      <div className="min-h-[250px] flex-1">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 10, right: 16, left: 0, bottom: 10 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
            <XAxis dataKey="question" tick={{ fontSize: 12, fill: "#64748b" }} />
            <YAxis domain={[0, 1]} ticks={[0, 0.2, 0.4, 0.6, 0.8, 1]} tick={{ fontSize: 12, fill: "#64748b" }} />
            <Tooltip
              formatter={(value) => [Number(value).toFixed(2), "Grade"]}
              cursor={{ fill: "#f1f5f9" }}
              contentStyle={{ borderRadius: 8, borderColor: "#e2e8f0" }}
            />
            <Bar dataKey="grade" name="Grade" fill="#2563eb" radius={[5, 5, 0, 0]} maxBarSize={56} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="flex flex-wrap gap-2" aria-label="Exact grades by question">
        {chartData.map((record) => (
          <span key={record.question} className="rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs text-slate-700">
            <strong>{record.question}:</strong> {record.grade.toFixed(2)}
          </span>
        ))}
      </div>
    </div>
  );
}
