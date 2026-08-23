import fs from "node:fs/promises";
import path from "node:path";

type ToolCall = { function: string; arguments: unknown };
type LogRecord = {
  runId?: string | null;
  benchmarkId?: string | null;
  timestamp?: string;
  toolCalls?: ToolCall[];
  answer?: string;
  error?: string;
};

type ParameterCheck = {
  mode: "literal" | "manual";
  expected: Record<string, unknown>;
  mustBeAbsent: string[];
  manualOnly: string[];
};

type BenchmarkSpec = {
  id: string;
  query: string;
  family: number;
  familyName: string;
  sequence?: string;
  backendSupport: string;
  expectedFunction: string;
  acceptedFunctions: string[];
  requiresAllFunctions: boolean;
  parameterCheck: ParameterCheck;
  expectedAnswer: string;
  tolerance: string;
};

const benchmarkDirectory = path.join(process.cwd(), "benchmark");

async function loadSpecs(): Promise<BenchmarkSpec[]> {
  const source = await fs.readFile(path.join(benchmarkDirectory, "ground_truth.json"), "utf8");
  return JSON.parse(source).queries as BenchmarkSpec[];
}

function sameValue(expected: unknown, actual: unknown): boolean {
  if (Array.isArray(expected)) {
    return Array.isArray(actual) &&
      [...expected].map(String).sort().join("\u0000") === [...actual].map(String).sort().join("\u0000");
  }
  if (typeof expected === "number" && typeof actual === "number") {
    return Math.abs(expected - actual) < 1e-9;
  }
  return expected === actual;
}

function scoreFunction(spec: BenchmarkSpec, called: string[]): [string, string] {
  if (!spec.acceptedFunctions.length) return ["?", "No machine-readable expected function"];
  if (spec.requiresAllFunctions) {
    const missing = spec.acceptedFunctions.filter((name) => !called.includes(name));
    return missing.length ? ["0", `Missing functions: ${missing.join(", ")}`] : ["1", ""];
  }
  if (!called.length) return ["0", "No tool call recorded"];
  return called.some((name) => spec.acceptedFunctions.includes(name))
    ? ["1", ""]
    : ["0", `Called ${called.join(", ")}; expected ${spec.acceptedFunctions.join(" or ")}`];
}

function scoreParameters(spec: BenchmarkSpec, calls: ToolCall[]): [string, string] {
  const check = spec.parameterCheck;
  if (check.mode === "manual") return ["?", `Manual parameter review: ${check.manualOnly.join(", ")}`];
  const relevant = calls.filter((call) => spec.acceptedFunctions.includes(call.function));
  if (!relevant.length) return ["0", "No expected function call to inspect"];
  const notes: string[] = [];
  for (const call of relevant) {
    const args = call.arguments && typeof call.arguments === "object"
      ? call.arguments as Record<string, unknown>
      : {};
    const problems: string[] = [];
    for (const [key, value] of Object.entries(check.expected)) {
      if (!(key in args)) problems.push(`Missing ${key}`);
      else if (!sameValue(value, args[key])) problems.push(`${key} did not match`);
    }
    for (const key of check.mustBeAbsent) {
      if (key in args) problems.push(`${key} should be omitted`);
    }
    if (!problems.length) {
      return check.manualOnly.length
        ? ["?", `Literal arguments match; manual review: ${check.manualOnly.join(", ")}`]
        : ["1", ""];
    }
    notes.push(...problems);
  }
  return ["0", notes.join("; ")];
}

function csvCell(value: unknown): string {
  const text = value == null ? "" : String(value);
  return `"${text.replaceAll('"', '""')}"`;
}

export async function GET() {
  if (process.env.BENCHMARK_LOG !== "1") {
    return Response.json({ error: "Benchmark mode is disabled." }, { status: 404 });
  }
  const specs = await loadSpecs();
  return Response.json({
    total: specs.length,
    queries: specs.map(({ id, query, family, familyName, sequence, backendSupport }) => ({
      id, query, family, familyName, sequence: sequence ?? "", backendSupport,
    })),
  });
}

export async function POST(request: Request) {
  if (process.env.BENCHMARK_LOG !== "1") {
    return Response.json({ error: "Benchmark mode is disabled." }, { status: 404 });
  }
  const { runId } = await request.json() as { runId?: string };
  if (!runId || !/^[a-zA-Z0-9_-]{6,80}$/.test(runId)) {
    return Response.json({ error: "Invalid benchmark run ID." }, { status: 400 });
  }

  const specs = await loadSpecs();
  const byId = new Map(specs.map((spec) => [spec.id, spec]));
  const runsDirectory = path.join(benchmarkDirectory, "runs");
  const files = (await fs.readdir(runsDirectory).catch(() => []))
    .filter((name) => name.endsWith(".jsonl"));
  const records: LogRecord[] = [];
  for (const name of files) {
    const content = await fs.readFile(path.join(runsDirectory, name), "utf8");
    for (const line of content.split(/\r?\n/)) {
      if (!line.trim()) continue;
      try {
        const record = JSON.parse(line) as LogRecord;
        if (record.runId === runId && record.benchmarkId) records.push(record);
      } catch { /* Ignore an incomplete final JSONL line. */ }
    }
  }

  const headers = [
    "Run ID", "Timestamp", "Benchmark ID", "Query text", "Query family", "Backend support",
    "Expected function", "Called functions", "Function correct?", "Required parameters",
    "Called arguments", "Parameters correct?", "Ground-truth result", "Tolerance",
    "Backend result correct?", "Full assistant answer", "End-to-end result correct?",
    "Response faithful?", "Scoring notes", "Error notes",
  ];
  const rows = records.flatMap((record) => {
    const spec = byId.get(record.benchmarkId ?? "");
    if (!spec) return [];
    const calls = record.toolCalls ?? [];
    const called = calls.map((call) => call.function);
    const [functionScore, functionNote] = scoreFunction(spec, called);
    const [parameterScore, parameterNote] = scoreParameters(spec, calls);
    return [[
      runId, record.timestamp, spec.id, spec.query, spec.familyName, spec.backendSupport,
      spec.expectedFunction, called.join(", ") || "(none)", functionScore,
      JSON.stringify(spec.parameterCheck.expected), JSON.stringify(calls.map((call) => call.arguments)),
      parameterScore, spec.expectedAnswer, spec.tolerance,
      spec.backendSupport === "none" ? "N/A" : "", record.answer ?? "", "", "",
      [functionNote, parameterNote].filter(Boolean).join(" | "), record.error ?? "",
    ]];
  });
  const csv = [headers, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n");
  return new Response("\ufeff" + csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="benchmark-${runId}.csv"`,
    },
  });
}
