"use client";

import React from "react";
import { useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import Papa from "papaparse";
import { Button } from "@/components/ui/button";
import { AlertCircle, CheckCircle2, FileUp, Loader2 } from "lucide-react";

const REQUIRED_COLUMNS = [
  "student_id", "response", "right_answer", "llm_response", "question",
  "seed_id", "grade", "error_summary", "error_category",
];

const CATEGORY_NAMES: Record<string, string> = {
  reading: "reading errors",
  comprehension: "comprehension errors",
  transformation: "transformation errors",
  process: "process skill errors",
  encoding: "encoding errors",
};

type UploadStatus = { type: "success" | "error" | "warning"; message: string };

function parseCategories(value: string, rowNumber: number) {
  const categories = value.split(",").map((category) => category.trim()).filter(Boolean);
  if (categories.length === 0) throw new Error(`Row ${rowNumber}: error_category is empty.`);
  return [...new Set(categories.map((category) => {
    const lower = category.toLowerCase();
    const key = Object.keys(CATEGORY_NAMES).find((candidate) => lower.includes(candidate));
    if (!key) throw new Error(`Row ${rowNumber}: unknown error category "${category}".`);
    return CATEGORY_NAMES[key];
  }))];
}

export function CSVUploader() {
  const replaceErrors = useMutation(api.studentErrors.replaceStudentErrors);
  const [isUploading, setIsUploading] = React.useState(false);
  const [status, setStatus] = React.useState<UploadStatus | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setStatus(null);
    setIsUploading(true);

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (header) => header.trim().toLowerCase(),
      complete: async (results) => {
        try {
          if (results.errors.length > 0) throw new Error(`CSV parsing failed: ${results.errors[0].message}`);
          const rows = results.data as Record<string, unknown>[];
          if (rows.length === 0) throw new Error("The CSV file is empty.");

          const headers = Object.keys(rows[0]);
          const missing = REQUIRED_COLUMNS.filter((column) => !headers.includes(column));
          if (missing.length > 0) throw new Error(`Missing required columns: ${missing.join(", ")}`);

          const seen = new Set<string>();
          const formatted = rows.map((row, index) => {
            const rowNumber = index + 2;
            const studentId = String(row.student_id ?? "").trim();
            const question = String(row.question ?? "").trim();
            const seedId = String(row.seed_id ?? "").trim();
            const gradeText = String(row.grade ?? "").trim();
            const grade = Number(gradeText);
            if (!studentId) throw new Error(`Row ${rowNumber}: student_id is required.`);
            if (!question) throw new Error(`Row ${rowNumber}: question is required.`);
            if (!seedId) throw new Error(`Row ${rowNumber}: seed_id is required.`);
            if (!gradeText || !Number.isFinite(grade) || grade < 0 || grade >= 1) {
              throw new Error(`Row ${rowNumber}: grade must satisfy 0 <= grade < 1.`);
            }
            const key = `${studentId}\u0000${question}`;
            if (seen.has(key)) throw new Error(`Row ${rowNumber}: duplicate student_id + question (${studentId}, ${question}).`);
            seen.add(key);
            return {
              studentId,
              question,
              seedId,
              response: String(row.response ?? "").trim(),
              rightAnswer: String(row.right_answer ?? "").trim(),
              grade,
              errorCategory: parseCategories(String(row.error_category ?? ""), rowNumber),
              errorSummary: String(row.error_summary ?? "").trim(),
              llmResponse: String(row.llm_response ?? "").trim(),
            };
          });

          const questionCount = new Set(formatted.map((row) => row.question)).size;
          if (questionCount < 2) throw new Error("At least two questions are required for discrimination analysis.");
          const confirmed = confirm(
            `Replace your current dataset with ${formatted.length} validated error records across ${questionCount} questions?`,
          );
          if (!confirmed) {
            setStatus({ type: "warning", message: "Upload cancelled; the current dataset was not changed." });
            return;
          }

          const result = await replaceErrors({ errors: formatted });
          setStatus({
            type: "success",
            message: `${result.inserted} validated records uploaded; ${result.removed} previous records replaced.`,
          });
        } catch (error: unknown) {
          console.error(error);
          setStatus({ type: "error", message: error instanceof Error ? error.message : "Upload failed." });
        } finally {
          setIsUploading(false);
          if (fileInputRef.current) fileInputRef.current.value = "";
        }
      },
      error: (error) => {
        setStatus({ type: "error", message: `CSV parsing failed: ${error.message}` });
        setIsUploading(false);
        if (fileInputRef.current) fileInputRef.current.value = "";
      },
    });
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="relative">
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,text/csv"
          onChange={handleUpload}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          disabled={isUploading}
        />
        <Button variant="outline" className="gap-2" disabled={isUploading}>
          {isUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileUp className="h-4 w-4" />}
          {isUploading ? "Validating and uploading..." : "Upload Dataset"}
        </Button>
      </div>

      {status && (
        <div className={`flex items-start gap-2 text-xs px-3 py-2 rounded-lg border max-w-md ${
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
