import { useState, useRef, useEffect } from "react";
import { Send, Loader2, Bot, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

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

export default function ChatPublic() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "assistant",
      content: "¡Hola! Soy Elías Ortega, tu asistente del almacén Centro Hogar Sanchez. ¿En qué puedo ayudarte hoy? Puedo ayudarte a programar una cita de entrega.",
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [sessionId] = useState(() => `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`);
  const scrollRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
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
            } catch (e) {
              console.error("Error parsing SSE chunk:", e);
            }
          }
        }
      }
    } catch (error) {
      console.error("Chat error:", error);
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      console.error("Chat error details:", { errorMessage, errorName: (error as Error)?.name });
      
      if ((error as Error).name !== "AbortError") {
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
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-cyan-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 pb-6">
      <div className="container mx-auto px-2 sm:px-4 py-3 sm:py-6 flex flex-col max-w-6xl gap-3 sm:gap-4">
        {/* Hero Header */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-xl sm:rounded-2xl shadow-xl p-4 sm:p-6 md:p-8 text-center">
          <img
            src="/logo-sanchez.png"
            alt="Centro Hogar Sanchez"
            className="max-w-[150px] sm:max-w-[200px] mx-auto mb-3 sm:mb-4 h-auto"
            data-testid="img-logo"
          />
          <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-white mb-1 sm:mb-2">Sistema de Reservas de Citas</h1>
          <p className="text-blue-100 text-sm sm:text-base md:text-lg">Programa tu entrega con nuestro asistente virtual Elías</p>
        </div>

        {/* Video Preview */}
        <div className="w-full">
          <div className="aspect-video rounded-xl sm:rounded-2xl overflow-hidden shadow-xl border-2 border-blue-200 bg-black">
            <video
              controls
              preload="metadata"
              className="w-full h-full"
              data-testid="video-tutorial"
            >
              <source src="/tutorial-video.mp4" type="video/mp4" />
              Tu navegador no soporta la reproducción de videos.
            </video>
          </div>
        </div>

        {/* Chat Container */}
        <Card className="flex flex-col overflow-hidden shadow-xl border-blue-200 min-h-[500px] sm:min-h-[600px]">
          <div className="bg-gradient-to-r from-blue-600 to-blue-700 p-3 sm:p-4 border-b border-blue-700">
            <div className="flex items-center gap-2 sm:gap-3">
              <Avatar className="h-8 w-8 sm:h-10 sm:w-10 border-2 border-white">
                <AvatarFallback className="bg-blue-500 text-white">
                  <Bot className="h-4 w-4 sm:h-6 sm:w-6" />
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <h2 className="text-base sm:text-lg font-semibold text-white truncate">Elías Ortega</h2>
                <p className="text-xs sm:text-sm text-blue-100">Asistente Virtual</p>
              </div>
              <Badge variant="secondary" className="bg-green-500 text-white border-0 text-xs sm:text-sm">
                En línea
              </Badge>
            </div>
          </div>

          <ScrollArea ref={scrollRef} className="flex-1 p-3 sm:p-4 md:p-6">
            <div className="space-y-3 sm:space-y-4">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex gap-2 sm:gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                  data-testid={`message-${msg.role}-${msg.id}`}
                >
                  {msg.role === "assistant" && (
                    <Avatar className="h-7 w-7 sm:h-8 sm:w-8 shrink-0 mt-1">
                      <AvatarFallback className="bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400">
                        <Bot className="h-3 w-3 sm:h-4 sm:w-4" />
                      </AvatarFallback>
                    </Avatar>
                  )}
                  <div
                    className={`max-w-[85%] sm:max-w-[75%] md:max-w-[70%] rounded-2xl px-3 sm:px-4 py-2 sm:py-3 shadow-sm ${
                      msg.role === "user"
                        ? "bg-blue-600 text-white rounded-tr-sm"
                        : "bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 border border-gray-200 dark:border-gray-700 rounded-tl-sm"
                    }`}
                  >
                    <p className="whitespace-pre-wrap break-words leading-relaxed text-sm sm:text-base">{msg.content}</p>
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
              {isStreaming && (
                <div className="flex justify-start gap-2 sm:gap-3">
                  <Avatar className="h-7 w-7 sm:h-8 sm:w-8 shrink-0 mt-1">
                    <AvatarFallback className="bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400">
                      <Bot className="h-3 w-3 sm:h-4 sm:w-4" />
                    </AvatarFallback>
                  </Avatar>
                  <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl rounded-tl-sm px-3 sm:px-4 py-2 sm:py-3 shadow-sm">
                    <div className="flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
                      <span className="text-xs sm:text-sm text-muted-foreground">Elías está escribiendo...</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>

          <div className="p-3 sm:p-4 border-t bg-gray-50 dark:bg-gray-900">
            <div className="flex gap-2 sm:gap-3 items-end">
              <Textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Escribe tu mensaje aquí..."
                className="resize-none min-h-[50px] sm:min-h-[60px] rounded-xl border-gray-300 focus-visible:ring-blue-500 text-sm sm:text-base"
                disabled={isStreaming}
                data-testid="input-message"
              />
              <Button
                onClick={sendMessage}
                disabled={!input.trim() || isStreaming}
                size="icon"
                className="shrink-0 rounded-xl bg-blue-600 hover:bg-blue-700"
                aria-label="Enviar mensaje"
                data-testid="button-send"
              >
                {isStreaming ? (
                  <Loader2 className="h-4 w-4 sm:h-5 sm:w-5 animate-spin" />
                ) : (
                  <Send className="h-4 w-4 sm:h-5 sm:w-5" />
                )}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-2 text-center hidden sm:block">
              Presiona Enter para enviar • Shift+Enter para nueva línea
            </p>
          </div>
        </Card>
      </div>
    </div>
  );
}
