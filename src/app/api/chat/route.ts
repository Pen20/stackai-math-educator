import OpenAI from "openai";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../../convex/_generated/api";

const MAX_HISTORY_MESSAGES = 12;

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
      let result: unknown;
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
      toolMessages.push({ role: "tool", tool_call_id: call.id, content: JSON.stringify(result) });
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
        try {
          for await (const chunk of stream) {
            const content = chunk.choices[0]?.delta?.content ?? "";
            if (content) controller.enqueue(encoder.encode(content));
          }
        } catch (error) {
          controller.error(error);
          return;
        }
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
