import { useState, useRef, useEffect, useCallback } from "react";
import { Send, Loader2, Bot, X, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { getAuthToken } from "@/lib/api";
import ReactMarkdown from "react-markdown";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

interface StreamChunk {
  type: "text" | "thinking" | "tool_use" | "tool_result" | "done" | "error";
  content?: string;
  toolName?: string;
}

function AIAvatar() {
  return (
    <Avatar className="h-7 w-7 shrink-0 border-2 border-violet-300">
      <AvatarFallback className="bg-gradient-to-br from-slate-700 to-violet-600 text-white font-bold text-xs">
        <Bot className="h-3.5 w-3.5" />
      </AvatarFallback>
    </Avatar>
  );
}

function MiniMarkdown({ content }: { content: string }) {
  return (
    <ReactMarkdown
      components={{
        p: ({ children }) => <p className="mb-1.5 last:mb-0 leading-relaxed text-sm">{children}</p>,
        strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
        ul: ({ children }) => <ul className="list-disc pl-4 mb-1.5 space-y-0.5 text-sm">{children}</ul>,
        ol: ({ children }) => <ol className="list-decimal pl-4 mb-1.5 space-y-0.5 text-sm">{children}</ol>,
        li: ({ children }) => <li className="text-sm">{children}</li>,
        code: ({ children, className }) => {
          if (className?.includes("language-")) {
            return <pre className="rounded p-2 my-1 text-xs overflow-x-auto bg-muted"><code>{children}</code></pre>;
          }
          return <code className="px-1 py-0.5 rounded text-xs font-mono bg-muted">{children}</code>;
        },
        a: ({ href, children }) => <a href={href} target="_blank" rel="noopener noreferrer" className="underline text-violet-600 dark:text-violet-400">{children}</a>,
      }}
    >
      {content}
    </ReactMarkdown>
  );
}

const TOOL_LABELS: Record<string, string> = {
  consultar_citas: "Buscando citas...",
  consultar_ocupacion: "Consultando ocupación...",
  consultar_proveedores: "Buscando proveedores...",
  modificar_cita: "Preparando modificación...",
  cancelar_cita: "Preparando cancelación...",
  crear_cita_manual: "Creando cita...",
  consultar_muelles: "Consultando muelles...",
  resumen_diario: "Generando resumen...",
};

export function FloatingAssistant() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "assistant",
      content: "¡Hola! Soy tu asistente. ¿En qué te ayudo?",
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [activeTool, setActiveTool] = useState<string | null>(null);
  const [sessionId] = useState(() => `float-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`);
  const scrollRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
    }
  }, [messages, activeTool]);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  const sendMessage = useCallback(async () => {
    if (!input.trim() || isStreaming) return;

    const userMsg: Message = {
      id: `user-${Date.now()}`,
      role: "user",
      content: input.trim(),
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsStreaming(true);
    setActiveTool(null);

    const assistantId = `assistant-${Date.now()}`;
    setMessages((prev) => [
      ...prev,
      { id: assistantId, role: "assistant", content: "", timestamp: new Date() },
    ]);

    try {
      abortRef.current = new AbortController();
      const token = getAuthToken();

      const response = await fetch("/api/admin-chat/message", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ sessionId, message: userMsg.content }),
        signal: abortRef.current.signal,
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      if (!reader) throw new Error("No response body");

      let buffer = "";
      let assistantText = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.trim() === "" || line === "data: [DONE]") continue;
          if (line.startsWith("data: ")) {
            try {
              const chunk: StreamChunk = JSON.parse(line.slice(6));
              if (chunk.type === "tool_use" && chunk.toolName) {
                setActiveTool(chunk.toolName);
              } else if (chunk.type === "text" && chunk.content) {
                setActiveTool(null);
                assistantText += chunk.content;
                setMessages((prev) =>
                  prev.map((m) => m.id === assistantId ? { ...m, content: assistantText } : m)
                );
              } else if (chunk.type === "error" && chunk.content) {
                setActiveTool(null);
                setMessages((prev) =>
                  prev.map((m) => m.id === assistantId ? { ...m, content: chunk.content || "Error" } : m)
                );
              } else if (chunk.type === "done") {
                setActiveTool(null);
              }
            } catch {
              // ignore
            }
          }
        }
      }
    } catch (error) {
      if ((error as Error).name !== "AbortError") {
        const msg = error instanceof Error ? error.message : "Error desconocido";
        setMessages((prev) =>
          prev.map((m) => m.id === assistantId ? { ...m, content: `Error: ${msg}` } : m)
        );
      }
    } finally {
      setIsStreaming(false);
      setActiveTool(null);
      abortRef.current = null;
    }
  }, [input, isStreaming, sessionId]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const unreadCount = 0;

  return (
    <>
      {/* FAB Button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-6 z-50 h-14 w-14 rounded-full bg-gradient-to-r from-slate-700 to-violet-600 text-white shadow-lg shadow-violet-500/30 hover:shadow-xl hover:shadow-violet-500/40 hover:scale-105 transition-all duration-200 flex items-center justify-center group"
          data-testid="fab-assistant"
          aria-label="Abrir asistente IA"
        >
          <MessageSquare className="h-6 w-6 group-hover:scale-110 transition-transform" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-red-500 text-[10px] font-bold flex items-center justify-center">
              {unreadCount}
            </span>
          )}
        </button>
      )}

      {/* Chat Panel */}
      {isOpen && (
        <div className="fixed bottom-6 right-6 z-50 w-[380px] h-[520px] rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-gray-900 flex flex-col overflow-hidden animate-in slide-in-from-bottom-4 duration-200" data-testid="floating-assistant-panel">
          {/* Header */}
          <div className="bg-gradient-to-r from-slate-800 via-slate-700 to-violet-800 p-3 shrink-0 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Avatar className="h-8 w-8 border-2 border-violet-300">
                <AvatarFallback className="bg-gradient-to-br from-slate-700 to-violet-600 text-white font-bold text-xs">
                  <Bot className="h-4 w-4" />
                </AvatarFallback>
              </Avatar>
              <div>
                <h3 className="text-sm font-semibold text-white">Asistente IA</h3>
                <p className="text-[10px] text-slate-300">Centro Hogar Sánchez</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="bg-violet-500 text-white border-0 text-[10px] px-2 py-0.5">
                En línea
              </Badge>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1 rounded-full hover:bg-white/20 transition-colors text-white/80 hover:text-white"
                data-testid="button-close-assistant"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 bg-gradient-to-b from-slate-50 to-white dark:from-gray-900 dark:to-gray-800 min-h-0">
            <div className="space-y-3">
              {messages.map((msg) => (
                <div key={msg.id} className={`flex gap-2 ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                  {msg.role === "assistant" && <AIAvatar />}
                  <div className={`max-w-[80%] rounded-xl px-3 py-2 shadow-sm ${
                    msg.role === "user"
                      ? "bg-gradient-to-r from-slate-700 to-slate-600 text-white rounded-tr-sm"
                      : "bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 border border-slate-200 dark:border-slate-700 rounded-tl-sm"
                  }`}>
                    {msg.role === "assistant" ? (
                      <MiniMarkdown content={msg.content} />
                    ) : (
                      <p className="whitespace-pre-wrap break-words text-sm">{msg.content}</p>
                    )}
                  </div>
                </div>
              ))}

              {activeTool && (
                <div className="flex gap-2 justify-start">
                  <AIAvatar />
                  <div className="bg-white dark:bg-gray-800 border border-slate-200 dark:border-slate-700 rounded-xl rounded-tl-sm px-3 py-2 shadow-sm">
                    <div className="flex items-center gap-2 text-xs text-violet-600 dark:text-violet-400">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      <span>{TOOL_LABELS[activeTool] || `Ejecutando ${activeTool}...`}</span>
                    </div>
                  </div>
                </div>
              )}

              {isStreaming && !activeTool && messages[messages.length - 1]?.content === "" && (
                <div className="flex gap-2 justify-start">
                  <AIAvatar />
                  <div className="bg-white dark:bg-gray-800 border border-slate-200 dark:border-slate-700 rounded-xl rounded-tl-sm px-3 py-2 shadow-sm">
                    <div className="flex gap-1.5">
                      <span className="w-1.5 h-1.5 bg-violet-400 rounded-full dot-bounce" style={{ animationDelay: "0ms" }} />
                      <span className="w-1.5 h-1.5 bg-violet-400 rounded-full dot-bounce" style={{ animationDelay: "0.2s" }} />
                      <span className="w-1.5 h-1.5 bg-violet-400 rounded-full dot-bounce" style={{ animationDelay: "0.4s" }} />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Input */}
          <div className="p-2.5 border-t bg-slate-50/80 dark:bg-gray-900/80 shrink-0">
            <div className="flex gap-2 items-end">
              <Textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Escribe tu pregunta..."
                className="resize-none min-h-[40px] max-h-[80px] rounded-xl border-slate-300 focus-visible:ring-violet-500 text-sm"
                disabled={isStreaming}
                data-testid="floating-chat-input"
              />
              <Button
                onClick={sendMessage}
                disabled={!input.trim() || isStreaming}
                size="icon"
                className="shrink-0 h-10 w-10 rounded-xl bg-gradient-to-r from-slate-700 to-violet-600 hover:from-slate-800 hover:to-violet-700 text-white shadow-md"
                data-testid="floating-chat-send"
              >
                {isStreaming ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
