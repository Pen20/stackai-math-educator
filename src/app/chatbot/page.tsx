"use client";
import { useState } from "react";
import { useAction, useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { Bot, User, Send, Loader2, Trash2 } from "lucide-react";

export default function NEA_Chatbot() {
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  

  // Use new 'messages' file for DB operations
  const messages = useQuery(api.messages.listMessages) as { role: "user" | "assistant"; content: string }[] | undefined || [];
  const save = useMutation(api.messages.saveMessage);
  const clear = useMutation(api.messages.clearHistory);

  // Keep askAi on 'chat' file
  const askAi = useAction(api.chat.askAi);

  const handleSend = async () => {
    if (!input.trim() || isTyping) return;

    const userText = input;
    // Clear input immediately to give user feedback
    setInput("");
    setIsTyping(true);

    // Explicitly type the history array to satisfy TypeScript build
    const history: { role: "user" | "assistant"; content: string }[] = [
      ...messages.slice(-6).map(m => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      })),
      { role: "user", content: userText },
    ];

    try {
      await save({ role: "user", content: userText });

      const response = await askAi({
        prompt: userText,
        history,
      });

      await save({ role: "assistant", content: response });
    } catch (e) {
      console.error("Chat Error:", e);
      await save({
        role: "assistant",
        content: "⚠️ Something went wrong. Please check your inputs or try again.",
      });
    } finally {
      setIsTyping(false);
    }
  };

  const handleClearChat = async () => {
    if (confirm("Are you sure you want to clear the chat history?")) {
      await clear();
    }
  };

  // Placeholder for user avatar if not using Clerk's <UserButton> directly inside chat
  // We can just use the generic User icon or try to get user image url if needed.
  
  return (
    <div className="flex flex-col h-[calc(100dvh-70px)] md:h-[calc(100vh-140px)] w-full max-w-5xl mx-auto md:my-8 border-0 md:border md:rounded-2xl shadow-none md:shadow-xl bg-white overflow-hidden relative">
      {/* Header */}
      <div className="p-4 border-b bg-slate-50/50 flex items-center justify-between backdrop-blur-sm sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 bg-blue-100 rounded-full flex items-center justify-center border border-blue-200 shadow-sm">
            <Bot className="h-6 w-6 text-blue-600" />
          </div>
          <div>
            <h2 className="font-bold text-lg text-slate-800">NEA Diagnostic Assistant</h2>
            <p className="text-xs text-slate-500 font-medium">Powered by AI & Student Data</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-xs text-slate-400 bg-slate-100 px-2 py-1 rounded-full border">
            Online
          </div>
          <Button variant="ghost" size="icon" onClick={handleClearChat} className="text-slate-400 hover:text-red-500">
             <Trash2 className="h-5 w-5" />
          </Button>
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 overflow-y-auto p-4 md:p-6 bg-slate-50/30">
        <div className="space-y-6">
          {messages.length === 0 && (
             <div className="flex flex-col items-center justify-center h-full text-center p-8 mt-10">
                <div className="h-16 w-16 bg-blue-50 rounded-full flex items-center justify-center mb-4">
                  <Bot className="h-8 w-8 text-blue-500" />
                </div>
                <h3 className="text-lg font-semibold text-slate-700">How can I help you today?</h3>
                <p className="text-sm text-slate-500 max-w-md mt-2">
                  Ask me about student errors, misconceptions, or request specific interventions based on the NEA error categories.
                </p>
             </div>
          )}

          {messages.map((m, i) => (
            <div key={i} className={`flex gap-4 ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              
              {/* AI Avatar */}
              {m.role === 'assistant' && (
                <div className="h-8 w-8 min-w-[32px] bg-white border border-slate-200 rounded-full flex items-center justify-center shadow-sm">
                  <Bot className="h-5 w-5 text-blue-600" />
                </div>
              )}

              {/* Message Bubble */}
              <div 
                className={`p-4 rounded-2xl shadow-sm text-sm leading-relaxed max-w-[80%] 
                  ${m.role === 'user' 
                    ? 'bg-blue-600 text-white rounded-tr-none' 
                    : 'bg-white border border-slate-200 text-slate-700 rounded-tl-none'
                  }`}
              >
                <div className="whitespace-pre-wrap">{m.content}</div>
              </div>

              {/* User Avatar */}
              {m.role === 'user' && (
                <div className="h-8 w-8 min-w-[32px] bg-slate-100 border border-slate-200 rounded-full flex items-center justify-center shadow-sm">
                  <User className="h-5 w-5 text-slate-600" />
                </div>
              )}
            </div>
          ))}

          {/* Typing Indicator */}
          {isTyping && (
            <div className="flex gap-4 justify-start">
               <div className="h-8 w-8 min-w-[32px] bg-white border border-slate-200 rounded-full flex items-center justify-center shadow-sm">
                  <Bot className="h-5 w-5 text-blue-600" />
               </div>
               <div className="bg-white border border-slate-200 p-4 rounded-2xl rounded-tl-none shadow-sm flex items-center gap-2">
                 <span className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                 <span className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                 <span className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
               </div>
            </div>
          )}
        </div>
      </div>

      {/* Input Area */}
      <div className="p-4 bg-white border-t border-slate-100 mt-auto">
        <div className="relative flex items-center gap-2 max-w-4xl mx-auto">
          <Input 
            value={input} 
            onChange={(e) => setInput(e.target.value)} 
            placeholder="Type your question regarding student analysis..." 
            className="pr-12 py-6 text-base shadow-sm border-slate-200 focus-visible:ring-blue-500 rounded-xl"
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
            disabled={isTyping}
          />
          <Button 
            onClick={handleSend} 
            disabled={isTyping || !input.trim()} 
            size="icon"
            className={`absolute right-2 h-10 w-10 rounded-lg transition-all
              ${input.trim() ? 'bg-blue-600 hover:bg-blue-700 shadow-md' : 'bg-slate-200 text-slate-400'}`}
          >
            {isTyping ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
          </Button>
        </div>
        <p className="text-center text-[10px] text-slate-400 mt-2">
          AI can make mistakes. Please verify important information.
        </p>
      </div>
    </div>
  );
}
