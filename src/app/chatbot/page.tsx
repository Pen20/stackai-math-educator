"use client";

import React from "react";
import SimpleRAG from "@/components/dashboard/simple-rag";
import { Bot, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export default function ChatbotPage() {
  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 bg-slate-50/30 min-h-screen">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/dashboard">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div className="p-2 bg-indigo-600 rounded-lg">
            <Bot className="text-white h-6 w-6" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            AI Assistant
          </h1>
        </div>
      </header>

      <main>
        <SimpleRAG />
      </main>

      <footer className="text-center text-slate-400 text-xs py-10">
        Structured STACK calculations from Convex with evidence-grounded GPT-4o interpretation.
      </footer>
    </div>
  );
}
