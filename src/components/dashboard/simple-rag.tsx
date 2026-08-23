"use client";

import React, { useEffect, useRef, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Bot, CheckCircle2, Database, Download, FlaskConical, Loader2, Play, RotateCcw, Send, ShieldCheck, User } from "lucide-react";
import ReactMarkdown from "react-markdown";

type Message = { role: "user" | "assistant"; content: string };
type BenchmarkQuery = {
  id: string;
  query: string;
  family: number;
  familyName: string;
  sequence: string;
  backendSupport: string;
};

const suggestedQuestions = [
  "Summarise the recorded error responses.",
  "Which NEA error categories are most common?",
  "Compare the error patterns in Q. 2 and Q. 3.",
  "Identify students with at least 4 errors across 3 questions and a mean error-response grade below 0.4.",
];

export default function SimpleRAG() {
  const { getToken } = useAuth();
  const [question, setQuestion] = useState("");
  const [history, setHistory] = useState<Message[]>([]);
  const [isChatting, setIsChatting] = useState(false);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [benchmarkQueries, setBenchmarkQueries] = useState<BenchmarkQuery[]>([]);
  const [benchmarkIndex, setBenchmarkIndex] = useState(0);
  const [benchmarkRunId, setBenchmarkRunId] = useState("");
  const [completedBenchmarkIds, setCompletedBenchmarkIds] = useState<string[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  const savedMessages = useQuery(api.chat.getMessages);
  const studentSummary = useQuery(api.analysis.getDataSummary);
  const saveMessage = useMutation(api.chat.saveMessage);
  const clearHistory = useMutation(api.chat.clearHistory);
  const latestQuestion = [...history].reverse().find((message) => message.role === "user")?.content;

  useEffect(() => {
    if (!historyLoaded && savedMessages !== undefined) {
      setHistory(savedMessages.map((message) => ({ role: message.role, content: message.content })));
      setHistoryLoaded(true);
    }
  }, [savedMessages, historyLoaded]);

  useEffect(() => {
    fetch("/api/benchmark")
      .then((response) => response.ok ? response.json() : null)
      .then((data) => setBenchmarkQueries(data?.queries ?? []))
      .catch(() => setBenchmarkQueries([]));
    const savedRun = localStorage.getItem("stack-benchmark-run");
    if (savedRun) {
      try {
        const state = JSON.parse(savedRun) as { runId: string; index: number; completed: string[] };
        setBenchmarkRunId(state.runId);
        setBenchmarkIndex(state.index);
        setCompletedBenchmarkIds(state.completed);
      } catch { localStorage.removeItem("stack-benchmark-run"); }
    }
  }, []);

  useEffect(() => {
    if (!benchmarkRunId) return;
    localStorage.setItem("stack-benchmark-run", JSON.stringify({
      runId: benchmarkRunId,
      index: benchmarkIndex,
      completed: completedBenchmarkIds,
    }));
  }, [benchmarkRunId, benchmarkIndex, completedBenchmarkIds]);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [history]);

  const submitQuestion = async (
    text: string,
    benchmarkId?: string,
    baseHistory: Message[] = history,
  ) => {
    const trimmed = text.trim();
    if (!trimmed || isChatting || !studentSummary) return;

    const userMessage: Message = { role: "user", content: trimmed };
    const updatedHistory = [...baseHistory, userMessage];
    setHistory([...updatedHistory, { role: "assistant", content: "" }]);
    setQuestion("");
    setIsChatting(true);
    // Benchmark transcripts are already recorded in local JSONL files. Keeping
    // them out of Convex avoids two writes per turn plus later deletion reads
    // and writes, while normal educator conversations remain persisted.
    if (!benchmarkId) {
      await saveMessage({ role: "user", content: trimmed });
    }

    let assistantContent = "";
    try {
      const token = await getToken({ template: "convex" });
      if (!token) throw new Error("Your session could not be authenticated. Please sign in again.");
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          ...(benchmarkId && benchmarkRunId ? { "X-Benchmark-Run-Id": benchmarkRunId } : {}),
        },
        body: JSON.stringify({
          messages: benchmarkId
            ? updatedHistory.map((message, index) => index === updatedHistory.length - 1
              ? { ...message, content: `#${benchmarkId} ${message.content}` }
              : message)
            : updatedHistory,
        }),
      });
      if (!response.ok || !response.body) {
        const detail = await response.text().catch(() => "");
        throw new Error(detail || `Server error ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        assistantContent += decoder.decode(value, { stream: true });
        setHistory((current) => {
          const next = [...current];
          next[next.length - 1] = { role: "assistant", content: assistantContent };
          return next;
        });
      }
      if (!benchmarkId) {
        await saveMessage({ role: "assistant", content: assistantContent });
      }
      if (benchmarkId) {
        setCompletedBenchmarkIds((current) => current.includes(benchmarkId) ? current : [...current, benchmarkId]);
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Could not get a response.";
      setHistory((current) => {
        const next = [...current];
        next[next.length - 1] = { role: "assistant", content: `Error: ${message}` };
        return next;
      });
      if (benchmarkId) {
        setCompletedBenchmarkIds((current) => current.includes(benchmarkId) ? current : [...current, benchmarkId]);
      }
    } finally {
      setIsChatting(false);
    }
  };

  const startBenchmark = async () => {
    setHistory([]);
    setHistoryLoaded(true);
    setBenchmarkIndex(0);
    setCompletedBenchmarkIds([]);
    setBenchmarkRunId(`run-${new Date().toISOString().replace(/[^0-9]/g, "").slice(0, 14)}-${crypto.randomUUID().slice(0, 8)}`);
  };

  const runBenchmarkQuestion = async () => {
    const item = benchmarkQueries[benchmarkIndex];
    if (!item || !benchmarkRunId || isChatting) return;
    const previous = benchmarkQueries[benchmarkIndex - 1];
    const preserveSequence = item.family === 10 && previous?.sequence && previous.sequence === item.sequence;
    const baseHistory = preserveSequence ? history : [];
    if (!preserveSequence) {
      setHistory([]);
      setHistoryLoaded(true);
    }
    await submitQuestion(item.query, item.id, baseHistory);
  };

  const downloadBenchmarkCsv = async () => {
    if (!benchmarkRunId) return;
    const response = await fetch("/api/benchmark", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ runId: benchmarkRunId }),
    });
    if (!response.ok) {
      alert(await response.text());
      return;
    }
    const url = URL.createObjectURL(await response.blob());
    const link = document.createElement("a");
    link.href = url;
    link.download = `benchmark-${benchmarkRunId}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    await submitQuestion(question);
  };

  const handleClearHistory = async () => {
    if (!confirm("Clear all conversation history?")) return;
    await clearHistory();
    setHistory([]);
    setHistoryLoaded(false);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <Card className="lg:col-span-1 border-slate-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5 text-blue-600" />
            STACK Error Dataset
          </CardTitle>
          <CardDescription>
            Structured incorrect and partially correct responses from the active dataset.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {studentSummary ? (
            <div className="text-xs bg-blue-50 border border-blue-200 rounded-lg px-3 py-3 text-blue-700 space-y-2">
              <p className="font-semibold">Dataset ready for analysis</p>
              <p className="whitespace-pre-line">{studentSummary}</p>
              <p className="border-t border-blue-200 pt-2">
                Missing student-question records are treated as fully correct responses when item indices are calculated.
              </p>
            </div>
          ) : (
            <div className="text-xs bg-amber-50 border border-amber-200 rounded-lg px-3 py-3 text-amber-700">
              Upload a transformed STACK CSV from the Dashboard before starting an analysis.
            </div>
          )}

          <div className="flex gap-2 text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
            <ShieldCheck className="h-4 w-4 shrink-0 mt-0.5" />
            <span>Numerical results are calculated by structured backend queries and then explained by the assistant.</span>
          </div>

          <div className="space-y-2">
            <p className="text-xs font-semibold text-slate-600">Example questions</p>
            {suggestedQuestions.map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                disabled={isChatting || !studentSummary}
                onClick={() => submitQuestion(suggestion)}
                className="w-full text-left text-xs rounded-lg border border-slate-200 bg-white px-3 py-2 text-slate-600 hover:border-indigo-300 hover:bg-indigo-50 disabled:opacity-50"
              >
                {suggestion}
              </button>
            ))}
          </div>

          {benchmarkQueries.length > 0 && (
            <div className="space-y-3 border-t border-slate-200 pt-4">
              <div className="flex items-center gap-2">
                <FlaskConical className="h-4 w-4 text-violet-600" />
                <p className="text-xs font-semibold text-slate-700">Mode benchmark</p>
              </div>
              {!benchmarkRunId ? (
                <Button type="button" size="sm" onClick={startBenchmark} disabled={isChatting} className="w-full bg-violet-600 hover:bg-violet-700">
                  <Play className="h-3.5 w-3.5" /> Nouveau run (111 tours)
                </Button>
              ) : (
                <>
                  <div className="rounded-lg border border-violet-200 bg-violet-50 p-3 text-xs space-y-2">
                    <div className="flex justify-between text-violet-700">
                      <span className="font-semibold">{benchmarkRunId}</span>
                      <span>{completedBenchmarkIds.length}/{benchmarkQueries.length}</span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-violet-100">
                      <div className="h-full bg-violet-600" style={{ width: `${100 * completedBenchmarkIds.length / benchmarkQueries.length}%` }} />
                    </div>
                    <p className="font-semibold text-slate-700">
                      {benchmarkQueries[benchmarkIndex]?.id} · {benchmarkQueries[benchmarkIndex]?.familyName}
                    </p>
                    <p className="text-slate-600">{benchmarkQueries[benchmarkIndex]?.query}</p>
                  </div>
                  <div className="flex gap-2">
                    <Button type="button" size="sm" onClick={runBenchmarkQuestion} disabled={isChatting || completedBenchmarkIds.includes(benchmarkQueries[benchmarkIndex]?.id)} className="flex-1 bg-violet-600 hover:bg-violet-700">
                      {isChatting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                      Exécuter
                    </Button>
                    <Button type="button" size="sm" variant="outline" onClick={() => setBenchmarkIndex((index) => Math.min(index + 1, benchmarkQueries.length - 1))} disabled={isChatting || !completedBenchmarkIds.includes(benchmarkQueries[benchmarkIndex]?.id)}>
                      Suivante
                    </Button>
                  </div>
                  <div className="flex gap-2">
                    <Button type="button" size="sm" variant="outline" onClick={() => setBenchmarkIndex((index) => Math.max(0, index - 1))} disabled={isChatting || benchmarkIndex === 0} className="flex-1">
                      Précédente
                    </Button>
                    <Button type="button" size="sm" variant="outline" onClick={downloadBenchmarkCsv} disabled={isChatting || completedBenchmarkIds.length === 0} className="flex-1">
                      <Download className="h-3.5 w-3.5" /> CSV
                    </Button>
                  </div>
                  {completedBenchmarkIds.includes(benchmarkQueries[benchmarkIndex]?.id) && (
                    <p className="flex items-center gap-1 text-xs text-emerald-700"><CheckCircle2 className="h-3.5 w-3.5" /> Tour enregistré</p>
                  )}
                  <Button type="button" size="sm" variant="ghost" onClick={startBenchmark} disabled={isChatting} className="w-full text-xs text-slate-500">
                    Recommencer avec un nouveau run
                  </Button>
                </>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="lg:col-span-2 border-slate-200 flex flex-col h-[650px] min-h-0 overflow-hidden">
        <CardHeader className="border-b flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              <Bot className="h-5 w-5 text-indigo-600" />
              STACK Analytics Assistant
            </CardTitle>
            <CardDescription>Evidence-grounded conversational analysis using Newman&apos;s Error Analysis.</CardDescription>
          </div>
          {history.length > 0 && (
            <Button variant="ghost" size="sm" onClick={handleClearHistory} className="gap-1.5 text-slate-400 hover:text-red-500 text-xs">
              <RotateCcw className="h-3.5 w-3.5" /> Clear history
            </Button>
          )}
        </CardHeader>

        {latestQuestion && (
          <div className="shrink-0 border-b border-indigo-100 bg-indigo-50 px-5 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-indigo-500">
              {isChatting ? "Question en cours" : "Dernière question"}
            </p>
            <p className="mt-1 text-sm font-medium text-slate-800">{latestQuestion}</p>
          </div>
        )}

        <CardContent className="flex-1 min-h-0 flex flex-col p-0 overflow-hidden">
          <ScrollArea type="always" className="flex-1 min-h-0">
            <div className="space-y-4 p-4 pr-6">
              {history.length === 0 && (
                <div className="flex flex-col items-center justify-center py-20 text-slate-400 space-y-2">
                  <Bot className="h-12 w-12 opacity-20" />
                  <p className="text-sm">Ask about error patterns, students, questions, seeds, or item indices.</p>
                </div>
              )}
              {history.map((message, index) => (
                <div key={index} className={`flex gap-3 ${message.role === "user" ? "flex-row-reverse" : ""}`}>
                  <div className={`p-2 rounded-full h-8 w-8 flex items-center justify-center shrink-0 ${message.role === "user" ? "bg-blue-100 text-blue-600" : "bg-indigo-100 text-indigo-600"}`}>
                    {message.role === "user" ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
                  </div>
                  <div className={`p-3 rounded-2xl max-w-[85%] text-sm ${message.role === "user" ? "bg-blue-600 text-white rounded-tr-none" : "bg-slate-100 text-slate-800 rounded-tl-none border border-slate-200"}`}>
                    {message.role === "assistant" && message.content === "" && isChatting
                      ? <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
                      : <div className="markdown-content prose prose-sm max-w-none"><ReactMarkdown>{message.content}</ReactMarkdown></div>}
                  </div>
                </div>
              ))}
              <div ref={scrollRef} />
            </div>
          </ScrollArea>

          <div className="p-4 border-t bg-slate-50/50">
            <form onSubmit={handleSubmit} className="flex gap-2">
              <Input
                placeholder={studentSummary ? "Ask a question about the STACK error dataset..." : "Upload a dataset first..."}
                value={question}
                onChange={(event) => setQuestion(event.target.value)}
                disabled={isChatting || !studentSummary}
                className="bg-white"
              />
              <Button type="submit" disabled={isChatting || !studentSummary || !question.trim()} className="bg-indigo-600 hover:bg-indigo-700">
                {isChatting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </Button>
            </form>
            <p className="text-[10px] text-slate-400 mt-2 text-center">
              Exact calculations from Convex · Educational interpretation by GPT-4o
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
