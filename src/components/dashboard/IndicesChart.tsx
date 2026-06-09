"use client";

import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, ReferenceLine
} from "recharts";
import { AlertCircle } from "lucide-react";

export default function IndicesChart() {
  const result = useQuery(api.analysis.getQuestionIndices);

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
      {studentCount < 4 && (
        <div className="flex items-center gap-2 text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs">
          <AlertCircle className="h-4 w-4 shrink-0" />
          Only {studentCount} student{studentCount === 1 ? "" : "s"} in dataset — discrimination index requires at least 4 students to be statistically meaningful.
        </div>
      )}
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
