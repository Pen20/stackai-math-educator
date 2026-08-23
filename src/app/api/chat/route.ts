import OpenAI from "openai";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../../convex/_generated/api";

const MAX_HISTORY_MESSAGES = 12;

// ---------------------------------------------------------------------------
// Benchmark instrumentation (development only).
//
// Set BENCHMARK_LOG=1 in .env.local to append one JSONL record per turn to
// benchmark/runs/<date>.jsonl, recording which analysis function the planner selected, the
// arguments it extracted, the raw tool output, and the streamed answer. Those first three are
// invisible in the chat transcript, so without this log a benchmark run can only score the final
// narrative - not function selection, parameter extraction, or backend correctness.
//
// Tag a turn by prefixing the message with its benchmark ID, e.g. "#Q021 How many error
// responses are recorded for Q1?". The tag is stripped before the model sees it, so the query
// text under test stays exactly as specified in the sheet.
const BENCHMARK_LOG_ENABLED = process.env.BENCHMARK_LOG === "1";
const BENCHMARK_TAG = /^\s*#(Q\d{3}(?:-[A-Z])?)\s+/;
const MAX_LOGGED_RESULT_CHARS = 40000;

type BenchmarkRecord = {
  runId: string | null;
  benchmarkId: string | null;
  timestamp: string;
  query: string;
  turnIndex: number;
  toolCalls: Array<{ function: string; arguments: unknown; rawArguments: string }>;
  toolResults: Array<{ function: string; result: unknown; truncated: boolean }>;
  answer: string;
  answerChars: number;
  error?: string;
};

async function writeBenchmarkRecord(record: BenchmarkRecord) {
  if (!BENCHMARK_LOG_ENABLED) return;
  try {
    const [fs, path] = await Promise.all([import("node:fs/promises"), import("node:path")]);
    const directory = path.join(process.cwd(), "benchmark", "runs");
    await fs.mkdir(directory, { recursive: true });
    const file = path.join(directory, `${record.timestamp.slice(0, 10)}.jsonl`);
    await fs.appendFile(file, JSON.stringify(record) + "\n", "utf8");
  } catch (error) {
    // Never let instrumentation break a chat turn.
    console.error("[benchmark-log]", error instanceof Error ? error.message : error);
  }
}

const tools: OpenAI.Chat.Completions.ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "get_error_dataset_overview",
      description: "Get exact overall statistics for the STACK dataset of incorrect and partially correct responses.",
      parameters: { type: "object", properties: {}, additionalProperties: false },
    },
  },
  {
    type: "function",
    function: {
      name: "get_question_error_profile",
      description: "Analyse grades, NEA categories, and category combinations for one question's error responses.",
      parameters: {
        type: "object",
        properties: { question: { type: "string", description: "Exact question label, for example Q. 3" } },
        required: ["question"], additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_student_error_profile",
      description: "Get one student's recurring errors and evidence across questions. Missing question records mean correct responses.",
      parameters: {
        type: "object",
        properties: { studentId: { type: "string" } },
        required: ["studentId"], additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_error_examples",
      description: "Retrieve representative submitted responses associated with a specific NEA error category.",
      parameters: {
        type: "object",
        properties: {
          category: { type: "string" },
          question: { type: "string" },
          limit: { type: "number", minimum: 1, maximum: 10 },
        },
        required: ["category"], additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_support_priority_students",
      description: "Find students meeting transparent educator-selected support-priority criteria based on repeated or severe recorded errors.",
      parameters: {
        type: "object",
        properties: {
          maximumMeanErrorGrade: { type: "number", minimum: 0, maximum: 1 },
          maximumSingleGrade: { type: "number", minimum: 0, maximum: 1 },
          minimumErrorResponses: { type: "number", minimum: 1 },
          minimumQuestionsAffected: { type: "number", minimum: 1 },
          minimumRepeatedCategoryCount: { type: "number", minimum: 1 },
          errorCategory: { type: "string" },
          limit: { type: "number", minimum: 1, maximum: 50 },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "compare_question_errors",
      description: "Compare exact error-response counts, grades, and NEA distributions across two or more questions.",
      parameters: {
        type: "object",
        properties: { questions: { type: "array", items: { type: "string" }, minItems: 2 } },
        required: ["questions"], additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "compare_seed_variants",
      description: "Compare recorded error patterns across STACK seed variants for one question. This cannot calculate seed success rates.",
      parameters: {
        type: "object",
        properties: { question: { type: "string" } },
        required: ["question"], additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_question_indices",
      description: "Calculate classical difficulty and discrimination indices by reconstructing missing student-question records as fully correct responses.",
      parameters: {
        type: "object",
        properties: {
          totalStudentCount: {
            type: "number",
            minimum: 1,
            description: "Total assessment cohort, including students with no error rows, when provided by the educator.",
          },
        },
        additionalProperties: false,
      },
    },
  },
];

const systemPrompt = `You are a domain-specific conversational analytics assistant for STACK mathematics assessment data classified with Newman's Error Analysis (NEA).

DATA RULES
- Stored rows contain only incorrect and partially correct responses (grade < 1).
- Every represented student was expected to answer every question. A missing student-question row therefore means a fully correct response (grade 1).
- Describe 0.57 over stored rows as "the mean grade among recorded incorrect and partially correct responses", never as the average student grade.
- Error categories are multi-label. Distinguish category-occurrence share (sums to 100%) from percentage of error responses containing a category (may exceed 100%).
- Seed comparisons are descriptive because the assigned seed for missing/correct responses is unavailable.

RESPONSE RULES
- Base every dataset claim on tool output. Never calculate or invent counts from chat history.
- Lead with a direct answer, then concise evidence, an NEA interpretation where useful, and a possible educational action.
- State the relevant population and denominator for percentages.
- For support-priority results, repeat the criteria and say "students meeting the selected support-priority criteria", not a definitive diagnosis.
- Treat student identifiers as pseudonyms. Do not infer personal characteristics.
- If a request is outside the available data, explain the limitation clearly.`;

export async function POST(req: Request) {
  try {
    const { messages } = await req.json();
    if (!Array.isArray(messages) || messages.length === 0) {
      return new Response("A conversation message is required.", { status: 400 });
    }

    const apiKey = process.env.OPENAI_API_KEY;
    const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
    const authHeader = req.headers.get("authorization");
    if (!apiKey) return new Response("OPENAI_API_KEY is not configured.", { status: 500 });
    if (!convexUrl) return new Response("NEXT_PUBLIC_CONVEX_URL is not configured.", { status: 500 });
    if (!authHeader?.startsWith("Bearer ")) return new Response("Authentication is required.", { status: 401 });

    const convex = new ConvexHttpClient(convexUrl);
    convex.setAuth(authHeader.slice(7));
    const openai = new OpenAI({ apiKey });
    const recentMessages = messages.slice(-MAX_HISTORY_MESSAGES).map((message: { role: string; content: string }) => ({
      role: message.role as "user" | "assistant",
      content: message.content,
    }));

    // Strip a leading benchmark tag so the model receives the query exactly as specified.
    let benchmarkId: string | null = null;
    const lastMessage = recentMessages[recentMessages.length - 1];
    if (lastMessage?.role === "user") {
      const tagged = BENCHMARK_TAG.exec(lastMessage.content);
      if (tagged) {
        benchmarkId = tagged[1];
        lastMessage.content = lastMessage.content.slice(tagged[0].length);
      }
    }
    const benchmarkTurn: BenchmarkRecord = {
      runId: req.headers.get("x-benchmark-run-id"),
      benchmarkId,
      timestamp: new Date().toISOString(),
      query: lastMessage?.content ?? "",
      turnIndex: messages.length,
      toolCalls: [],
      toolResults: [],
      answer: "",
      answerChars: 0,
    };

    const planner = await openai.chat.completions.create({
      model: "gpt-4o",
      temperature: 0.1,
      messages: [{ role: "system", content: systemPrompt }, ...recentMessages],
      tools,
      tool_choice: "required",
    });
    const planningMessage = planner.choices[0]?.message;
    if (!planningMessage?.tool_calls?.length) {
      return new Response("The requested analysis could not be selected.", { status: 422 });
    }

    const toolMessages: OpenAI.Chat.Completions.ChatCompletionToolMessageParam[] = [];
    for (const call of planningMessage.tool_calls) {
      if (call.type !== "function") continue;
      const args = JSON.parse(call.function.arguments || "{}");
      if (BENCHMARK_LOG_ENABLED) {
        benchmarkTurn.toolCalls.push({
          function: call.function.name,
          arguments: args,
          rawArguments: call.function.arguments || "{}",
        });
      }
      let result: unknown;
      try {
        switch (call.function.name) {
          case "get_error_dataset_overview":
            result = await convex.query(api.analysis.getErrorDatasetOverview, {});
            break;
          case "get_question_error_profile":
            result = await convex.query(api.analysis.getQuestionErrorProfile, args);
            break;
          case "get_student_error_profile":
            result = await convex.query(api.analysis.getStudentErrorProfile, args);
            break;
          case "get_error_examples":
            result = await convex.query(api.analysis.getErrorExamples, args);
            break;
          case "get_support_priority_students":
            result = await convex.query(api.analysis.getSupportPriorityStudents, args);
            break;
          case "compare_question_errors":
            result = await convex.query(api.analysis.compareQuestionErrors, args);
            break;
          case "compare_seed_variants":
            result = await convex.query(api.analysis.compareSeedVariants, args);
            break;
          case "get_question_indices":
            result = await convex.query(api.analysis.getQuestionIndices, args);
            break;
          default:
            result = { error: `Unsupported analysis function: ${call.function.name}` };
        }
      } catch (error) {
        benchmarkTurn.error = error instanceof Error ? error.message : String(error);
        benchmarkTurn.answer = `Error: ${benchmarkTurn.error}`;
        benchmarkTurn.answerChars = benchmarkTurn.answer.length;
        await writeBenchmarkRecord(benchmarkTurn);
        throw error;
      }
      const serialised = JSON.stringify(result);
      toolMessages.push({ role: "tool", tool_call_id: call.id, content: serialised });

      if (BENCHMARK_LOG_ENABLED) {
        const oversized = serialised.length > MAX_LOGGED_RESULT_CHARS;
        benchmarkTurn.toolResults.push({
          function: call.function.name,
          result: oversized ? serialised.slice(0, MAX_LOGGED_RESULT_CHARS) : result,
          truncated: oversized,
        });
      }
    }

    const stream = await openai.chat.completions.create({
      model: "gpt-4o",
      temperature: 0.2,
      stream: true,
      messages: [
        { role: "system", content: systemPrompt },
        ...recentMessages,
        planningMessage,
        ...toolMessages,
      ],
    });

    const encoder = new TextEncoder();
    const readable = new ReadableStream({
      async start(controller) {
        let answer = "";
        try {
          for await (const chunk of stream) {
            const content = chunk.choices[0]?.delta?.content ?? "";
            if (content) {
              if (BENCHMARK_LOG_ENABLED) answer += content;
              controller.enqueue(encoder.encode(content));
            }
          }
        } catch (error) {
          benchmarkTurn.error = error instanceof Error ? error.message : String(error);
          benchmarkTurn.answer = answer;
          benchmarkTurn.answerChars = answer.length;
          void writeBenchmarkRecord(benchmarkTurn);
          controller.error(error);
          return;
        }
        benchmarkTurn.answer = answer;
        benchmarkTurn.answerChars = answer.length;
        void writeBenchmarkRecord(benchmarkTurn);
        controller.close();
      },
    });
    return new Response(readable, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown server error";
    console.error("[/api/chat]", message);
    return new Response(message, { status: 500 });
  }
}
