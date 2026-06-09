"use client";

import { GradeDistributionChart } from "@/components/charts/GradeDistributionChart";
import { useMemo } from "react";

export default function GradeDistribution({ data, question }: { data: any[], question?: string }) {
    const gradeData = useMemo(() => {
        if (!data) return [];
        
        let filteredData = data;
        if (question && question.trim() !== "") {
            filteredData = data.filter((d: any) => d.question === question);
        }

        // Group by Grade interval (e.g., 0-0.2, 0.2-0.4, etc.)
        const bins = ["0.0-0.2", "0.2-0.4", "0.4-0.6", "0.6-0.8", "0.8-1.0"];
        const counts = { "0.0-0.2": 0, "0.2-0.4": 0, "0.4-0.6": 0, "0.6-0.8": 0, "0.8-1.0": 0 };
    
        filteredData.forEach((e) => {
          const g = typeof e.grade === "number" && !isNaN(e.grade) ? e.grade : null;
          if (g === null) return;
          if (g <= 0.2) counts["0.0-0.2"]++;
          else if (g <= 0.4) counts["0.2-0.4"]++;
          else if (g <= 0.6) counts["0.4-0.6"]++;
          else if (g <= 0.8) counts["0.6-0.8"]++;
          else counts["0.8-1.0"]++;
        });

        const total = Object.values(counts).reduce((a, b) => a + b, 0);
        if (total === 0) return [];

        return bins.map((bin) => ({ grade: bin, count: counts[bin as keyof typeof counts] }));
      }, [data, question]);

    if (gradeData.length === 0) {
        return (
            <div className="h-full flex items-center justify-center text-sm text-slate-400">
                No grade data available for this selection.
            </div>
        );
    }

    return <GradeDistributionChart data={gradeData} />;
}
