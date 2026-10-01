"use client";

import React from "react";
import { useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import Papa from "papaparse";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertCircle, CheckCircle2, FileUp, Loader2, X } from "lucide-react";

const REQUIRED_COLUMNS = [
  "student_id", "response", "right_answer", "llm_response", "question",
  "seed_id", "grade", "error_summary", "error_category",
] as const;

type RequiredColumn = typeof REQUIRED_COLUMNS[number];
type ColumnMapping = Record<RequiredColumn, string>;

const COLUMN_HELP: Record<RequiredColumn, string> = {
  student_id: "Unique student identifier",
  response: "Student's submitted answer",
  right_answer: "Correct or reference answer",
  llm_response: "Generated feedback or explanation",
  question: "Question identifier",
  seed_id: "Question variant identifier",
  grade: "Numeric grade from 0 (inclusive) to 1 (exclusive)",
  error_summary: "Short description of the error",
  error_category: "One or more NEA error categories",
};

const CATEGORY_NAMES: Record<string, string> = {
  reading: "reading errors", comprehension: "comprehension errors",
  transformation: "transformation errors", process: "process skill errors", encoding: "encoding errors",
};

type UploadStatus = { type: "success" | "error" | "warning"; message: string };
type ParsedDataset = { fileName: string; headers: string[]; rows: Record<string, unknown>[] };

const emptyMapping = (): ColumnMapping => Object.fromEntries(
  REQUIRED_COLUMNS.map((column) => [column, ""]),
) as ColumnMapping;

function comparableHeader(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
}

function suggestedMapping(headers: string[]) {
  const mapping = emptyMapping();
  for (const required of REQUIRED_COLUMNS) {
    mapping[required] = headers.find((header) => comparableHeader(header) === comparableHeader(required)) ?? "";
  }
  return mapping;
}

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
  const [isWorking, setIsWorking] = React.useState(false);
  const [status, setStatus] = React.useState<UploadStatus | null>(null);
  const [dataset, setDataset] = React.useState<ParsedDataset | null>(null);
  const [mapping, setMapping] = React.useState<ColumnMapping>(emptyMapping);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (!dataset) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previousOverflow; };
  }, [dataset]);

  const closeMapping = () => {
    setDataset(null);
    setMapping(emptyMapping());
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setStatus(null);
    setIsWorking(true);

    Papa.parse<Record<string, unknown>>(file, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (header) => header.trim(),
      complete: (results) => {
        try {
          if (results.errors.length > 0) throw new Error(`CSV parsing failed: ${results.errors[0].message}`);
          if (results.data.length === 0) throw new Error("The CSV file is empty.");
          const headers = results.meta.fields?.filter(Boolean) ?? [];
          if (headers.length === 0) throw new Error("The CSV file does not contain a header row.");
          if (new Set(headers).size !== headers.length) throw new Error("The CSV contains duplicate column names.");
          setDataset({ fileName: file.name, headers, rows: results.data });
          setMapping(suggestedMapping(headers));
        } catch (error: unknown) {
          setStatus({ type: "error", message: error instanceof Error ? error.message : "Upload failed." });
          closeMapping();
        } finally { setIsWorking(false); }
      },
      error: (error) => {
        setStatus({ type: "error", message: `CSV parsing failed: ${error.message}` });
        setIsWorking(false);
        closeMapping();
      },
    });
  };

  const validateAndUpload = async () => {
    if (!dataset) return;
    setStatus(null);
    setIsWorking(true);
    try {
      const missing = REQUIRED_COLUMNS.filter((column) => !mapping[column]);
      if (missing.length > 0) throw new Error(`Map all required variables. Missing: ${missing.join(", ")}.`);
      const selected = Object.values(mapping);
      if (new Set(selected).size !== selected.length) throw new Error("Each dataset column can be mapped to only one variable.");

      const seen = new Set<string>();
      const value = (row: Record<string, unknown>, column: RequiredColumn) => String(row[mapping[column]] ?? "").trim();
      const formatted = dataset.rows.map((row, index) => {
        const rowNumber = index + 2;
        const studentId = value(row, "student_id");
        const question = value(row, "question");
        const seedId = value(row, "seed_id");
        const gradeText = value(row, "grade");
        const grade = Number(gradeText);
        if (!studentId) throw new Error(`Row ${rowNumber}: student_id is required.`);
        if (!question) throw new Error(`Row ${rowNumber}: question is required.`);
        if (!seedId) throw new Error(`Row ${rowNumber}: seed_id is required.`);
        if (!gradeText || !Number.isFinite(grade) || grade < 0 || grade >= 1) throw new Error(`Row ${rowNumber}: grade must satisfy 0 <= grade < 1.`);
        const key = `${studentId}\u0000${question}`;
        if (seen.has(key)) throw new Error(`Row ${rowNumber}: duplicate student_id + question (${studentId}, ${question}).`);
        seen.add(key);
        return {
          studentId, question, seedId,
          response: value(row, "response"), rightAnswer: value(row, "right_answer"), grade,
          errorCategory: parseCategories(value(row, "error_category"), rowNumber),
          errorSummary: value(row, "error_summary"), llmResponse: value(row, "llm_response"),
        };
      });
      const questionCount = new Set(formatted.map((row) => row.question)).size;
      if (questionCount < 2) throw new Error("At least two questions are required for discrimination analysis.");
      if (!confirm(`Validation passed. Replace your current dataset with ${formatted.length} records across ${questionCount} questions?`)) {
        setStatus({ type: "warning", message: "Upload cancelled; the current dataset was not changed." });
        return;
      }
      const result = await replaceErrors({ errors: formatted });
      setStatus({ type: "success", message: `${result.inserted} validated records uploaded; ${result.removed} previous records replaced.` });
      closeMapping();
    } catch (error: unknown) {
      console.error(error);
      setStatus({ type: "error", message: error instanceof Error ? error.message : "Upload failed." });
    } finally { setIsWorking(false); }
  };

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="relative">
        <input ref={fileInputRef} type="file" accept=".csv,text/csv" onChange={handleFile}
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0" disabled={isWorking || Boolean(dataset)} />
        <Button variant="outline" className="gap-2" disabled={isWorking || Boolean(dataset)}>
          {isWorking && !dataset ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileUp className="h-4 w-4" />}
          {isWorking && !dataset ? "Reading dataset..." : "Upload Dataset"}
        </Button>
      </div>

      {status && <div className={`flex max-w-md items-start gap-2 rounded-lg border px-3 py-2 text-xs ${status.type === "success" ? "border-green-200 bg-green-50 text-green-700" : status.type === "warning" ? "border-amber-200 bg-amber-50 text-amber-700" : "border-red-200 bg-red-50 text-red-700"}`}>
        {status.type === "success" ? <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" /> : <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />}{status.message}
      </div>}

      {dataset && <div className="fixed inset-0 z-50 flex items-center justify-center overflow-hidden bg-slate-950/45 p-4" role="dialog" aria-modal="true" aria-labelledby="column-mapping-title">
        <div className="flex max-h-[calc(100dvh-2rem)] w-full max-w-3xl flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl">
          <div className="z-10 flex shrink-0 items-start justify-between border-b border-slate-200 bg-white px-6 py-4">
            <div><h2 id="column-mapping-title" className="text-lg font-semibold text-slate-900">Match dataset columns</h2>
              <p className="mt-1 text-sm text-slate-500">Map every variable to a column in <span className="font-medium text-slate-700">{dataset.fileName}</span>.</p></div>
            <Button variant="ghost" size="icon" onClick={closeMapping} disabled={isWorking} aria-label="Close column mapping"><X className="h-4 w-4" /></Button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
            {status && <div className={`mx-6 mt-5 flex items-start gap-2 rounded-lg border px-3 py-2 text-sm ${status.type === "warning" ? "border-amber-200 bg-amber-50 text-amber-700" : "border-red-200 bg-red-50 text-red-700"}`}>
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />{status.message}
            </div>}
            <div className="space-y-3 px-6 py-5">
            <div className="hidden grid-cols-2 gap-4 px-1 text-xs font-medium uppercase tracking-wide text-slate-500 sm:grid"><span>Required system variable</span><span>Column in your dataset</span></div>
            {REQUIRED_COLUMNS.map((column) => <div key={column} className="grid gap-2 rounded-lg border border-slate-200 p-3 sm:grid-cols-2 sm:items-center sm:gap-4">
              <div><code className="text-sm font-semibold text-slate-900">{column}</code><p className="mt-0.5 text-xs text-slate-500">{COLUMN_HELP[column]}</p></div>
              <Select value={mapping[column] || undefined} onValueChange={(source) => setMapping((current) => ({ ...current, [column]: source }))} disabled={isWorking}>
                <SelectTrigger className="w-full" aria-label={`Dataset column for ${column}`}><SelectValue placeholder="Select a dataset column" /></SelectTrigger>
                <SelectContent>{dataset.headers.map((header) => <SelectItem key={header} value={header} disabled={Object.entries(mapping).some(([target, source]) => target !== column && source === header)}>{header}</SelectItem>)}</SelectContent>
              </Select>
            </div>)}
            </div>
          </div>
          <div className="flex shrink-0 flex-col-reverse gap-2 border-t border-slate-200 bg-white px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-slate-500">{dataset.rows.length} data rows found. No data is replaced until validation passes.</p>
            <div className="flex gap-2"><Button variant="outline" onClick={closeMapping} disabled={isWorking}>Cancel</Button>
              <Button onClick={validateAndUpload} disabled={isWorking || REQUIRED_COLUMNS.some((column) => !mapping[column])}>{isWorking && <Loader2 className="h-4 w-4 animate-spin" />}{isWorking ? "Validating..." : "Validate and upload"}</Button></div>
          </div>
        </div>
      </div>}
    </div>
  );
}
