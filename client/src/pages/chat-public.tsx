import { useState, useRef, useEffect } from "react";
import { Send, Loader2, Video, ChevronDown, ChevronUp, PlayCircle, Bot, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import tutorialVideoUrl from "@assets/tutorial-video.mp4";

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
  const [isTutorialOpen, setIsTutorialOpen] = useState(() => {
    if (typeof window !== 'undefined') {
      return window.innerWidth >= 768;
    }
    return true;
  });
  const scrollRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isVideoDialogOpen, setIsVideoDialogOpen] = useState(false);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 768 && !isTutorialOpen) {
        setIsTutorialOpen(true);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [isTutorialOpen]);

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
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-cyan-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      <div className="container mx-auto px-4 py-6 h-screen flex flex-col max-w-4xl">
        {/* Hero Header */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-2xl shadow-xl mb-4 p-8 text-center">
          <img
            src="/logo-sanchez.png"
            alt="Centro Hogar Sanchez"
            className="max-w-[200px] mx-auto mb-4 h-auto"
            data-testid="img-logo"
          />
          <h1 className="text-3xl font-bold text-white mb-2">Sistema de Reservas de Citas</h1>
          <p className="text-blue-100 text-lg">Programa tu entrega con nuestro asistente virtual Elías</p>
        </div>

        {/* Tutorial Section */}
        <Collapsible
          open={isTutorialOpen}
          onOpenChange={setIsTutorialOpen}
          className="mb-4"
        >
          <Card className="overflow-hidden shadow-lg border-blue-200">
            <CollapsibleTrigger className="w-full" data-testid="button-toggle-tutorial">
              <CardHeader className="cursor-pointer hover-elevate active-elevate-2 transition-colors">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="bg-blue-100 dark:bg-blue-900 p-2 rounded-lg">
                      <Video className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div className="text-left">
                      <CardTitle className="text-lg">Tutorial de Uso</CardTitle>
                      <CardDescription>Aprende a reservar tu cita en 2 minutos</CardDescription>
                    </div>
                  </div>
                  {isTutorialOpen ? (
                    <ChevronUp className="h-5 w-5 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="h-5 w-5 text-muted-foreground" />
                  )}
                </div>
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent className="pt-0 pb-6">
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Mira este breve video para aprender cómo utilizar nuestro sistema de reservas. Te explicaremos paso a paso cómo programar tu entrega de forma rápida y sencilla.
                  </p>
                  
                  <Dialog open={isVideoDialogOpen} onOpenChange={setIsVideoDialogOpen}>
                    <DialogTrigger asChild>
                      <Button 
                        variant="outline" 
                        className="w-full gap-2 h-auto py-4 border-2 border-blue-200 hover:border-blue-400"
                        data-testid="button-open-video"
                      >
                        <PlayCircle className="h-5 w-5" />
                        <span className="font-semibold">Ver Tutorial Completo</span>
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-4xl p-0">
                      <DialogHeader className="p-6 pb-4">
                        <DialogTitle>Tutorial: Cómo Reservar tu Cita</DialogTitle>
                        <DialogDescription>
                          Aprende a usar el sistema de reservas del almacén Centro Hogar Sanchez
                        </DialogDescription>
                      </DialogHeader>
                      <div className="px-6 pb-6">
                        <div className="aspect-video rounded-lg overflow-hidden bg-black">
                          {isVideoDialogOpen && (
                            <video
                              ref={videoRef}
                              controls
                              preload="metadata"
                              className="w-full h-full"
                              data-testid="video-tutorial"
                            >
                              <source src={tutorialVideoUrl} type="video/mp4" />
                              Tu navegador no soporta la reproducción de videos.
                            </video>
                          )}
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>

        {/* Chat Container */}
        <Card className="flex-1 flex flex-col overflow-hidden shadow-xl border-blue-200">
          <div className="bg-gradient-to-r from-blue-600 to-blue-700 p-4 border-b border-blue-700">
            <div className="flex items-center gap-3">
              <Avatar className="h-10 w-10 border-2 border-white">
                <AvatarFallback className="bg-blue-500 text-white">
                  <Bot className="h-6 w-6" />
                </AvatarFallback>
              </Avatar>
              <div>
                <h2 className="text-lg font-semibold text-white">Elías Ortega</h2>
                <p className="text-sm text-blue-100">Asistente Virtual</p>
              </div>
              <Badge variant="secondary" className="ml-auto bg-green-500 text-white border-0">
                En línea
              </Badge>
            </div>
          </div>

          <ScrollArea ref={scrollRef} className="flex-1 p-4 md:p-6">
            <div className="space-y-4">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                  data-testid={`message-${msg.role}-${msg.id}`}
                >
                  {msg.role === "assistant" && (
                    <Avatar className="h-8 w-8 shrink-0 mt-1">
                      <AvatarFallback className="bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400">
                        <Bot className="h-4 w-4" />
                      </AvatarFallback>
                    </Avatar>
                  )}
                  <div
                    className={`max-w-[75%] md:max-w-[70%] rounded-2xl px-4 py-3 shadow-sm ${
                      msg.role === "user"
                        ? "bg-blue-600 text-white rounded-tr-sm"
                        : "bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 border border-gray-200 dark:border-gray-700 rounded-tl-sm"
                    }`}
                  >
                    <p className="whitespace-pre-wrap break-words leading-relaxed">{msg.content}</p>
                    <p className={`text-xs mt-2 ${msg.role === "user" ? "text-blue-100" : "text-muted-foreground"}`}>
                      {msg.timestamp.toLocaleTimeString("es-ES", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                  {msg.role === "user" && (
                    <Avatar className="h-8 w-8 shrink-0 mt-1">
                      <AvatarFallback className="bg-blue-600 text-white">
                        <User className="h-4 w-4" />
                      </AvatarFallback>
                    </Avatar>
                  )}
                </div>
              ))}
              {isStreaming && (
                <div className="flex justify-start gap-3">
                  <Avatar className="h-8 w-8 shrink-0 mt-1">
                    <AvatarFallback className="bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400">
                      <Bot className="h-4 w-4" />
                    </AvatarFallback>
                  </Avatar>
                  <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm">
                    <div className="flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
                      <span className="text-sm text-muted-foreground">Elías está escribiendo...</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>

          <div className="p-4 border-t bg-gray-50 dark:bg-gray-900">
            <div className="flex gap-3 items-end">
              <Textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Escribe tu mensaje aquí..."
                className="resize-none min-h-[60px] rounded-xl border-gray-300 focus-visible:ring-blue-500"
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
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <Send className="h-5 w-5" />
                )}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-2 text-center">
              Presiona Enter para enviar • Shift+Enter para nueva línea
            </p>
          </div>
        </Card>
      </div>
    </div>
  );
}
