import { useState, useRef, useEffect } from "react";
import { Send, Loader2, User, Play, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import ReactMarkdown from "react-markdown";

interface Message {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: Date;
}

interface StreamChunk {
  type: "text" | "thinking" | "tool_use" | "tool_result" | "done" | "error";
  content?: string;
  toolName?: string;
  toolInput?: Record<string, any>;
  toolResult?: string;
}

function EliasAvatar({ size = "sm" }: { size?: "sm" | "lg" }) {
  const cls = size === "lg"
    ? "h-9 w-9 sm:h-10 sm:w-10"
    : "h-7 w-7 sm:h-8 sm:w-8";
  return (
    <Avatar className={`${cls} shrink-0 border-2 border-blue-300`}>
      <AvatarFallback className="bg-gradient-to-br from-blue-600 to-cyan-500 text-white font-bold text-xs">
        EO
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
        code: ({ children, className }) => {
          const isBlock = className?.includes("language-");
          if (isBlock) {
            return (
              <pre className={`rounded-lg p-3 my-2 text-xs overflow-x-auto ${isUser ? "bg-blue-700/50" : "bg-muted"}`}>
                <code>{children}</code>
              </pre>
            );
          }
          return (
            <code className={`px-1.5 py-0.5 rounded text-xs font-mono ${isUser ? "bg-blue-700/50" : "bg-muted"}`}>
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

const STEPS = [
  { key: "data", label: "Datos" },
  { key: "calc", label: "Cálculo" },
  { key: "avail", label: "Disponibilidad" },
  { key: "book", label: "Confirmación" },
];

function ProgressStepper({ currentStep }: { currentStep: number }) {
  if (currentStep < 0) return null;
  return (
    <div className="px-3 sm:px-6 py-1.5 bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm border-b border-blue-100 dark:border-gray-700 shrink-0">
      <div className="max-w-3xl mx-auto flex items-center gap-0">
        {STEPS.map((step, i) => (
          <div key={step.key} className="flex items-center flex-1 last:flex-none">
            <div className="flex flex-col items-center gap-0.5">
              <div className={`w-5 h-5 sm:w-6 sm:h-6 rounded-full flex items-center justify-center text-[10px] sm:text-xs font-bold transition-all duration-300 ${
                i < currentStep ? "bg-blue-500 text-white" :
                i === currentStep ? "bg-blue-500 text-white animate-pulse ring-2 ring-blue-300" :
                "bg-gray-200 dark:bg-gray-600 text-gray-500 dark:text-gray-400"
              }`}>
                {i < currentStep ? "✓" : i + 1}
              </div>
              <span className={`text-[9px] sm:text-[10px] font-medium whitespace-nowrap ${
                i <= currentStep ? "text-blue-600 dark:text-blue-400" : "text-gray-400 dark:text-gray-500"
              }`}>{step.label}</span>
            </div>
            {i < STEPS.length - 1 && (
              <div className={`flex-1 h-0.5 mx-1 rounded transition-all duration-300 ${
                i < currentStep ? "bg-blue-500" : "bg-gray-200 dark:bg-gray-600"
              }`} />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function ChatPublic() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "assistant",
      content: "Hola, soy Elías, del almacén de Centro Hogar Sánchez. ¿En qué te puedo ayudar? Si necesitas programar una entrega, dime qué traes y buscamos hueco.",
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [showVideo, setShowVideo] = useState(false);
  const [chatStep, setChatStep] = useState(-1);
  const [sessionId] = useState(() => `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`);
  const scrollRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
    }
  }, [messages]);

  const sendMessage = async () => {
    if (!input.trim() || isStreaming) return;

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: "user",
      content: input.trim(),
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsStreaming(true);
    if (chatStep < 0) setChatStep(0);

    const assistantMessageId = `assistant-${Date.now()}`;
    const assistantMessage: Message = {
      id: assistantMessageId,
      role: "assistant",
      content: "",
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, assistantMessage]);

    try {
      abortControllerRef.current = new AbortController();

      const response = await fetch("/api/chat/message", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          sessionId,
          message: userMessage.content,
        }),
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        throw new Error("No response body");
      }

      let buffer = "";
      let assistantText = "";

      while (true) {
        const { done, value } = await reader.read();

        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.trim() === "") continue;
          if (line === "data: [DONE]") continue;

          if (line.startsWith("data: ")) {
            try {
              const chunk: StreamChunk = JSON.parse(line.slice(6));

              if (chunk.type === "tool_use" && chunk.toolName) {
                if (chunk.toolName === "calculator") setChatStep(1);
                else if (chunk.toolName === "calendar_availability") setChatStep(2);
                else if (chunk.toolName === "calendar_book") setChatStep(3);
              }

              if (chunk.type === "text" && chunk.content) {
                assistantText += chunk.content;
                setMessages((prev) =>
                  prev.map((msg) =>
                    msg.id === assistantMessageId
                      ? { ...msg, content: assistantText }
                      : msg
                  )
                );
              } else if (chunk.type === "error" && chunk.content) {
                setMessages((prev) =>
                  prev.map((msg) =>
                    msg.id === assistantMessageId
                      ? { ...msg, content: chunk.content || "Error desconocido" }
                      : msg
                  )
                );
              }
            } catch {
            }
          }
        }
      }
    } catch (error) {
      if ((error as Error).name !== "AbortError") {
        const errorMessage = error instanceof Error ? error.message : "Error desconocido";
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantMessageId
              ? { ...msg, content: `Error: ${errorMessage}` }
              : msg
          )
        );
      }
    } finally {
      setIsStreaming(false);
      abortControllerRef.current = null;
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="h-dvh flex flex-col bg-gradient-to-br from-blue-50 via-white to-cyan-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      {/* Compact header */}
      <div className="bg-gradient-to-r from-blue-600 via-blue-500 to-cyan-500 px-3 sm:px-6 py-2.5 sm:py-3 shadow-lg shrink-0">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <img
              src="/logo-sanchez.png"
              alt="Centro Hogar Sanchez"
              className="h-8 sm:h-10 w-auto"
              data-testid="img-logo"
            />
            <div className="min-w-0">
              <h1 className="text-sm sm:text-base font-bold text-white truncate">Sistema de Reservas</h1>
              <p className="text-[10px] sm:text-xs text-blue-100 truncate">Centro Hogar Sánchez</p>
            </div>
          </div>
          <Button
            variant="secondary"
            size="sm"
            className="shrink-0 bg-white/20 hover:bg-white/30 text-white border-0 text-xs sm:text-sm gap-1.5"
            onClick={() => setShowVideo(true)}
          >
            <Play className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Ver tutorial</span>
            <span className="sm:hidden">Tutorial</span>
          </Button>
        </div>
      </div>

      {/* Chat area — fills remaining viewport */}
      <Card className="flex-1 flex flex-col overflow-hidden rounded-none sm:rounded-2xl sm:mx-4 sm:my-3 sm:mb-4 shadow-xl border-0 sm:border sm:border-blue-200 min-h-0">
        {/* Chat header with Elías info */}
        <div className="bg-gradient-to-r from-blue-600 via-blue-500 to-cyan-500 p-2.5 sm:p-3 border-b border-blue-700 shrink-0">
          <div className="flex items-center gap-2 sm:gap-3">
            <EliasAvatar size="lg" />
            <div className="flex-1 min-w-0">
              <h2 className="text-sm sm:text-base font-semibold text-white truncate">Elías Ortega</h2>
              <p className="text-[10px] sm:text-xs text-blue-100">Asistente de Almacén</p>
            </div>
            <Badge variant="secondary" className="bg-green-500 text-white border-0 text-[10px] sm:text-xs px-2 py-0.5">
              En línea
            </Badge>
          </div>
        </div>

        <ProgressStepper currentStep={chatStep} />

        {/* Messages area */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 sm:p-4 md:p-6 min-h-0">
          <div className="space-y-3 sm:space-y-4 max-w-3xl mx-auto">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex gap-2 sm:gap-3 ${msg.role === "user" ? "justify-end chat-bubble-user" : "justify-start chat-bubble-agent"}`}
                data-testid={`message-${msg.role}-${msg.id}`}
              >
                {msg.role === "assistant" && <EliasAvatar />}
                <div
                  className={`max-w-[85%] sm:max-w-[75%] md:max-w-[70%] rounded-2xl px-3 sm:px-4 py-2 sm:py-3 shadow-md ${
                    msg.role === "user"
                      ? "bg-gradient-to-r from-blue-600 to-blue-500 text-white rounded-tr-sm"
                      : "bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 border border-gray-200 dark:border-gray-700 rounded-tl-sm"
                  }`}
                >
                  {msg.role === "assistant" ? (
                    <MarkdownContent content={msg.content} isUser={false} />
                  ) : (
                    <p className="whitespace-pre-wrap break-words leading-relaxed text-sm sm:text-base">{msg.content}</p>
                  )}
                  <p className={`text-xs mt-1 sm:mt-2 ${msg.role === "user" ? "text-blue-100" : "text-muted-foreground"}`}>
                    {msg.timestamp.toLocaleTimeString("es-ES", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
                {msg.role === "user" && (
                  <Avatar className="h-7 w-7 sm:h-8 sm:w-8 shrink-0 mt-1">
                    <AvatarFallback className="bg-blue-600 text-white">
                      <User className="h-3 w-3 sm:h-4 sm:w-4" />
                    </AvatarFallback>
                  </Avatar>
                )}
              </div>
            ))}
            {isStreaming && messages[messages.length - 1]?.content === "" && (
              <div className="flex justify-start gap-2 sm:gap-3 chat-bubble-agent">
                <EliasAvatar />
                <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl rounded-tl-sm px-3 sm:px-4 py-2 sm:py-3 shadow-md">
                  <div className="flex items-center gap-2">
                    <div className="flex gap-1.5">
                      <span className="w-2 h-2 bg-blue-400 rounded-full dot-bounce" style={{animationDelay: "0ms"}} />
                      <span className="w-2 h-2 bg-blue-400 rounded-full dot-bounce" style={{animationDelay: "0.2s"}} />
                      <span className="w-2 h-2 bg-blue-400 rounded-full dot-bounce" style={{animationDelay: "0.4s"}} />
                    </div>
                    <span className="text-xs sm:text-sm text-muted-foreground">Elías está escribiendo...</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Input area — sticky at bottom */}
        <div className="p-2.5 sm:p-4 border-t bg-gray-50/80 dark:bg-gray-900/80 backdrop-blur-sm shrink-0">
          <div className="flex gap-2 sm:gap-3 items-end max-w-3xl mx-auto">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Escribe tu mensaje aquí..."
              className="resize-none min-h-[44px] sm:min-h-[52px] max-h-[120px] rounded-xl border-gray-300 focus-visible:ring-blue-500 text-sm sm:text-base"
              disabled={isStreaming}
              data-testid="input-message"
            />
            <Button
              onClick={sendMessage}
              disabled={!input.trim() || isStreaming}
              size="icon"
              className="shrink-0 h-[44px] w-[44px] sm:h-[52px] sm:w-[52px] rounded-xl bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-700 hover:to-cyan-600 text-white shadow-md"
              aria-label="Enviar mensaje"
              data-testid="button-send"
            >
              {isStreaming ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Send className="h-5 w-5" />
              )}
            </Button>
          </div>
          <p className="text-[10px] text-muted-foreground mt-1.5 text-center hidden sm:block">
            Presiona Enter para enviar · Shift+Enter para nueva línea
          </p>
        </div>
      </Card>

      {/* Video tutorial modal */}
      <Dialog open={showVideo} onOpenChange={setShowVideo}>
        <DialogContent className="max-w-3xl p-0 overflow-hidden bg-black border-0">
          <DialogTitle className="sr-only">Tutorial de uso</DialogTitle>
          <div className="relative">
            <Button
              variant="ghost"
              size="icon"
              className="absolute top-2 right-2 z-10 text-white hover:bg-white/20 rounded-full"
              onClick={() => setShowVideo(false)}
            >
              <X className="h-5 w-5" />
            </Button>
            <video
              controls
              autoPlay
              preload="metadata"
              className="w-full aspect-video"
              data-testid="video-tutorial"
            >
              <source src="/tutorial-video.mp4" type="video/mp4" />
              Tu navegador no soporta la reproducción de videos.
            </video>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
