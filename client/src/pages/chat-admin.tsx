import { useState, useRef, useEffect } from "react";
import { Send, Loader2, Bot, Volume2, VolumeX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { getAuthToken } from "@/lib/api";
import ReactMarkdown from "react-markdown";
import { useNotificationSound } from "@/hooks/use-notification-sound";

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

function AIAvatar({ size = "sm" }: { size?: "sm" | "lg" }) {
  const cls = size === "lg" ? "h-9 w-9 sm:h-10 sm:w-10" : "h-7 w-7 sm:h-8 sm:w-8";
  return (
    <Avatar className={`${cls} shrink-0 border-2 border-blue-300`}>
      <AvatarFallback className="bg-gradient-to-br from-[#0D47A1] to-[#1565C0] text-white font-bold text-xs">
        <Bot className="h-4 w-4" />
      </AvatarFallback>
    </Avatar>
  );
}

function MarkdownContent({ content, isUser }: { content: string; isUser: boolean }) {
  return (
    <ReactMarkdown
      components={{
        p: ({ children }) => <p className="mb-2 last:mb-0 leading-relaxed text-sm sm:text-base">{children}</p>,
        strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
        em: ({ children }) => <em className="italic">{children}</em>,
        ul: ({ children }) => <ul className="list-disc pl-4 mb-2 space-y-1">{children}</ul>,
        ol: ({ children }) => <ol className="list-decimal pl-4 mb-2 space-y-1">{children}</ol>,
        li: ({ children }) => <li className="text-sm sm:text-base">{children}</li>,
        h1: ({ children }) => <h1 className="text-lg font-bold mb-2">{children}</h1>,
        h2: ({ children }) => <h2 className="text-base font-bold mb-2">{children}</h2>,
        h3: ({ children }) => <h3 className="text-sm font-bold mb-1">{children}</h3>,
        table: ({ children }) => (
          <div className="overflow-x-auto my-2">
            <table className="min-w-full text-xs border-collapse">{children}</table>
          </div>
        ),
        thead: ({ children }) => <thead className="bg-muted/50">{children}</thead>,
        th: ({ children }) => <th className="px-2 py-1 text-left font-semibold border-b">{children}</th>,
        td: ({ children }) => <td className="px-2 py-1 border-b border-muted">{children}</td>,
        code: ({ children, className }) => {
          const isBlock = className?.includes("language-");
          if (isBlock) {
            return (
              <pre className={`rounded-lg p-3 my-2 text-xs overflow-x-auto ${isUser ? "bg-slate-700/50" : "bg-muted"}`}>
                <code>{children}</code>
              </pre>
            );
          }
          return (
            <code className={`px-1.5 py-0.5 rounded text-xs font-mono ${isUser ? "bg-slate-700/50" : "bg-muted"}`}>
              {children}
            </code>
          );
        },
        a: ({ href, children }) => (
          <a href={href} target="_blank" rel="noopener noreferrer" className="underline hover:opacity-80">
            {children}
          </a>
        ),
      }}
    >
      {content}
    </ReactMarkdown>
  );
}

function ToolIndicator({ toolName }: { toolName: string }) {
  const labels: Record<string, string> = {
    consultar_citas: "Buscando citas...",
    consultar_ocupacion: "Consultando ocupación...",
    consultar_proveedores: "Buscando proveedores...",
    modificar_cita: "Preparando modificación...",
    cancelar_cita: "Preparando cancelación...",
    crear_cita_manual: "Creando cita...",
    consultar_muelles: "Consultando muelles...",
    resumen_diario: "Generando resumen...",
  };
  return (
    <div className="flex items-center gap-2 text-xs text-blue-600 dark:text-blue-400 py-1">
      <Loader2 className="h-3 w-3 animate-spin" />
      <span>{labels[toolName] || `Ejecutando ${toolName}...`}</span>
    </div>
  );
}

export default function ChatAdmin() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "assistant",
      content: "Hola, soy tu asistente de gestión. Puedo consultar citas, ocupación, proveedores, mover o cancelar citas, y explicarte como funciona cualquier parte de la app. ¿En qué te ayudo?",
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [activeTool, setActiveTool] = useState<string | null>(null);
  const [sessionId] = useState(() => `admin-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`);
  const scrollRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const { soundEnabled, toggle: toggleSound, play: playSound } = useNotificationSound();

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
    }
  }, [messages, activeTool]);

  const sendMessage = async () => {
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
                  prev.map((m) =>
                    m.id === assistantId ? { ...m, content: assistantText } : m
                  )
                );
              } else if (chunk.type === "error" && chunk.content) {
                setActiveTool(null);
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantId ? { ...m, content: chunk.content || "Error desconocido" } : m
                  )
                );
              } else if (chunk.type === "done") {
                setActiveTool(null);
              }
            } catch {
              // ignore parse errors
            }
          }
        }
      }
    } catch (error) {
      if ((error as Error).name !== "AbortError") {
        const msg = error instanceof Error ? error.message : "Error desconocido";
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId ? { ...m, content: `Error: ${msg}` } : m
          )
        );
      }
    } finally {
      setIsStreaming(false);
      setActiveTool(null);
      abortRef.current = null;
      playSound();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="h-[calc(100vh-8rem)] flex flex-col">
      <Card className="flex-1 flex flex-col overflow-hidden rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 min-h-0">
        {/* Header */}
        <div className="p-2.5 sm:p-3 shrink-0" style={{ background: 'linear-gradient(135deg, #0D47A1, #1565C0, #1976D2)' }}>
          <div className="flex items-center gap-2 sm:gap-3">
            <AIAvatar size="lg" />
            <div className="flex-1 min-w-0">
              <h2 className="text-sm sm:text-base font-semibold text-white truncate">Asistente IA</h2>
              <p className="text-[10px] sm:text-xs text-slate-300">Panel de Administración</p>
            </div>
            <Badge variant="secondary" className="bg-blue-500 text-white border-0 text-[10px] sm:text-xs px-2 py-0.5">
              En línea
            </Badge>
            <button
              onClick={toggleSound}
              className="p-1.5 rounded-full hover:bg-white/20 transition-colors text-white/80 hover:text-white"
              aria-label={soundEnabled ? "Silenciar notificaciones" : "Activar notificaciones"}
              data-testid="button-sound-toggle"
            >
              {soundEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {/* Messages */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 sm:p-4 md:p-6 min-h-0 bg-gradient-to-b from-gray-50/50 to-white dark:from-gray-900 dark:to-gray-800">
          <div className="space-y-3 sm:space-y-4 max-w-3xl mx-auto">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex gap-2 sm:gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"} chat-bubble-${msg.role === "user" ? "user" : "agent"}`}
              >
                {msg.role === "assistant" && <AIAvatar />}
                <div
                  className={`max-w-[85%] sm:max-w-[75%] md:max-w-[70%] rounded-2xl px-3 sm:px-4 py-2 sm:py-3 shadow-md ${
                    msg.role === "user"
                      ? "bg-gradient-to-r from-[#0D47A1] to-[#1565C0] text-white rounded-tr-sm"
                      : "bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 border border-gray-200 dark:border-gray-700 rounded-tl-sm"
                  }`}
                >
                  {msg.role === "assistant" ? (
                    <MarkdownContent content={msg.content} isUser={false} />
                  ) : (
                    <p className="whitespace-pre-wrap break-words leading-relaxed text-sm sm:text-base">{msg.content}</p>
                  )}
                  <p className={`text-xs mt-1 ${msg.role === "user" ? "text-slate-300" : "text-muted-foreground"}`}>
                    {msg.timestamp.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>
              </div>
            ))}

            {/* Tool activity indicator */}
            {activeTool && (
              <div className="flex gap-2 sm:gap-3 justify-start">
                <AIAvatar />
                <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl rounded-tl-sm px-3 sm:px-4 py-2 sm:py-3 shadow-md">
                  <ToolIndicator toolName={activeTool} />
                </div>
              </div>
            )}

            {/* Typing indicator */}
            {isStreaming && !activeTool && messages[messages.length - 1]?.content === "" && (
              <div className="flex justify-start gap-2 sm:gap-3">
                <AIAvatar />
                <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl rounded-tl-sm px-3 sm:px-4 py-2 sm:py-3 shadow-md">
                  <div className="flex items-center gap-2">
                    <div className="flex gap-1.5">
                      <span className="w-2 h-2 bg-blue-400 rounded-full dot-bounce" style={{ animationDelay: "0ms" }} />
                      <span className="w-2 h-2 bg-blue-400 rounded-full dot-bounce" style={{ animationDelay: "0.2s" }} />
                      <span className="w-2 h-2 bg-blue-400 rounded-full dot-bounce" style={{ animationDelay: "0.4s" }} />
                    </div>
                    <span className="text-xs sm:text-sm text-muted-foreground">Analizando...</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Input */}
        <div className="p-2.5 sm:p-4 border-t bg-gray-50/80 dark:bg-gray-900/80 backdrop-blur-sm shrink-0">
          <div className="flex gap-2 sm:gap-3 items-end max-w-3xl mx-auto">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Pregúntame sobre citas, ocupación, proveedores..."
              className="resize-none min-h-[44px] sm:min-h-[52px] max-h-[120px] rounded-xl border-gray-200 focus-visible:ring-blue-500 text-sm sm:text-base"
              disabled={isStreaming}
              data-testid="admin-chat-input"
            />
            <Button
              onClick={sendMessage}
              disabled={!input.trim() || isStreaming}
              size="icon"
              className="shrink-0 h-[44px] w-[44px] sm:h-[52px] sm:w-[52px] rounded-xl text-white shadow-md"
              style={{ background: 'linear-gradient(135deg, #1565C0, #0D47A1)' }}
              aria-label="Enviar mensaje"
              data-testid="admin-chat-send"
            >
              {isStreaming ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
