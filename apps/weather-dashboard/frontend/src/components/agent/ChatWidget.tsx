"use client";

import { useState, useRef, useEffect } from "react";
import { MessageCircle, X, Send, Bot, User } from "lucide-react";
import { api } from "@/lib/api";
import { Spinner } from "@/components/ui/Spinner";

interface Message {
  role: "user" | "assistant";
  content: string;
}

export function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    { role: "assistant", content: "Olá! Sou o assistente climático. Posso responder perguntas sobre o clima e riscos operacionais das cidades monitoradas. Como posso ajudar?" },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const send = async () => {
    const msg = input.trim();
    if (!msg || loading) return;
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: msg }]);
    setLoading(true);
    try {
      const res = await api.post<{ reply: string }>("/agent/chat", { message: msg });
      setMessages((prev) => [...prev, { role: "assistant", content: res.reply }]);
    } catch (e: any) {
      setMessages((prev) => [...prev, { role: "assistant", content: `⚠️ Erro: ${e.message}` }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setOpen(!open)}
        className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-50 flex h-12 w-12 sm:h-14 sm:w-14 items-center justify-center rounded-full bg-teal-600 text-white shadow-lg hover:bg-teal-700 transition-colors"
        aria-label="Abrir agente climático"
      >
        {open ? <X className="h-5 w-5 sm:h-6 sm:w-6" /> : <MessageCircle className="h-5 w-5 sm:h-6 sm:w-6" />}
      </button>

      {/* Chat window */}
      {open && (
        <div
          className="fixed z-50 flex flex-col rounded-2xl bg-white shadow-2xl border border-gray-200 overflow-hidden bottom-20 right-4 left-4 sm:bottom-24 sm:right-6 sm:left-auto sm:w-96"
          style={{ maxHeight: "calc(100vh - 6rem)" }}
        >
          {/* Header */}
          <div className="flex items-center gap-3 bg-teal-600 px-4 py-3 text-white">
            <Bot className="h-5 w-5" />
            <div>
              <p className="font-semibold text-sm">Agente Climático</p>
              <p className="text-xs text-teal-100">Powered by OpenAI</p>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3" style={{ minHeight: 200 }}>
            {messages.map((m, i) => (
              <div key={i} className={`flex gap-2 ${m.role === "user" ? "flex-row-reverse" : ""}`}>
                <div className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-white ${m.role === "user" ? "bg-slate-500" : "bg-teal-600"}`}>
                  {m.role === "user" ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
                </div>
                <div className={`rounded-2xl px-3 py-2 text-sm max-w-[80%] ${m.role === "user" ? "bg-teal-600 text-white rounded-tr-sm" : "bg-gray-100 text-gray-800 rounded-tl-sm"}`}>
                  {m.content}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex gap-2">
                <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-teal-600 text-white">
                  <Bot className="h-4 w-4" />
                </div>
                <div className="rounded-2xl rounded-tl-sm bg-gray-100 px-3 py-2 flex items-center gap-2">
                  <Spinner size="sm" />
                  <span className="text-xs text-gray-500">Pensando...</span>
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div className="border-t border-gray-100 p-3 flex gap-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && send()}
              placeholder="Pergunte sobre o clima..."
              className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
              disabled={loading}
            />
            <button
              onClick={send}
              disabled={!input.trim() || loading}
              className="flex items-center justify-center rounded-lg bg-teal-600 px-3 py-2 text-white hover:bg-teal-700 disabled:opacity-50 transition-colors"
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </>
  );
}
