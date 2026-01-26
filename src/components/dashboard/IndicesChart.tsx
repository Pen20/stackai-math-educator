"use client";

import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, 
  Tooltip, Legend, ResponsiveContainer, ReferenceLine 
} from "recharts";

export default function IndicesChart() {
  const data = useQuery(api.analysis.getQuestionIndices);

  if (!data) return <div className="h-full flex items-center justify-center text-slate-400">Loading analysis...</div>;

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
        <XAxis 
          dataKey="question" 
          axisLine={false} 
          tickLine={false} 
          tick={{ fill: '#64748b', fontSize: 12 }} 
        />
        <YAxis 
          domain={[ -1, 1 ]} 
          axisLine={false} 
          tickLine={false} 
          tick={{ fill: '#64748b', fontSize: 12 }} 
        />
        <Tooltip 
          contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
        />
        <Legend verticalAlign="top" height={36}/>
        
        {/* Zero line for discrimination visibility */}
        <ReferenceLine y={0} stroke="#cbd5e1" />
        
        {/* Difficulty Index - Higher is easier */}
        <Bar 
          name="Difficulty Index" 
          dataKey="difficultyIndex" 
          fill="#3b82f6" 
          radius={[4, 4, 0, 0]} 
          barSize={20} 
        />
        
        {/* Discrimination Index - Higher is better at separating students */}
        <Bar 
          name="Discrimination Index" 
          dataKey="discriminationIndex" 
          fill="#10b981" 
          radius={[4, 4, 0, 0]} 
          barSize={20} 
        />
      </BarChart>
    </ResponsiveContainer>
  );
}
