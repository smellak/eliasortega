import { useState, useRef, useEffect, useCallback } from "react";
import {
  Send, Loader2, User, Volume2, VolumeX, Clock, Truck, MessageCircle,
  ChevronDown, Play, RotateCcw, ArrowDown, Copy, Check, ThumbsUp, ThumbsDown,
  Square, MapPin, Phone, Mail, ExternalLink, WifiOff, CheckCheck, Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";
import ReactMarkdown from "react-markdown";
import { useNotificationSound } from "@/hooks/use-notification-sound";
import { ThemeToggle } from "@/components/theme-toggle";

/* ═══════════════════════════════════════════════════════════════
   CONSTANTS
   ═══════════════════════════════════════════════════════════════ */

const MAX_MESSAGE_LENGTH = 1000;
const SESSION_STORAGE_KEY = "elias-chat-session";
const SESSION_TTL_MS = 24 * 60 * 60 * 1000; // 24h

const QUICK_SUGGESTIONS = [
  { label: "Reservar cita de descarga", icon: Truck },
  { label: "Consultar horarios", icon: Clock },
  { label: "Tengo una consulta", icon: MessageCircle },
];

const STEPS = [
  { key: "data", label: "Datos" },
  { key: "calc", label: "Cálculo" },
  { key: "avail", label: "Disponibilidad" },
  { key: "book", label: "Confirmación" },
];

const CONTEXTUAL_TYPING: Record<string, string> = {
  calculator: "Elías está calculando...",
  calendar_availability: "Elías está consultando el calendario...",
  calendar_book: "Elías está reservando tu cita...",
};

const WELCOME_TEXT =
  "¡Hola! Soy Elías, del almacén de Centro Hogar Sánchez. ¿En qué puedo ayudarte? Si necesitas programar una entrega, dime qué traes y buscamos hueco.";

/* ═══════════════════════════════════════════════════════════════
   TYPES
   ═══════════════════════════════════════════════════════════════ */

interface Message {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: Date;
  status?: "sending" | "sent" | "delivered";
  feedback?: "up" | "down" | null;
}

interface StreamChunk {
  type: "text" | "thinking" | "tool_use" | "tool_result" | "done" | "error";
  content?: string;
  toolName?: string;
  toolInput?: Record<string, any>;
  toolResult?: string;
}

/* ═══════════════════════════════════════════════════════════════
   SESSION PERSISTENCE (#13)
   ═══════════════════════════════════════════════════════════════ */

function loadSession(): { messages: Message[]; sessionId: string } | null {
  try {
    const raw = localStorage.getItem(SESSION_STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (Date.now() - data.savedAt > SESSION_TTL_MS) {
      localStorage.removeItem(SESSION_STORAGE_KEY);
      return null;
    }
    return {
      messages: data.messages.map((m: any) => ({
        ...m,
        timestamp: new Date(m.timestamp),
      })),
      sessionId: data.sessionId,
    };
  } catch {
    return null;
  }
}

function saveSession(messages: Message[], sessionId: string) {
  try {
    localStorage.setItem(
      SESSION_STORAGE_KEY,
      JSON.stringify({ messages, sessionId, savedAt: Date.now() }),
    );
  } catch {
    /* storage full — ignore */
  }
}

/* ═══════════════════════════════════════════════════════════════
   HOOKS
   ═══════════════════════════════════════════════════════════════ */

/** #17 — Offline detection */
function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== "undefined" ? navigator.onLine : true,
  );
  useEffect(() => {
    const on = () => setIsOnline(true);
    const off = () => setIsOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);
  return isOnline;
}

/** #6 — Detect compact landscape (mobile in landscape with limited height) */
function useCompactLandscape() {
  const [compact, setCompact] = useState(false);
  useEffect(() => {
    const check = () =>
      setCompact(window.innerHeight < 500 && window.innerWidth > window.innerHeight);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);
  return compact;
}

/* ═══════════════════════════════════════════════════════════════
   SUB-COMPONENTS
   ═══════════════════════════════════════════════════════════════ */

/** #3 — Avatar with photo support + fallback */
function EliasAvatar({ size = "sm" }: { size?: "sm" | "lg" | "xl" }) {
  const cls =
    size === "xl"
      ? "h-16 w-16"
      : size === "lg"
        ? "h-9 w-9 sm:h-10 sm:w-10"
        : "h-7 w-7 sm:h-8 sm:w-8";
  return (
    <Avatar className={`${cls} shrink-0 border-2 border-blue-300 shadow-md`}>
      <AvatarImage src="/elias-avatar.png" alt="Elías Ortega" />
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
        p: ({ children }) => (
          <p className="mb-2 last:mb-0 leading-relaxed text-sm sm:text-base">{children}</p>
        ),
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
              <pre
                className={`rounded-lg p-3 my-2 text-xs overflow-x-auto ${isUser ? "bg-blue-700/50" : "bg-muted"}`}
              >
                <code>{children}</code>
              </pre>
            );
          }
          return (
            <code
              className={`px-1.5 py-0.5 rounded text-xs font-mono ${isUser ? "bg-blue-700/50" : "bg-muted"}`}
            >
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

function ProgressStepper({ currentStep }: { currentStep: number }) {
  if (currentStep < 0) return null;
  return (
    <div className="px-3 sm:px-6 py-1.5 bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm border-b border-blue-100 dark:border-gray-700 shrink-0">
      <div className="max-w-3xl mx-auto flex items-center gap-0">
        {STEPS.map((step, i) => (
          <div key={step.key} className="flex items-center flex-1 last:flex-none">
            <div className="flex flex-col items-center gap-0.5">
              <div
                className={`w-5 h-5 sm:w-6 sm:h-6 rounded-full flex items-center justify-center text-[10px] sm:text-xs font-bold transition-all duration-300 ${
                  i < currentStep
                    ? "bg-blue-500 text-white"
                    : i === currentStep
                      ? "bg-blue-500 text-white animate-pulse ring-2 ring-blue-300"
                      : "bg-gray-200 dark:bg-gray-600 text-gray-500 dark:text-gray-400"
                }`}
              >
                {i < currentStep ? "✓" : i + 1}
              </div>
              <span
                className={`text-[9px] sm:text-[10px] font-medium whitespace-nowrap ${
                  i <= currentStep ? "text-blue-600 dark:text-blue-400" : "text-gray-400 dark:text-gray-500"
                }`}
              >
                {step.label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div
                className={`flex-1 h-0.5 mx-1 rounded transition-all duration-300 ${
                  i < currentStep ? "bg-blue-500" : "bg-gray-200 dark:bg-gray-600"
                }`}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/** #5 — Welcome card for initial state */
function WelcomeCard({ onSuggestion }: { onSuggestion: (text: string) => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-6 sm:py-10 animate-fadeIn">
      <EliasAvatar size="xl" />
      <h2 className="mt-4 text-lg sm:text-xl font-bold text-gray-900 dark:text-white">
        Elías Ortega
      </h2>
      <p className="text-sm text-muted-foreground mt-1">
        Asistente de Almacén · Centro Hogar Sánchez
      </p>

      <div className="mt-5 max-w-md mx-auto bg-white dark:bg-gray-800 rounded-2xl p-4 sm:p-5 shadow-md border border-gray-200 dark:border-gray-700 text-center">
        <p className="text-sm sm:text-base text-gray-700 dark:text-gray-200 leading-relaxed">
          {WELCOME_TEXT}
        </p>
      </div>

      {/* #2 — Quick suggestions */}
      <div className="mt-5 flex flex-wrap justify-center gap-2 px-4">
        {QUICK_SUGGESTIONS.map((s) => (
          <button
            key={s.label}
            onClick={() => onSuggestion(s.label)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-full border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 text-sm font-medium hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-all hover:scale-[1.02] active:scale-[0.98]"
            data-testid={`button-suggestion-${s.label.slice(0, 10).toLowerCase().replace(/\s/g, "-")}`}
          >
            <s.icon className="h-4 w-4" />
            {s.label}
          </button>
        ))}
      </div>

      <p className="mt-5 text-xs text-muted-foreground animate-pulse">
        Escribe tu mensaje abajo ↓
      </p>
    </div>
  );
}

/** #14 — Scroll-to-bottom floating action button */
function ScrollToBottomFAB({ visible, onClick }: { visible: boolean; onClick: () => void }) {
  if (!visible) return null;
  return (
    <button
      onClick={onClick}
      className="absolute bottom-20 right-4 z-10 h-9 w-9 rounded-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-lg flex items-center justify-center hover:bg-gray-50 dark:hover:bg-gray-700 transition-all animate-fadeIn"
      aria-label="Ir al último mensaje"
      data-testid="button-scroll-bottom"
    >
      <ArrowDown className="h-4 w-4 text-gray-600 dark:text-gray-300" />
    </button>
  );
}

/** #17 — Offline banner */
function OfflineBanner() {
  return (
    <div className="bg-amber-500 text-white text-xs text-center py-1.5 px-3 flex items-center justify-center gap-2 shrink-0 animate-fadeIn">
      <WifiOff className="h-3.5 w-3.5" />
      <span>Sin conexión — reconectando...</span>
    </div>
  );
}

/** #19 — Copy button for messages */
function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard not available */
    }
  }, [text]);

  return (
    <button
      onClick={handleCopy}
      className="p-1 rounded hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
      aria-label="Copiar mensaje"
      title="Copiar"
    >
      {copied ? (
        <Check className="h-3.5 w-3.5 text-green-500" />
      ) : (
        <Copy className="h-3.5 w-3.5 text-muted-foreground" />
      )}
    </button>
  );
}

/** #26 — Feedback buttons */
function FeedbackButtons({
  feedback,
  onFeedback,
}: {
  feedback: "up" | "down" | null | undefined;
  onFeedback: (value: "up" | "down") => void;
}) {
  return (
    <div className="flex items-center gap-0.5">
      <button
        onClick={() => onFeedback("up")}
        className={`p-1 rounded transition-colors ${
          feedback === "up"
            ? "text-green-500"
            : "text-muted-foreground hover:bg-black/5 dark:hover:bg-white/10 hover:text-green-500"
        }`}
        aria-label="Respuesta útil"
        title="Útil"
      >
        <ThumbsUp className="h-3.5 w-3.5" />
      </button>
      <button
        onClick={() => onFeedback("down")}
        className={`p-1 rounded transition-colors ${
          feedback === "down"
            ? "text-red-500"
            : "text-muted-foreground hover:bg-black/5 dark:hover:bg-white/10 hover:text-red-500"
        }`}
        aria-label="Respuesta no útil"
        title="No útil"
      >
        <ThumbsDown className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════════════════════════ */

export default function ChatPublic() {
  /* ── State ── */
  const savedSession = useRef(loadSession());
  const defaultMessages: Message[] = [
    {
      id: "welcome",
      role: "assistant",
      content: WELCOME_TEXT,
      timestamp: new Date(),
      status: "delivered",
    },
  ];

  const [messages, setMessages] = useState<Message[]>(
    savedSession.current?.messages ?? defaultMessages,
  );
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [chatStep, setChatStep] = useState(-1);
  const [currentTool, setCurrentTool] = useState<string | null>(null);
  const [sessionId] = useState(
    () => savedSession.current?.sessionId ?? `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
  );

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const { soundEnabled, toggle: toggleSound, play: playSound } = useNotificationSound();
  const isOnline = useOnlineStatus();
  const isCompactLandscape = useCompactLandscape();

  /* #14 — Scroll-to-bottom detection */
  const [showScrollFAB, setShowScrollFAB] = useState(false);

  const handleScroll = useCallback(() => {
    if (!scrollRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
    setShowScrollFAB(scrollHeight - scrollTop - clientHeight > 150);
  }, []);

  const scrollToBottom = useCallback((behavior: ScrollBehavior = "smooth") => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior });
  }, []);

  /* Auto-scroll on new messages */
  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  /* #13 — Persist session to localStorage */
  useEffect(() => {
    if (messages.length > 1) {
      saveSession(messages, sessionId);
    }
  }, [messages, sessionId]);

  /* #11 — Set document title */
  useEffect(() => {
    document.title = "Elías · Centro Hogar Sánchez";
    return () => {
      document.title = "Reserva tu cita de descarga — CentroHogar Sánchez";
    };
  }, []);

  /* #30 — Auto-focus input on mount */
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  /* ── Helpers ── */
  const hasConversation = messages.length > 1;

  /* #4 — New conversation */
  const startNewConversation = useCallback(() => {
    if (!hasConversation) return;
    if (!window.confirm("¿Iniciar una nueva conversación? Se perderá el historial actual.")) return;
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    localStorage.removeItem(SESSION_STORAGE_KEY);
    setMessages(defaultMessages);
    setIsStreaming(false);
    setChatStep(-1);
    setCurrentTool(null);
    setInput("");
    inputRef.current?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasConversation]);

  /* #26 — Handle feedback */
  const handleFeedback = useCallback(
    (messageId: string, value: "up" | "down") => {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === messageId ? { ...m, feedback: m.feedback === value ? null : value } : m,
        ),
      );
      // Fire-and-forget API call
      fetch("/api/chat/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, messageId, feedback: value }),
      }).catch(() => {});
    },
    [sessionId],
  );

  /* ── Send message ── */
  const sendMessage = async (text?: string) => {
    const messageText = (text ?? input).trim();
    if (!messageText || isStreaming) return;

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: "user",
      content: messageText,
      timestamp: new Date(),
      status: "sending",
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsStreaming(true);
    setCurrentTool(null);
    if (chatStep < 0) setChatStep(0);

    /* #25 — Mark as sent */
    setTimeout(() => {
      setMessages((prev) =>
        prev.map((m) => (m.id === userMessage.id ? { ...m, status: "sent" } : m)),
      );
    }, 300);

    const assistantMessageId = `assistant-${Date.now()}`;
    const assistantMessage: Message = {
      id: assistantMessageId,
      role: "assistant",
      content: "",
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, assistantMessage]);

    /* #25 — Mark user msg as delivered when assistant responds */
    setTimeout(() => {
      setMessages((prev) =>
        prev.map((m) => (m.id === userMessage.id ? { ...m, status: "delivered" } : m)),
      );
    }, 800);

    try {
      abortControllerRef.current = new AbortController();

      const response = await fetch("/api/chat/message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, message: messageText }),
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

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
          if (!line.startsWith("data: ")) continue;

          try {
            const chunk: StreamChunk = JSON.parse(line.slice(6));

            /* #24 — Contextual typing indicator */
            if (chunk.type === "tool_use" && chunk.toolName) {
              setCurrentTool(chunk.toolName);
              if (chunk.toolName === "calculator") setChatStep(1);
              else if (chunk.toolName === "calendar_availability") setChatStep(2);
              else if (chunk.toolName === "calendar_book") setChatStep(3);
            }

            if (chunk.type === "text" && chunk.content) {
              assistantText += chunk.content;
              setMessages((prev) =>
                prev.map((msg) =>
                  msg.id === assistantMessageId ? { ...msg, content: assistantText } : msg,
                ),
              );
            } else if (chunk.type === "error" && chunk.content) {
              setMessages((prev) =>
                prev.map((msg) =>
                  msg.id === assistantMessageId
                    ? { ...msg, content: `__ERROR__${chunk.content || "Error desconocido"}` }
                    : msg,
                ),
              );
            }
          } catch {
            /* malformed chunk — skip */
          }
        }
      }
    } catch (error) {
      if ((error as Error).name !== "AbortError") {
        const errorMessage = error instanceof Error ? error.message : "Error desconocido";
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantMessageId
              ? { ...msg, content: `__ERROR__${errorMessage}` }
              : msg,
          ),
        );
      }
    } finally {
      setIsStreaming(false);
      setCurrentTool(null);
      abortControllerRef.current = null;
      playSound();
      /* #30 — Refocus input */
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  };

  /* #18 — Retry last failed message */
  const retryLastMessage = useCallback(() => {
    const lastUserMsg = [...messages].reverse().find((m) => m.role === "user");
    if (!lastUserMsg) return;
    // Remove the error message
    setMessages((prev) => prev.slice(0, -1));
    sendMessage(lastUserMsg.content);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages]);

  /* #8 — Stop streaming */
  const stopStreaming = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  /* ── Typing indicator text (#24) ── */
  const typingText =
    currentTool && CONTEXTUAL_TYPING[currentTool]
      ? CONTEXTUAL_TYPING[currentTool]
      : "Elías está escribiendo...";

  /* ═══════════════════════════════════════════════════════════
     RENDER
     ═══════════════════════════════════════════════════════════ */

  return (
    <div className="h-dvh flex flex-col bg-gradient-to-br from-blue-50 via-white to-cyan-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">

      {/* #17 — Offline banner */}
      {!isOnline && <OfflineBanner />}

      {/* ═══════════════════════════════════════════════════════
          #1 — UNIFIED MOBILE HEADER (below lg)
          Single bar replacing the previous double header
         ═══════════════════════════════════════════════════════ */}
      <div className={`lg:hidden bg-gradient-to-r from-blue-700 via-blue-600 to-cyan-600 shadow-lg shrink-0 ${isCompactLandscape ? "px-3 py-1.5" : "px-4 py-2.5"}`}>
        <div className="flex items-center gap-2.5 min-w-0">
          <img
            src="/logo-sanchez.png"
            alt="Centro Hogar Sánchez"
            className={`${isCompactLandscape ? "h-7" : "h-8"} w-auto drop-shadow-md`}
            data-testid="img-logo"
          />
          <EliasAvatar size="sm" />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h1 className={`${isCompactLandscape ? "text-sm" : "text-sm"} font-bold text-white truncate`}>
                Elías Ortega
              </h1>
              <Badge variant="secondary" className="bg-green-500 text-white border-0 text-[9px] px-1.5 py-0 h-4 shrink-0">
                En línea
              </Badge>
            </div>
          </div>
          {/* #4 — New conversation */}
          {hasConversation && (
            <button
              onClick={startNewConversation}
              className="p-1.5 rounded-full hover:bg-white/20 transition-colors text-white/80 hover:text-white"
              aria-label="Nueva conversación"
              title="Nueva conversación"
              data-testid="button-new-conversation"
            >
              <RotateCcw className="h-4 w-4" />
            </button>
          )}
          <button
            onClick={toggleSound}
            className="p-1.5 rounded-full hover:bg-white/20 transition-colors text-white/80 hover:text-white"
            aria-label={soundEnabled ? "Silenciar" : "Activar sonido"}
            data-testid="button-sound-toggle"
          >
            {soundEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
          </button>
          <div className="[&_button]:text-white [&_button]:hover:bg-white/20 [&_button]:h-8 [&_button]:w-8">
            <ThemeToggle />
          </div>
        </div>
      </div>

      {/* #6 — Mobile collapsible video (hidden in compact landscape) */}
      {!isCompactLandscape && (
        <div className="lg:hidden shrink-0">
          <Collapsible>
            <CollapsibleTrigger asChild>
              <button className="w-full px-4 py-2 bg-blue-50 dark:bg-gray-800 border-b border-blue-100 dark:border-gray-700 flex items-center gap-2 text-sm text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-gray-700 transition-colors">
                <Play className="h-3.5 w-3.5" />
                <span>Conozca nuestro almacén</span>
                <ChevronDown className="h-3.5 w-3.5 ml-auto transition-transform [[data-state=open]>&]:rotate-180" />
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="bg-black p-2">
                <video
                  controls
                  preload="metadata"
                  className="w-full max-h-[220px] object-contain"
                  data-testid="video-tutorial-mobile"
                >
                  <source src="/tutorial-video.mp4" type="video/mp4" />
                  {/* #20 — Video captions */}
                  <track src="/tutorial-captions.vtt" kind="captions" srcLang="es" label="Español" default />
                </video>
              </div>
            </CollapsibleContent>
          </Collapsible>
        </div>
      )}

      {/* #7 — Tablet info strip (md to lg only) */}
      <div className="hidden md:flex lg:hidden items-center gap-4 px-4 py-2 bg-gradient-to-r from-slate-900 to-blue-900 text-xs text-gray-300 border-b border-blue-800 shrink-0">
        <div className="flex items-center gap-1.5">
          <Clock className="h-3.5 w-3.5 text-blue-400" />
          <span>L-V, 8:00–20:00</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Truck className="h-3.5 w-3.5 text-blue-400" />
          <span>Dime qué traes y busco hueco</span>
        </div>
        <div className="flex items-center gap-1.5">
          <MessageCircle className="h-3.5 w-3.5 text-blue-400" />
          <span>24h disponible</span>
        </div>
        {/* #22 — Back to website */}
        <a
          href="https://centrohogarsanchez.es"
          target="_blank"
          rel="noopener noreferrer"
          className="ml-auto flex items-center gap-1 text-blue-400 hover:text-blue-300 transition-colors"
        >
          <ExternalLink className="h-3 w-3" />
          <span>Web</span>
        </a>
      </div>

      {/* MAIN 2-COL LAYOUT */}
      <div className="flex-1 flex flex-col lg:flex-row min-h-0 overflow-hidden">

        {/* ═══════════════════════════════════════════════════
            LEFT PANEL (desktop lg+)
           ═══════════════════════════════════════════════════ */}
        <div className="hidden lg:flex lg:w-[460px] xl:w-[500px] flex-col shrink-0 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-blue-950 to-blue-900" />
          <div className="absolute top-20 -left-20 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl" />
          <div className="absolute bottom-32 -right-16 w-48 h-48 bg-cyan-500/10 rounded-full blur-3xl" />

          <div className="relative z-10 flex flex-col h-full p-8 overflow-y-auto">
            {/* Branding */}
            <div className="flex flex-col items-center text-center mb-8 animate-fadeIn">
              <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-5 mb-6 border border-white/10 shadow-2xl">
                <img
                  src="/logo-sanchez.png"
                  alt="Centro Hogar Sánchez"
                  className="h-20 w-auto drop-shadow-lg"
                  data-testid="img-logo-desktop"
                />
              </div>
              <h1 className="text-2xl xl:text-3xl font-bold text-white tracking-tight">
                Elías Ortega
              </h1>
              <p className="text-base text-blue-200/90 mt-1.5 font-medium">
                Asistente de Almacén
              </p>
              <Badge className="mt-4 bg-green-500/20 text-green-300 border-green-500/30 text-sm px-3 py-1">
                <span className="w-2 h-2 bg-green-400 rounded-full mr-2 animate-pulse inline-block" />
                En línea
              </Badge>
            </div>

            <div className="h-px bg-gradient-to-r from-transparent via-white/20 to-transparent my-2" />

            {/* Video with captions (#20) */}
            <div className="my-6 animate-slideUp">
              <div className="rounded-2xl overflow-hidden border border-white/10 shadow-2xl bg-black/30">
                <video
                  controls
                  preload="metadata"
                  className="w-full aspect-video"
                  data-testid="video-tutorial"
                >
                  <source src="/tutorial-video.mp4" type="video/mp4" />
                  <track src="/tutorial-captions.vtt" kind="captions" srcLang="es" label="Español" default />
                </video>
              </div>
            </div>

            {/* Info bullets */}
            <div className="space-y-4 text-sm animate-slideUp mt-2" style={{ animationDelay: "0.2s" }}>
              <div className="flex items-start gap-3 bg-white/5 rounded-xl px-4 py-3 border border-white/5">
                <Clock className="h-5 w-5 text-blue-400 mt-0.5 shrink-0" />
                <p className="text-gray-200">
                  Horario de recepción: Lunes a Viernes, 8:00 – 20:00
                </p>
              </div>
              <div className="flex items-start gap-3 bg-white/5 rounded-xl px-4 py-3 border border-white/5">
                <Truck className="h-5 w-5 text-blue-400 mt-0.5 shrink-0" />
                <p className="text-gray-200">
                  Indica qué traes y te busco hueco para la descarga
                </p>
              </div>
              <div className="flex items-start gap-3 bg-white/5 rounded-xl px-4 py-3 border border-white/5">
                <MessageCircle className="h-5 w-5 text-blue-400 mt-0.5 shrink-0" />
                <p className="text-gray-200">
                  Respondo al momento, las 24 horas del día
                </p>
              </div>
            </div>

            {/* #21 — Contact info */}
            <div className="mt-6 space-y-3 text-sm animate-slideUp" style={{ animationDelay: "0.3s" }}>
              <div className="h-px bg-gradient-to-r from-transparent via-white/15 to-transparent" />
              <div className="flex items-center gap-3 text-gray-300 hover:text-white transition-colors">
                <Phone className="h-4 w-4 text-blue-400 shrink-0" />
                <a href="tel:+34953250000" className="hover:underline">953 25 00 00</a>
              </div>
              <div className="flex items-center gap-3 text-gray-300 hover:text-white transition-colors">
                <Mail className="h-4 w-4 text-blue-400 shrink-0" />
                <a href="mailto:almacen@centrohogarsanchez.es" className="hover:underline text-xs">
                  almacen@centrohogarsanchez.es
                </a>
              </div>
              {/* #28 — Map link */}
              <div className="flex items-center gap-3 text-gray-300 hover:text-white transition-colors">
                <MapPin className="h-4 w-4 text-blue-400 shrink-0" />
                <a
                  href="https://maps.google.com/?q=Centro+Hogar+Sanchez+Jaen"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:underline"
                >
                  Ver ubicación en Google Maps
                </a>
              </div>
            </div>

            {/* Bottom: back to web + theme toggle */}
            <div className="mt-auto pt-8 flex items-center justify-between">
              {/* #22 — Back to website */}
              <a
                href="https://centrohogarsanchez.es"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-white transition-colors"
              >
                <ExternalLink className="h-4 w-4" />
                <span>Ir a la web</span>
              </a>
              <div className="[&_button]:text-gray-400 [&_button]:hover:text-white [&_button]:hover:bg-white/10">
                <ThemeToggle />
              </div>
            </div>
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════
            RIGHT PANEL: CHAT
           ═══════════════════════════════════════════════════ */}
        <div className="flex-1 flex flex-col min-h-0 min-w-0">
          <Card className="flex-1 flex flex-col overflow-hidden rounded-none shadow-xl border-0 lg:border-l lg:border-blue-200/30 dark:lg:border-gray-700 min-h-0">

            {/* Desktop chat header (lg+ only, since mobile uses unified header) */}
            <div className={`hidden lg:block bg-gradient-to-r from-blue-700 via-blue-600 to-cyan-600 p-3 sm:p-3.5 shrink-0`}>
              <div className="flex items-center gap-2 sm:gap-3">
                <EliasAvatar size="lg" />
                <div className="flex-1 min-w-0">
                  <h2 className="text-sm sm:text-base font-semibold text-white truncate">
                    Elías Ortega
                  </h2>
                  <p className="text-[10px] sm:text-xs text-blue-100">
                    Asistente de Almacén
                  </p>
                </div>
                <Badge variant="secondary" className="bg-green-500 text-white border-0 text-[10px] sm:text-xs px-2 py-0.5">
                  En línea
                </Badge>
                {/* #4 — New conversation (desktop) */}
                {hasConversation && (
                  <button
                    onClick={startNewConversation}
                    className="p-1.5 rounded-full hover:bg-white/20 transition-colors text-white/80 hover:text-white"
                    aria-label="Nueva conversación"
                    title="Nueva conversación"
                    data-testid="button-new-conversation-desktop"
                  >
                    <RotateCcw className="h-4 w-4" />
                  </button>
                )}
                <button
                  onClick={toggleSound}
                  className="p-1.5 rounded-full hover:bg-white/20 transition-colors text-white/80 hover:text-white"
                  aria-label={soundEnabled ? "Silenciar notificaciones" : "Activar notificaciones"}
                  data-testid="button-sound-toggle-desktop"
                >
                  {soundEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <ProgressStepper currentStep={chatStep} />

            {/* #16 — Chat area with subtle background pattern */}
            <div
              ref={scrollRef}
              onScroll={handleScroll}
              className="flex-1 overflow-y-auto p-3 sm:p-4 md:p-6 min-h-0 relative"
              style={{
                backgroundImage:
                  "radial-gradient(circle, hsl(214 32% 91% / 0.4) 1px, transparent 1px)",
                backgroundSize: "20px 20px",
              }}
              /* #9 — ARIA roles */
              role="log"
              aria-live="polite"
              aria-label="Mensajes del chat"
              data-testid="chat-messages"
            >
              {/* Dark mode pattern override */}
              <div
                className="hidden dark:block absolute inset-0 pointer-events-none"
                style={{
                  backgroundImage:
                    "radial-gradient(circle, hsl(215 28% 25% / 0.3) 1px, transparent 1px)",
                  backgroundSize: "20px 20px",
                }}
              />

              <div className="space-y-3 sm:space-y-4 max-w-3xl mx-auto relative">
                {/* #5 — Welcome card (initial state) or regular messages */}
                {!hasConversation ? (
                  <WelcomeCard onSuggestion={(text) => sendMessage(text)} />
                ) : (
                  messages.map((msg) => {
                    /* #18 — Error messages with retry */
                    const isError = msg.content.startsWith("__ERROR__");
                    const displayContent = isError
                      ? msg.content.replace("__ERROR__", "")
                      : msg.content;

                    return (
                      <div
                        key={msg.id}
                        className={`flex gap-2 sm:gap-3 ${
                          msg.role === "user"
                            ? "justify-end chat-bubble-user"
                            : "justify-start chat-bubble-agent"
                        }`}
                        data-testid={`message-${msg.role}-${msg.id}`}
                      >
                        {msg.role === "assistant" && <EliasAvatar />}
                        <div className="flex flex-col max-w-[85%] sm:max-w-[75%]">
                          <div
                            className={`rounded-2xl px-3 sm:px-4 py-2 sm:py-3 shadow-md ${
                              msg.role === "user"
                                ? "bg-gradient-to-r from-blue-600 to-blue-500 text-white rounded-tr-sm"
                                : isError
                                  ? "bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800 rounded-tl-sm"
                                  : "bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 border border-gray-200 dark:border-gray-700 rounded-tl-sm"
                            }`}
                          >
                            {isError ? (
                              <div className="text-sm text-red-600 dark:text-red-400">
                                <p className="mb-2">{displayContent}</p>
                                <button
                                  onClick={retryLastMessage}
                                  className="flex items-center gap-1.5 text-xs font-medium text-red-500 hover:text-red-700 dark:hover:text-red-300 transition-colors"
                                  data-testid="button-retry"
                                >
                                  <RotateCcw className="h-3.5 w-3.5" />
                                  Reintentar
                                </button>
                              </div>
                            ) : msg.role === "assistant" ? (
                              <MarkdownContent content={displayContent} isUser={false} />
                            ) : (
                              <p className="whitespace-pre-wrap break-words leading-relaxed text-sm sm:text-base">
                                {displayContent}
                              </p>
                            )}
                            {/* Timestamp + status */}
                            <div
                              className={`flex items-center gap-1.5 mt-1 sm:mt-2 ${
                                msg.role === "user" ? "justify-end" : ""
                              }`}
                            >
                              <span
                                className={`text-xs ${
                                  msg.role === "user" ? "text-blue-100" : "text-muted-foreground"
                                }`}
                              >
                                {msg.timestamp.toLocaleTimeString("es-ES", {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                              </span>
                              {/* #25 — Read confirmations */}
                              {msg.role === "user" && msg.status && (
                                <span className="text-blue-100/70">
                                  {msg.status === "sending" && (
                                    <Clock className="h-3 w-3 inline" />
                                  )}
                                  {msg.status === "sent" && (
                                    <Check className="h-3 w-3 inline" />
                                  )}
                                  {msg.status === "delivered" && (
                                    <CheckCheck className="h-3 w-3 inline" />
                                  )}
                                </span>
                              )}
                            </div>
                          </div>

                          {/* #19 + #26 — Message actions (copy, feedback) */}
                          {msg.role === "assistant" && !isError && displayContent && (
                            <div className="flex items-center gap-1 mt-1 ml-1 opacity-0 group-hover:opacity-100 hover:opacity-100 [&:has(:hover)]:opacity-100 transition-opacity"
                              style={{ opacity: undefined }}
                              onMouseEnter={(e) => (e.currentTarget.style.opacity = "1")}
                              onMouseLeave={(e) => (e.currentTarget.style.opacity = "0")}
                            >
                              <CopyButton text={displayContent} />
                              <FeedbackButtons
                                feedback={msg.feedback}
                                onFeedback={(v) => handleFeedback(msg.id, v)}
                              />
                            </div>
                          )}
                        </div>
                        {msg.role === "user" && (
                          <Avatar className="h-7 w-7 sm:h-8 sm:w-8 shrink-0 mt-1">
                            <AvatarFallback className="bg-blue-600 text-white">
                              <User className="h-3 w-3 sm:h-4 sm:w-4" />
                            </AvatarFallback>
                          </Avatar>
                        )}
                      </div>
                    );
                  })
                )}

                {/* #24 — Contextual typing indicator */}
                {isStreaming && messages[messages.length - 1]?.content === "" && (
                  <div className="flex justify-start gap-2 sm:gap-3 chat-bubble-agent" aria-label={typingText}>
                    <EliasAvatar />
                    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl rounded-tl-sm px-3 sm:px-4 py-2 sm:py-3 shadow-md">
                      <div className="flex items-center gap-2">
                        <div className="flex gap-1.5">
                          <span className="w-2 h-2 bg-blue-400 rounded-full dot-bounce" style={{ animationDelay: "0ms" }} />
                          <span className="w-2 h-2 bg-blue-400 rounded-full dot-bounce" style={{ animationDelay: "0.2s" }} />
                          <span className="w-2 h-2 bg-blue-400 rounded-full dot-bounce" style={{ animationDelay: "0.4s" }} />
                        </div>
                        <span className="text-xs sm:text-sm text-muted-foreground">{typingText}</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* #14 — Scroll-to-bottom FAB */}
              <ScrollToBottomFAB visible={showScrollFAB} onClick={() => scrollToBottom()} />
            </div>

            {/* ── Input area ── */}
            <div className="p-2.5 sm:p-4 border-t bg-gray-50/80 dark:bg-gray-900/80 backdrop-blur-sm shrink-0 pb-[max(0.625rem,env(safe-area-inset-bottom))]">
              {/* #8 — Stop streaming button */}
              {isStreaming && (
                <div className="flex justify-center mb-2">
                  <button
                    onClick={stopStreaming}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-400 bg-gray-200 dark:bg-gray-700 rounded-full hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                    data-testid="button-stop-streaming"
                  >
                    <Square className="h-3 w-3 fill-current" />
                    Detener
                  </button>
                </div>
              )}
              <div className="flex gap-2 sm:gap-3 items-end max-w-3xl mx-auto">
                <div className="relative flex-1">
                  <Textarea
                    ref={inputRef}
                    value={input}
                    onChange={(e) => {
                      if (e.target.value.length <= MAX_MESSAGE_LENGTH) {
                        setInput(e.target.value);
                      }
                    }}
                    onKeyDown={handleKeyDown}
                    placeholder="Escribe tu mensaje aquí..."
                    className="resize-none min-h-[44px] sm:min-h-[52px] max-h-[120px] rounded-xl border-gray-300 focus-visible:ring-blue-500 text-sm sm:text-base pr-14"
                    disabled={isStreaming || !isOnline}
                    data-testid="input-message"
                    aria-label="Escribe tu mensaje"
                    maxLength={MAX_MESSAGE_LENGTH}
                  />
                  {/* #23 — Character counter */}
                  {input.length > MAX_MESSAGE_LENGTH * 0.8 && (
                    <span
                      className={`absolute bottom-1.5 right-2 text-[10px] ${
                        input.length >= MAX_MESSAGE_LENGTH
                          ? "text-red-500 font-bold"
                          : "text-muted-foreground"
                      }`}
                    >
                      {input.length}/{MAX_MESSAGE_LENGTH}
                    </span>
                  )}
                </div>
                <Button
                  onClick={() => sendMessage()}
                  disabled={!input.trim() || isStreaming || !isOnline}
                  size="icon"
                  className="shrink-0 h-[44px] w-[44px] sm:h-[52px] sm:w-[52px] rounded-xl bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-700 hover:to-cyan-600 text-white shadow-md active:scale-95 transition-transform"
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
              {/* #10 — Disclaimer + keyboard hint */}
              <div className="mt-1.5 text-center">
                <p className="text-[10px] text-muted-foreground hidden sm:block">
                  Presiona Enter para enviar · Shift+Enter para nueva línea
                </p>
                <p className="text-[9px] text-muted-foreground/60 mt-0.5 flex items-center justify-center gap-1">
                  <Sparkles className="h-3 w-3" />
                  Elías es un asistente de IA ·{" "}
                  <a href="https://centrohogarsanchez.es/privacidad" target="_blank" rel="noopener noreferrer" className="underline hover:text-muted-foreground">
                    Política de privacidad
                  </a>
                </p>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
