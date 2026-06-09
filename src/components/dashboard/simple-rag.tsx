"use client";

import React, { useState, useRef, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { FileUp, Send, Trash2, FileText, Loader2, Bot, User, AlertCircle, RotateCcw } from "lucide-react";
import ReactMarkdown from "react-markdown";

type Message = { role: "user" | "assistant"; content: string };

export default function SimpleRAG() {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [question, setQuestion] = useState("");
  const [history, setHistory] = useState<Message[]>([]);
  const [isChatting, setIsChatting] = useState(false);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const documents       = useQuery(api.rag.simple.listDocuments);
  const savedMessages   = useQuery(api.chat.getMessages);
  const studentSummary  = useQuery(api.analysis.getDataSummary);    // sidebar display
  const studentContext  = useQuery(api.analysis.getDetailedContext); // full data for AI
  const ingest          = useMutation(api.rag.simple.ingest);
  const deleteDoc     = useMutation(api.rag.simple.deleteDocument);
  const saveMessage   = useMutation(api.chat.saveMessage);
  const clearHistory  = useMutation(api.chat.clearHistory);

  // Load persisted messages once on mount
  useEffect(() => {
    if (!historyLoaded && savedMessages !== undefined) {
      setHistory(savedMessages.map(m => ({ role: m.role, content: m.content })));
      setHistoryLoaded(true);
    }
  }, [savedMessages, historyLoaded]);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [history]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadError(null);
    setIsUploading(true);
    try {
      const text = await file.text();
      await ingest({ name: file.name, text });
    } catch (error: any) {
      console.error("Upload failed:", error);
      setUploadError("Failed to upload document. Please try again.");
    } finally {
      setIsUploading(false);
      e.target.value = "";
    }
  };

  const handleChat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!question.trim() || isChatting) return;

    const userMessage: Message = { role: "user", content: question };
    const updatedHistory = [...history, userMessage];
    setHistory(updatedHistory);
    setQuestion("");
    setIsChatting(true);

    // Save user message to Convex
    await saveMessage({ role: "user", content: userMessage.content });

    // Fetch all document chunks for context
    const allDocs = await fetchAllDocumentChunks();

    // Add a streaming placeholder for the assistant reply
    setHistory(prev => [...prev, { role: "assistant", content: "" }]);

    let assistantContent = "";
    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: updatedHistory.map(m => ({ role: m.role, content: m.content })),
          documents: allDocs,
          studentSummary: studentContext ?? null,
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
        setHistory(prev => {
          const updated = [...prev];
          updated[updated.length - 1] = { role: "assistant", content: assistantContent };
          return updated;
        });
      }

      // Save completed assistant message
      await saveMessage({ role: "assistant", content: assistantContent });
    } catch (error: any) {
      const msg = error instanceof Error ? error.message : "Could not get a response.";
      setHistory(prev => {
        const updated = [...prev];
        updated[updated.length - 1] = { role: "assistant", content: `Error: ${msg}` };
        return updated;
      });
    } finally {
      setIsChatting(false);
    }
  };

  const handleClearHistory = async () => {
    if (!confirm("Clear all conversation history?")) return;
    await clearHistory();
    setHistory([]);
    setHistoryLoaded(false);
  };

  const handleDelete = async (name: string) => {
    if (confirm(`Delete "${name}"?`)) await deleteDoc({ name });
  };

  // Fetch all chunks belonging to the user's documents for context injection
  const fetchAllDocumentChunks = async (): Promise<{ name: string; text: string }[]> => {
    if (!documents || documents.length === 0) return [];
    // documents already contains the chunk data from listDocuments
    // For context we use the search-retrieved chunks (already handled in API route via summary)
    // Here we return the visible document list metadata only — full text sent via searchDocuments
    return [];
  };

  const hasContext = !!documents?.length || !!studentSummary;
  const canChat = !isChatting && question.trim().length > 0 && hasContext;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Side Panel */}
      <Card className="lg:col-span-1 border-slate-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-blue-600" />
            Context Sources
          </CardTitle>
          <CardDescription>
            The AI uses your uploaded dataset and any documents below.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">

          {/* Student data status */}
          {studentSummary && (
            <div className="text-xs bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 text-blue-700 space-y-0.5">
              <p className="font-semibold">Student dataset auto-loaded</p>
              <p className="text-blue-600 whitespace-pre-line">{studentSummary}</p>
            </div>
          )}

          {/* Document upload */}
          <div className="space-y-2">
            <div className="relative">
              <input
                type="file"
                accept=".txt,.md,.csv"
                onChange={handleFileUpload}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                disabled={isUploading}
              />
              <Button variant="outline" className="w-full gap-2" disabled={isUploading}>
                {isUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileUp className="h-4 w-4" />}
                {isUploading ? "Uploading..." : "Upload Context File"}
              </Button>
            </div>
            {uploadError && (
              <div className="flex items-center gap-2 text-xs text-red-600 bg-red-50 border border-red-200 rounded-md px-2 py-1.5">
                <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                {uploadError}
              </div>
            )}
          </div>

          <ScrollArea className="h-[200px] pr-4">
            <div className="space-y-2">
              {documents?.map((doc: any) => (
                <div key={doc.name} className="flex items-center justify-between p-2 rounded-md bg-slate-50 border border-slate-100 group">
                  <div className="flex items-center gap-2 overflow-hidden">
                    <FileText className="h-4 w-4 text-slate-400 shrink-0" />
                    <div className="flex flex-col min-w-0">
                      <span className="text-sm truncate font-medium text-slate-700">{doc.name}</span>
                      {doc.chunkCount > 1 && (
                        <span className="text-[10px] text-slate-400">{doc.chunkCount} chunks</span>
                      )}
                    </div>
                  </div>
                  <Button
                    variant="ghost" size="icon"
                    onClick={() => handleDelete(doc.name)}
                    className="h-8 w-8 text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              {documents?.length === 0 && !studentSummary && (
                <p className="text-xs text-center text-slate-400 py-8">
                  Upload a document or add student data to start chatting.
                </p>
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Chat Panel */}
      <Card className="lg:col-span-2 border-slate-200 flex flex-col h-[600px]">
        <CardHeader className="border-b flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              <Bot className="h-5 w-5 text-indigo-600" />
              AI Assistant
            </CardTitle>
            <CardDescription>
              GPT-4o with your dataset and documents as context.
            </CardDescription>
          </div>
          {history.length > 0 && (
            <Button
              variant="ghost" size="sm"
              onClick={handleClearHistory}
              className="gap-1.5 text-slate-400 hover:text-red-500 text-xs"
            >
              <RotateCcw className="h-3.5 w-3.5" /> Clear history
            </Button>
          )}
        </CardHeader>

        <CardContent className="flex-1 flex flex-col p-0 overflow-hidden">
          <ScrollArea className="flex-1 p-4">
            <div className="space-y-4">
              {history.length === 0 && (
                <div className="flex flex-col items-center justify-center h-full py-20 text-slate-400 space-y-2">
                  <Bot className="h-12 w-12 opacity-20" />
                  <p className="text-sm">
                    {studentSummary
                      ? "Your student dataset is loaded. Ask anything about it!"
                      : "Upload a document or your dataset to get started."}
                  </p>
                </div>
              )}
              {history.map((msg, i) => (
                <div key={i} className={`flex gap-3 ${msg.role === "user" ? "flex-row-reverse" : ""}`}>
                  <div className={`p-2 rounded-full h-8 w-8 flex items-center justify-center shrink-0 ${
                    msg.role === "user" ? "bg-blue-100 text-blue-600" : "bg-indigo-100 text-indigo-600"
                  }`}>
                    {msg.role === "user" ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
                  </div>
                  <div className={`p-3 rounded-2xl max-w-[80%] text-sm ${
                    msg.role === "user"
                      ? "bg-blue-600 text-white rounded-tr-none"
                      : "bg-slate-100 text-slate-800 rounded-tl-none border border-slate-200"
                  }`}>
                    {msg.role === "assistant" && msg.content === "" && isChatting
                      ? <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
                      : <div className="markdown-content prose prose-sm max-w-none">
                          <ReactMarkdown>{msg.content}</ReactMarkdown>
                        </div>
                    }
                  </div>
                </div>
              ))}
              <div ref={scrollRef} />
            </div>
          </ScrollArea>

          <div className="p-4 border-t bg-slate-50/50">
            <form onSubmit={handleChat} className="flex gap-2">
              <Input
                placeholder={
                  !studentSummary && !documents?.length
                    ? "Upload a document or dataset first..."
                    : "Ask a question..."
                }
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                disabled={isChatting || !hasContext}
                className="bg-white"
              />
              <Button
                type="submit"
                disabled={!canChat}
                className="bg-indigo-600 hover:bg-indigo-700"
              >
                {isChatting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </Button>
            </form>
            <p className="text-[10px] text-slate-400 mt-2 text-center">
              Powered by GPT-4o · Responses stream in real-time
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
