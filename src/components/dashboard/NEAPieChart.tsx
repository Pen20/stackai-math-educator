"use client";

import { useState, useMemo, useEffect } from "react";
import { PieChart, Pie, Sector, ResponsiveContainer, Cell } from "recharts";

// Fixed color per category so the same error type always gets the same color
// regardless of which question is selected or how frequent each type is.
const CATEGORY_COLORS: Record<string, string> = {
  "Reading Error":       "#3b82f6",
  "Comprehension Error": "#10b981",
  "Transformation Error":"#f59e0b",
  "Process Skill Error": "#ef4444",
  "Encoding Error":      "#8b5cf6",
};

const ALLOWED_CATEGORIES: Record<string, string> = {
  "reading":       "Reading Error",
  "comprehension": "Comprehension Error",
  "transformation":"Transformation Error",
  "process":       "Process Skill Error",
  "encoding":      "Encoding Error",
};

interface NEAPieChartProps {
  data: any[];
  question: string;
}

const renderActiveShape = (props: any) => {
  const { cx, cy, innerRadius, outerRadius, startAngle, endAngle, fill, payload } = props;
  if (!payload?.name) return <g />;

  const words = payload.name.split(" ");
  const firstLine = words.slice(0, Math.ceil(words.length / 2)).join(" ");
  const secondLine = words.slice(Math.ceil(words.length / 2)).join(" ");

  return (
    <g>
      <text x={cx} y={cy} textAnchor="middle" fill="#334155" className="font-bold text-xs">
        <tspan x={cx} dy={secondLine ? "-0.4em" : "0.3em"}>{firstLine}</tspan>
        {secondLine && <tspan x={cx} dy="1.2em">{secondLine}</tspan>}
      </text>
      <Sector cx={cx} cy={cy} innerRadius={innerRadius} outerRadius={outerRadius}
        startAngle={startAngle} endAngle={endAngle} fill={fill} />
      <Sector cx={cx} cy={cy} startAngle={startAngle} endAngle={endAngle}
        innerRadius={outerRadius + 4} outerRadius={outerRadius + 8} fill={fill} />
    </g>
  );
};

export default function NEAPieChart({ data, question }: NEAPieChartProps) {
  const [activeIndex, setActiveIndex] = useState(0);

  // Reset active sector whenever the question changes to avoid out-of-bounds access
  useEffect(() => {
    setActiveIndex(0);
  }, [question]);

  const chartData = useMemo(() => {
    const questionData = data.filter(d => d.question === question);
    const counts: Record<string, number> = {};
    let totalEntries = 0;

    questionData.forEach(item => {
      const categories: string[] = Array.isArray(item.errorCategory)
        ? item.errorCategory
        : typeof item.errorCategory === "string"
          ? item.errorCategory.split(", ")
          : [];

      categories.forEach((cat: string) => {
        const lowerCat = cat.trim().toLowerCase();
        let match: string | null = null;
        for (const key in ALLOWED_CATEGORIES) {
          if (lowerCat.includes(key)) {
            match = ALLOWED_CATEGORIES[key];
            break;
          }
        }
        if (match) {
          counts[match] = (counts[match] || 0) + 1;
          totalEntries++;
        }
      });
    });

    if (totalEntries === 0) return [];

    return Object.keys(counts)
      .map(name => ({
        name,
        value: counts[name],
        percentage: ((counts[name] / totalEntries) * 100).toFixed(1),
        color: CATEGORY_COLORS[name] ?? "#94a3b8",
      }))
      .sort((a, b) => b.value - a.value);
  }, [data, question]);

  const onPieEnter = (_: any, index: number) => setActiveIndex(index);

  if (chartData.length === 0) {
    return (
      <div className="h-[350px] w-full flex items-center justify-center text-slate-400">
        <p>No error attributes found for this selection.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center w-full gap-4">
      <div className="w-full" style={{ height: 240 }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              activeIndex={activeIndex}
              activeShape={renderActiveShape}
              data={chartData}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={85}
              fill="#8884d8"
              dataKey="value"
              onMouseEnter={onPieEnter}
              paddingAngle={2}
            >
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} stroke="none" />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
      </div>

      <div className="grid grid-cols-2 gap-x-6 gap-y-2 w-full px-4 pb-2">
        {chartData.map((entry, index) => (
          <div
            key={entry.name}
            className="flex items-center gap-2 cursor-pointer group"
            onMouseEnter={() => setActiveIndex(index)}
          >
            <span
              className="inline-block w-2.5 h-2.5 rounded-full shrink-0 transition-transform group-hover:scale-125"
              style={{ backgroundColor: entry.color }}
            />
            <span className="text-xs font-medium text-slate-600 leading-tight">
              {entry.name}
            </span>
            <span className="ml-auto text-xs font-semibold tabular-nums"
              style={{ color: entry.color }}>
              {entry.percentage}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
