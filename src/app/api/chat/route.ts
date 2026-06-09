import OpenAI from "openai";

const MAX_CONTEXT_CHARS = 80_000;

export async function POST(req: Request) {
  try {
    const { messages, documents, studentSummary } = await req.json();

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return new Response(
        "OPENAI_API_KEY is not set in the server environment. Add it to .env.local.",
        { status: 500 }
      );
    }

    // Build context sections
    const contextSections: string[] = [];

    if (studentSummary) {
      const safe = studentSummary.length > MAX_CONTEXT_CHARS
        ? studentSummary.slice(0, MAX_CONTEXT_CHARS) + "\n\n[Dataset truncated due to size]"
        : studentSummary;
      contextSections.push(`## Student Dataset\n${safe}`);
    }

    if (Array.isArray(documents) && documents.length > 0) {
      const docContext = documents
        .map((d: { name: string; text: string }) => `File: ${d.name}\nContent: ${d.text}`)
        .join("\n\n---\n\n");
      const safe = docContext.length > MAX_CONTEXT_CHARS
        ? docContext.slice(0, MAX_CONTEXT_CHARS) + "\n\n[Document content truncated]"
        : docContext;
      contextSections.push(`## Uploaded Documents\n${safe}`);
    }

    const systemPrompt = contextSections.length > 0
      ? `You are a helpful educational assistant specialising in Newman's Error Analysis (NEA).
Use the data below to answer questions. Be specific — reference actual student IDs, grades, error types, and summaries from the dataset.
If information is not in the data, say so clearly.

${contextSections.join("\n\n")}`
      : `You are a helpful educational assistant specialising in Newman's Error Analysis (NEA).
Answer questions to the best of your knowledge.`;

    const openaiClient = new OpenAI({ apiKey });

    const stream = await openaiClient.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemPrompt },
        ...messages,
      ],
      temperature: 0.3,
      stream: true,
    });

    const encoder = new TextEncoder();
    const readable = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of stream) {
            const text = chunk.choices[0]?.delta?.content ?? "";
            if (text) controller.enqueue(encoder.encode(text));
          }
        } finally {
          controller.close();
        }
      },
    });

    return new Response(readable, {
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });

  } catch (error: any) {
    const message = error?.message ?? "Unknown server error";
    console.error("[/api/chat]", message);
    return new Response(message, { status: 500 });
  }
}
