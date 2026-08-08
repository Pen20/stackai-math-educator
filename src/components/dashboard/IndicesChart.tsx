"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, ReferenceLine
} from "recharts";
import { AlertCircle } from "lucide-react";
import { Input } from "@/components/ui/input";

export default function IndicesChart() {
  const [cohortSize, setCohortSize] = useState("");
  const parsedCohortSize = Number.parseInt(cohortSize, 10);
  const result = useQuery(api.analysis.getQuestionIndices, {
    totalStudentCount: Number.isFinite(parsedCohortSize) && parsedCohortSize > 0
      ? parsedCohortSize
      : undefined,
  });

  if (!result) return (
    <div className="h-full flex items-center justify-center text-slate-400">
      Loading analysis...
    </div>
  );

  const { questions, studentCount } = result;

  if (questions.length === 0) return (
    <div className="h-full flex items-center justify-center text-slate-400">
      No data available. Upload a dataset first.
    </div>
  );

  return (
    <div className="flex flex-col h-full gap-3">
      <div className="flex items-center gap-3 text-xs text-slate-600">
        <label htmlFor="cohort-size" className="font-medium whitespace-nowrap">Total assessment cohort</label>
        <Input
          id="cohort-size"
          type="number"
          min={studentCount}
          value={cohortSize}
          onChange={(event) => setCohortSize(event.target.value)}
          placeholder={`At least ${studentCount}`}
          className="h-8 w-40 bg-white"
        />
        <span>Include students with no recorded errors. Leave blank if every student has at least one error row.</span>
      </div>
      {studentCount < 4 && (
        <div className="flex items-center gap-2 text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs">
          <AlertCircle className="h-4 w-4 shrink-0" />
          Only {studentCount} student{studentCount === 1 ? "" : "s"} in dataset — discrimination index requires at least 4 students to be statistically meaningful.
        </div>
      )}
      <div className="text-xs text-blue-700 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
        Missing student-question error records are reconstructed as fully correct responses (grade 1) for these indices.
      </div>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={questions} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
          <XAxis
            dataKey="question"
            axisLine={false}
            tickLine={false}
            tick={{ fill: '#64748b', fontSize: 12 }}
          />
          <YAxis
            domain={[-1, 1]}
            axisLine={false}
            tickLine={false}
            tick={{ fill: '#64748b', fontSize: 12 }}
          />
          <Tooltip
            contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
          />
          <Legend verticalAlign="top" height={36} />
          <ReferenceLine y={0} stroke="#cbd5e1" />
          <Bar
            name="Difficulty Index"
            dataKey="difficultyIndex"
            fill="#3b82f6"
            radius={[4, 4, 0, 0]}
            barSize={20}
          />
          <Bar
            name="Discrimination Index"
            dataKey="discriminationIndex"
            fill="#10b981"
            radius={[4, 4, 0, 0]}
            barSize={20}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
