"use client";

import React, { useState, useRef } from "react";
import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { FileUp, Send, Trash2, FileText, Loader2, Bot, User } from "lucide-react";
import { Id } from "../../../convex/_generated/dataModel";
import ReactMarkdown from "react-markdown";

export default function SimpleRAG() {
  const [isUploading, setIsUploading] = useState(false);
  const [question, setQuestion] = useState("");
  const [history, setHistory] = useState<{ role: "user" | "assistant"; content: string }[]>([]);
  const [isChatting, setIsChatting] = useState(false);

  const documents = useQuery(api.rag.simple.listDocuments);
  const ingest = useMutation(api.rag.simple.ingest);
  const deleteDoc = useMutation(api.rag.simple.deleteDocument);
  const chat = useAction(api.rag.simpleActions.chat);

  const scrollRef = useRef<HTMLDivElement>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const text = await file.text();
      await ingest({ name: file.name, text });
    } catch (error) {
      console.error("Upload failed:", error);
      alert("Failed to upload document.");
    } finally {
      setIsUploading(false);
      e.target.value = "";
    }
  };

  const handleChat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!question.trim() || isChatting) return;

    const userMessage = { role: "user" as const, content: question };
    setHistory(prev => [...prev, userMessage]);
    setQuestion("");
    setIsChatting(true);

    try {
      const response = await chat({ question, chatHistory: history });
      setHistory(prev => [...prev, { role: "assistant" as const, content: response }]);
    } catch (error: any) {
      console.error("Chat failed:", error);
      const errorMessage = error instanceof Error ? error.message : "Could not get a response.";
      setHistory(prev => [...prev, { role: "assistant" as const, content: `Error: ${errorMessage}` }]);
    } finally {
      setIsChatting(false);
      setTimeout(() => {
        scrollRef.current?.scrollIntoView({ behavior: "smooth" });
      }, 100);
    }
  };

  const handleDelete = async (name: string) => {
    if (confirm(`Are you sure you want to delete "${name}"?`)) {
      await deleteDoc({ name });
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Side Panel: Document Management */}
      <Card className="lg:col-span-1 border-slate-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-blue-600" />
            Your Documents
          </CardTitle>
          <CardDescription>
            Documents uploaded here will be used as context for the chat.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
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

          <ScrollArea className="h-[300px] pr-4">
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
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDelete(doc.name)}
                    className="h-8 w-8 text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              {documents?.length === 0 && (
                <p className="text-xs text-center text-slate-400 py-8">
                  No documents yet. Upload one to start.
                </p>
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Main Panel: Chat Interface */}
      <Card className="lg:col-span-2 border-slate-200 flex flex-col h-[600px]">
        <CardHeader className="border-b">
          <CardTitle className="text-lg flex items-center gap-2">
            <Bot className="h-5 w-5 text-indigo-600" />
            Context-Aware Assistant
          </CardTitle>
          <CardDescription>
            GPT-4o will answer based on your uploaded documents.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex-1 flex flex-col p-0 overflow-hidden">
          <ScrollArea className="flex-1 p-4">
            <div className="space-y-4">
              {history.length === 0 && (
                <div className="flex flex-col items-center justify-center h-full py-20 text-slate-400 space-y-2">
                  <Bot className="h-12 w-12 opacity-20" />
                  <p className="text-sm">Ask a question about your documents!</p>
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
                    <div className="markdown-content">
                      <ReactMarkdown>
                        {msg.content}
                      </ReactMarkdown>
                    </div>
                  </div>
                </div>
              ))}
              <div ref={scrollRef} />
            </div>
          </ScrollArea>

          <div className="p-4 border-t bg-slate-50/50">
            <form onSubmit={handleChat} className="flex gap-2">
              <Input
                placeholder={documents?.length ? "Ask something about your docs..." : "Upload a doc first..."}
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                disabled={isChatting || !documents?.length}
                className="bg-white"
              />
              <Button type="submit" disabled={isChatting || !question.trim() || !documents?.length} className="bg-indigo-600 hover:bg-indigo-700">
                {isChatting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </Button>
            </form>
            <p className="text-[10px] text-slate-400 mt-2 text-center">
              Powered by GPT-4o with long-context retrieval.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
