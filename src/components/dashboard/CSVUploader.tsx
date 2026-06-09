"use client";
import React from "react";
import { useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import Papa from "papaparse";
import { Button } from "@/components/ui/button";
import { FileUp, Loader2, CheckCircle2, AlertCircle } from "lucide-react";

const REQUIRED_COLUMNS = ["student_id", "question", "grade", "error_category"];

function detectGradeScale(rows: any[]): "0-1" | "0-100" {
  const grades = rows.map((r) => parseFloat(r.grade)).filter((g) => !isNaN(g));
  if (grades.length === 0) return "0-1";
  return Math.max(...grades) > 1 ? "0-100" : "0-1";
}

type UploadStatus = { type: "success" | "error" | "warning"; message: string };

export function CSVUploader() {
  const insertError = useMutation(api.studentErrors.seedStudentErrors);
  const [isUploading, setIsUploading] = React.useState(false);
  const [status, setStatus] = React.useState<UploadStatus | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setStatus(null);
    setIsUploading(true);

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        try {
          const rows = results.data as any[];

          if (rows.length === 0) {
            setStatus({ type: "error", message: "The CSV file is empty." });
            return;
          }

          // Validate required columns (case-insensitive)
          const headers = Object.keys(rows[0]).map((h) => h.toLowerCase().trim());
          const missing = REQUIRED_COLUMNS.filter((col) => !headers.includes(col));
          if (missing.length > 0) {
            setStatus({ type: "error", message: `Missing required columns: ${missing.join(", ")}` });
            return;
          }

          // Validate grade scale
          if (detectGradeScale(rows) === "0-100") {
            setStatus({
              type: "error",
              message: "Grades appear to be on a 0–100 scale. Convert to 0–1 (e.g. 75 → 0.75) before uploading.",
            });
            return;
          }

          const formatted = rows.map((row) => ({
            studentId: String(row.student_id),
            question: row.question,
            seedId: String(row.seed_id || ""),
            response: row.response || "",
            rightAnswer: row.right_answer || "",
            grade: parseFloat(row.grade) || 0,
            errorCategory: row.error_category ? row.error_category.split(", ") : [],
            errorSummary: row.error_summary || "",
            llmResponse: row.llm_response || "",
            firstName: row.first_name || row.firstname || "",
            surname: row.surname || row.last_name || row.lastname || "",
            email: row.email || "",
          }));

          await insertError({ errors: formatted });
          setStatus({ type: "success", message: `${formatted.length} records uploaded successfully.` });
        } catch (error: any) {
          console.error(error);
          setStatus({ type: "error", message: "Upload failed. Check console for details." });
        } finally {
          setIsUploading(false);
          if (fileInputRef.current) fileInputRef.current.value = "";
        }
      },
    });
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="relative">
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv"
          onChange={handleUpload}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          disabled={isUploading}
        />
        <Button variant="outline" className="gap-2" disabled={isUploading}>
          {isUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileUp className="h-4 w-4" />}
          {isUploading ? "Uploading..." : "Upload Dataset"}
        </Button>
      </div>

      {status && (
        <div className={`flex items-start gap-2 text-xs px-3 py-2 rounded-lg border max-w-xs ${
          status.type === "success"
            ? "bg-green-50 border-green-200 text-green-700"
            : status.type === "warning"
            ? "bg-amber-50 border-amber-200 text-amber-700"
            : "bg-red-50 border-red-200 text-red-700"
        }`}>
          {status.type === "success"
            ? <CheckCircle2 className="h-3.5 w-3.5 shrink-0 mt-0.5" />
            : <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />}
          {status.message}
        </div>
      )}
    </div>
  );
}
