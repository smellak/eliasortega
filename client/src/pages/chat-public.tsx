import { useState, useRef, useEffect, useCallback } from "react";
import {
  Send, Loader2, User, Volume2, VolumeX, Clock, Truck, MessageCircle,
  RotateCcw, ArrowDown, Copy, Check, ThumbsUp, ThumbsDown,
  Square, MapPin, Phone, Mail, ExternalLink, WifiOff, CheckCheck, Sparkles,
  Moon, Sun,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import ReactMarkdown from "react-markdown";
import { useNotificationSound } from "@/hooks/use-notification-sound";

/* ═══════════════════════════════════════════════════════════════
   CONSTANTS
   ═══════════════════════════════════════════════════════════════ */

const MAX_MESSAGE_LENGTH = 1000;
const SESSION_STORAGE_KEY = "elias-chat-session";
const SESSION_TTL_MS = 24 * 60 * 60 * 1000;

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
  calculator: "Calculando...",
  calendar_availability: "Consultando el calendario...",
  calendar_book: "Reservando tu cita...",
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
   SESSION PERSISTENCE
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
      messages: data.messages.map((m: any) => ({ ...m, timestamp: new Date(m.timestamp) })),
      sessionId: data.sessionId,
    };
  } catch {
    return null;
  }
}

function saveSession(messages: Message[], sessionId: string) {
  try {
    localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify({ messages, sessionId, savedAt: Date.now() }));
  } catch {}
}

/* ═══════════════════════════════════════════════════════════════
   HOOKS
   ═══════════════════════════════════════════════════════════════ */

function useThemeToggle() {
  const [theme, setThemeState] = useState<"light" | "dark">("light");
  useEffect(() => {
    const saved = localStorage.getItem("theme") as "light" | "dark" | null;
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const initial = saved || (prefersDark ? "dark" : "light");
    setThemeState(initial);
    document.documentElement.classList.toggle("dark", initial === "dark");
  }, []);
  const setTheme = useCallback((t: "light" | "dark") => {
    setThemeState(t);
    localStorage.setItem("theme", t);
    document.documentElement.classList.toggle("dark", t === "dark");
  }, []);
  return { theme, setTheme };
}

function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(typeof navigator !== "undefined" ? navigator.onLine : true);
  useEffect(() => {
    const on = () => setIsOnline(true);
    const off = () => setIsOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => { window.removeEventListener("online", on); window.removeEventListener("offline", off); };
  }, []);
  return isOnline;
}

/* ═══════════════════════════════════════════════════════════════
   SUB-COMPONENTS
   ═══════════════════════════════════════════════════════════════ */

function EliasAvatar({ size = "sm" }: { size?: "sm" | "lg" | "xl" }) {
  const cls = size === "xl" ? "h-20 w-20" : size === "lg" ? "h-10 w-10" : "h-8 w-8";
  const ring = size === "xl" ? "ring-4 ring-white/30" : "ring-2 ring-blue-100 dark:ring-blue-900";
  return (
    <Avatar className={`${cls} shrink-0 ${ring} shadow-md`}>
      <AvatarImage src="/elias-avatar.png" alt="Elías Ortega" />
      <AvatarFallback className="bg-gradient-to-br from-blue-600 to-cyan-500 text-white font-bold text-sm">EO</AvatarFallback>
    </Avatar>
  );
}

function MarkdownContent({ content, isUser }: { content: string; isUser: boolean }) {
  return (
    <ReactMarkdown
      components={{
        p: ({ children }) => <p className="mb-2 last:mb-0 leading-relaxed text-[15px]">{children}</p>,
        strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
        em: ({ children }) => <em>{children}</em>,
        ul: ({ children }) => <ul className="list-disc pl-4 mb-2 space-y-1">{children}</ul>,
        ol: ({ children }) => <ol className="list-decimal pl-4 mb-2 space-y-1">{children}</ol>,
        li: ({ children }) => <li className="text-[15px]">{children}</li>,
        h1: ({ children }) => <h1 className="text-lg font-bold mb-2">{children}</h1>,
        h2: ({ children }) => <h2 className="text-base font-bold mb-1">{children}</h2>,
        h3: ({ children }) => <h3 className="text-sm font-bold mb-1">{children}</h3>,
        code: ({ children, className }) => {
          if (className?.includes("language-")) {
            return <pre className={`rounded-lg p-3 my-2 text-xs overflow-x-auto ${isUser ? "bg-white/10" : "bg-gray-100 dark:bg-gray-700"}`}><code>{children}</code></pre>;
          }
          return <code className={`px-1.5 py-0.5 rounded text-xs font-mono ${isUser ? "bg-white/15" : "bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300"}`}>{children}</code>;
        },
        a: ({ href, children }) => (
          <a href={href} target="_blank" rel="noopener noreferrer" className={`underline underline-offset-2 ${isUser ? "text-white/90" : "text-blue-600 dark:text-blue-400"}`}>{children}</a>
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
    <div data-testid="progress-stepper" className="px-4 py-2.5 bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800 shrink-0">
      <div className="max-w-2xl mx-auto flex items-center">
        {STEPS.map((step, i) => (
          <div key={step.key} className="flex items-center flex-1 last:flex-none">
            <div className="flex flex-col items-center gap-1">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300 ${
                i < currentStep ? "bg-gradient-to-br from-blue-600 to-cyan-500 text-white shadow-md shadow-blue-500/25" :
                i === currentStep ? "bg-gradient-to-br from-blue-600 to-cyan-500 text-white ring-[3px] ring-blue-400/30 shadow-md shadow-blue-500/25" :
                "bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-500"
              }`}>
                {i < currentStep ? "✓" : i + 1}
              </div>
              <span className={`text-[10px] font-medium ${
                i <= currentStep ? "text-blue-600 dark:text-blue-400" : "text-gray-400 dark:text-gray-500"
              }`}>{step.label}</span>
            </div>
            {i < STEPS.length - 1 && (
              <div className={`flex-1 h-[2px] mx-2 rounded-full transition-colors duration-300 ${
                i < currentStep ? "bg-gradient-to-r from-blue-600 to-cyan-500" : "bg-gray-100 dark:bg-gray-800"
              }`} />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function WelcomeCard({ onSuggestion }: { onSuggestion: (text: string) => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-8 sm:py-12 animate-fadeIn px-4">
      <div className="relative">
        <div className="absolute -inset-3 bg-gradient-to-br from-blue-600/20 to-cyan-400/20 rounded-full blur-xl" />
        <EliasAvatar size="xl" />
      </div>
      <h2 className="mt-5 text-2xl font-bold text-gray-900 dark:text-white tracking-tight">Elías Ortega</h2>
      <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Asistente de Almacén</p>

      <div className="mt-6 max-w-lg bg-gradient-to-br from-blue-50 to-cyan-50/50 dark:from-blue-950/40 dark:to-cyan-950/20 rounded-2xl px-6 py-5 ring-1 ring-blue-100 dark:ring-blue-800/30 text-center">
        <p className="text-[15px] text-gray-700 dark:text-gray-300 leading-relaxed">{WELCOME_TEXT}</p>
      </div>

      <div className="mt-6 flex flex-wrap justify-center gap-2.5">
        {QUICK_SUGGESTIONS.map((s) => (
          <button
            key={s.label}
            onClick={() => onSuggestion(s.label)}
            className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-white dark:bg-gray-800 ring-1 ring-blue-200/60 dark:ring-blue-700/40 text-gray-700 dark:text-gray-300 text-sm font-medium shadow-sm hover:shadow-md hover:ring-blue-400 dark:hover:ring-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/30 transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0"
            data-testid={`button-suggestion-${s.label.slice(0, 10).toLowerCase().replace(/\s/g, "-")}`}
          >
            <s.icon className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            {s.label}
          </button>
        ))}
      </div>

      <p className="mt-8 text-xs text-gray-400 dark:text-gray-500">O escribe directamente abajo</p>
    </div>
  );
}

function ScrollToBottomFAB({ visible, onClick }: { visible: boolean; onClick: () => void }) {
  if (!visible) return null;
  return (
    <button
      onClick={onClick}
      className="absolute bottom-4 right-4 z-10 h-10 w-10 rounded-full bg-white dark:bg-gray-800 ring-1 ring-gray-200 dark:ring-gray-700 shadow-lg flex items-center justify-center hover:bg-gray-50 dark:hover:bg-gray-700 transition-all animate-fadeIn"
      aria-label="Ir al último mensaje"
      data-testid="button-scroll-bottom"
    >
      <ArrowDown className="h-4 w-4 text-gray-600 dark:text-gray-300" />
    </button>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = useCallback(async () => {
    try { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch {}
  }, [text]);

  return (
    <button onClick={handleCopy} className="p-1.5 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors" aria-label="Copiar" title="Copiar" data-testid="button-copy-message">
      {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400" />}
    </button>
  );
}

function FeedbackButtons({ feedback, onFeedback }: { feedback: "up" | "down" | null | undefined; onFeedback: (v: "up" | "down") => void }) {
  return (
    <div className="flex items-center gap-0.5">
      <button onClick={() => onFeedback("up")} className={`p-1.5 rounded-lg transition-colors ${feedback === "up" ? "text-emerald-500 bg-emerald-50 dark:bg-emerald-900/30" : "text-gray-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 hover:text-emerald-500"}`} aria-label="Útil" data-testid="button-feedback-up"><ThumbsUp className="h-3.5 w-3.5" /></button>
      <button onClick={() => onFeedback("down")} className={`p-1.5 rounded-lg transition-colors ${feedback === "down" ? "text-red-500 bg-red-50 dark:bg-red-900/30" : "text-gray-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 hover:text-red-500"}`} aria-label="No útil" data-testid="button-feedback-down"><ThumbsDown className="h-3.5 w-3.5" /></button>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   MAIN
   ═══════════════════════════════════════════════════════════════ */

export default function ChatPublic() {
  const savedSession = useRef(loadSession());
  const defaultMessages: Message[] = [{
    id: "welcome", role: "assistant", content: WELCOME_TEXT, timestamp: new Date(), status: "delivered",
  }];

  const [messages, setMessages] = useState<Message[]>(savedSession.current?.messages ?? defaultMessages);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [chatStep, setChatStep] = useState(-1);
  const [currentTool, setCurrentTool] = useState<string | null>(null);
  const [sessionId] = useState(() => savedSession.current?.sessionId ?? `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`);
  const [showScrollFAB, setShowScrollFAB] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const { soundEnabled, toggle: toggleSound, play: playSound } = useNotificationSound();
  const isOnline = useOnlineStatus();
  const { theme, setTheme } = useThemeToggle();

  const hasConversation = messages.length > 1;
  const typingText = currentTool && CONTEXTUAL_TYPING[currentTool] ? CONTEXTUAL_TYPING[currentTool] : "Escribiendo...";

  const handleScroll = useCallback(() => {
    if (!scrollRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
    setShowScrollFAB(scrollHeight - scrollTop - clientHeight > 150);
  }, []);

  const scrollToBottom = useCallback((behavior: ScrollBehavior = "smooth") => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior });
  }, []);

  useEffect(() => { scrollToBottom(); }, [messages, scrollToBottom]);
  useEffect(() => { if (messages.length > 1) saveSession(messages, sessionId); }, [messages, sessionId]);
  useEffect(() => { document.title = "Elías · Centro Hogar Sánchez"; return () => { document.title = "Reserva tu cita de descarga — CentroHogar Sánchez"; }; }, []);
  useEffect(() => { inputRef.current?.focus(); }, []);

  const toggleTheme = useCallback(() => {
    setTheme(theme === "dark" ? "light" : "dark");
  }, [theme, setTheme]);

  const startNewConversation = useCallback(() => {
    if (!hasConversation) return;
    if (!window.confirm("¿Iniciar una nueva conversación?")) return;
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    localStorage.removeItem(SESSION_STORAGE_KEY);
    setMessages(defaultMessages);
    setIsStreaming(false);
    setChatStep(-1);
    setCurrentTool(null);
    setInput("");
    inputRef.current?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasConversation]);

  const handleFeedback = useCallback((messageId: string, value: "up" | "down") => {
    setMessages((prev) => prev.map((m) => m.id === messageId ? { ...m, feedback: m.feedback === value ? null : value } : m));
    fetch("/api/chat/feedback", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sessionId, messageId, feedback: value }) }).catch(() => {});
  }, [sessionId]);

  const sendMessage = async (text?: string) => {
    const messageText = (text ?? input).trim();
    if (!messageText || isStreaming) return;

    const userMessage: Message = { id: `user-${Date.now()}`, role: "user", content: messageText, timestamp: new Date(), status: "sending" };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsStreaming(true);
    setCurrentTool(null);
    if (chatStep < 0) setChatStep(0);

    setTimeout(() => { setMessages((prev) => prev.map((m) => m.id === userMessage.id ? { ...m, status: "sent" } : m)); }, 300);

    const aId = `assistant-${Date.now()}`;
    setMessages((prev) => [...prev, { id: aId, role: "assistant", content: "", timestamp: new Date() }]);
    setTimeout(() => { setMessages((prev) => prev.map((m) => m.id === userMessage.id ? { ...m, status: "delivered" } : m)); }, 800);

    try {
      abortControllerRef.current = new AbortController();
      const response = await fetch("/api/chat/message", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, message: messageText }),
        signal: abortControllerRef.current.signal,
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      if (!reader) throw new Error("No response body");

      let buffer = "", assistantText = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";
        for (const line of lines) {
          if (!line.startsWith("data: ") || line === "data: [DONE]") continue;
          try {
            const chunk: StreamChunk = JSON.parse(line.slice(6));
            if (chunk.type === "tool_use" && chunk.toolName) {
              setCurrentTool(chunk.toolName);
              if (chunk.toolName === "calculator") setChatStep(1);
              else if (chunk.toolName === "calendar_availability") setChatStep(2);
              else if (chunk.toolName === "calendar_book") setChatStep(3);
            }
            if (chunk.type === "text" && chunk.content) {
              assistantText += chunk.content;
              setMessages((prev) => prev.map((msg) => msg.id === aId ? { ...msg, content: assistantText } : msg));
            } else if (chunk.type === "error" && chunk.content) {
              setMessages((prev) => prev.map((msg) => msg.id === aId ? { ...msg, content: `__ERROR__${chunk.content}` } : msg));
            }
          } catch {}
        }
      }
    } catch (error) {
      if ((error as Error).name !== "AbortError") {
        setMessages((prev) => prev.map((msg) => msg.id === aId ? { ...msg, content: `__ERROR__${(error as Error).message}` } : msg));
      }
    } finally {
      setIsStreaming(false);
      setCurrentTool(null);
      abortControllerRef.current = null;
      playSound();
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  };

  const retryLastMessage = useCallback(() => {
    const lastUser = [...messages].reverse().find((m) => m.role === "user");
    if (!lastUser) return;
    setMessages((prev) => prev.slice(0, -1));
    sendMessage(lastUser.content);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages]);

  const stopStreaming = useCallback(() => { abortControllerRef.current?.abort(); abortControllerRef.current = null; }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } };

  /* ═══════════════════════════════════════════════════════════
     RENDER
     ═══════════════════════════════════════════════════════════ */

  return (
    <div className="h-dvh flex flex-col bg-gray-50 dark:bg-gray-950">

      {/* Offline banner */}
      {!isOnline && (
        <div className="bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 text-xs text-center py-2 px-3 flex items-center justify-center gap-2 shrink-0 border-b border-amber-200 dark:border-amber-800">
          <WifiOff className="h-3.5 w-3.5" />
          <span>Sin conexión — reconectando...</span>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════
          MOBILE HEADER (<lg) — Blue gradient brand
         ═══════════════════════════════════════════════════ */}
      <header className="lg:hidden flex items-center gap-3 px-4 h-14 bg-gradient-to-r from-blue-600 via-blue-500 to-cyan-500 shrink-0 shadow-lg shadow-blue-500/20" data-testid="header-mobile">
        <img src="/logo-sanchez.png" alt="Centro Hogar Sánchez" className="h-7 w-auto brightness-0 invert" data-testid="img-logo" />
        <div className="min-w-0 flex-1">
          <h1 className="text-sm font-semibold text-white truncate">Elías Ortega</h1>
        </div>
        <span className="flex items-center gap-1.5 text-[10px] font-medium text-white/90 bg-white/15 backdrop-blur-sm px-2.5 py-1 rounded-full">
          <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
          En línea
        </span>
        {hasConversation && (
          <button onClick={startNewConversation} className="p-2 -mr-1 rounded-lg hover:bg-white/10 transition-colors" aria-label="Nueva conversación" data-testid="button-new-conversation">
            <RotateCcw className="h-4 w-4 text-white/80" />
          </button>
        )}
        <button onClick={toggleSound} className="p-2 rounded-lg hover:bg-white/10 transition-colors" aria-label="Sonido" data-testid="button-sound-toggle">
          {soundEnabled ? <Volume2 className="h-4 w-4 text-white/80" /> : <VolumeX className="h-4 w-4 text-white/60" />}
        </button>
        <button onClick={toggleTheme} className="p-2 rounded-lg hover:bg-white/10 transition-colors" aria-label="Tema" data-testid="button-theme-toggle-mobile">
          {theme === "dark" ? <Sun className="h-4 w-4 text-white/80" /> : <Moon className="h-4 w-4 text-white/80" />}
        </button>
      </header>

      {/* ═══════════════════════════════════════════════════
          MOBILE VIDEO — always visible (<lg)
         ═══════════════════════════════════════════════════ */}
      <div className="lg:hidden shrink-0 bg-gray-900">
        <video controls preload="metadata" className="w-full max-h-[180px] object-contain" data-testid="video-tutorial-mobile">
          <source src="/tutorial-video.mp4" type="video/mp4" />
          <track src="/tutorial-captions.vtt" kind="captions" srcLang="es" label="Español" default />
        </video>
      </div>

      {/* ═══════════════════════════════════════════════════
          MAIN LAYOUT
         ═══════════════════════════════════════════════════ */}
      <div className="flex-1 flex flex-col lg:flex-row min-h-0 overflow-hidden">

        {/* ── LEFT PANEL (lg+) — Blue gradient brand panel ── */}
        <div className="hidden lg:flex lg:w-[380px] xl:w-[420px] flex-col shrink-0 bg-gradient-to-br from-blue-600 via-blue-500 to-cyan-400 dark:from-blue-900 dark:via-blue-800 dark:to-cyan-900 overflow-hidden relative">
          {/* Decorative elements */}
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(255,255,255,0.1),transparent_60%)]" />
          <div className="absolute bottom-0 left-0 right-0 h-40 bg-gradient-to-t from-black/10 to-transparent" />

          <div className="flex flex-col h-full overflow-y-auto relative z-10">

            {/* Branding */}
            <div className="p-6 pb-4">
              <div className="flex items-center gap-3.5">
                <img src="/logo-sanchez.png" alt="Centro Hogar Sánchez" className="h-9 w-auto brightness-0 invert drop-shadow-lg" data-testid="img-logo-desktop" />
                <div>
                  <h1 className="text-lg font-bold text-white tracking-tight drop-shadow-sm">Elías Ortega</h1>
                  <p className="text-xs text-white/70">Asistente de Almacén</p>
                </div>
              </div>
              <span className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-white/90 bg-white/15 backdrop-blur-sm px-3 py-1.5 rounded-full">
                <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
                En línea
              </span>
            </div>

            {/* Video */}
            <div className="px-6 pb-4">
              <div className="rounded-2xl overflow-hidden shadow-2xl shadow-black/20 ring-1 ring-white/20">
                <video controls preload="metadata" className="w-full aspect-video" data-testid="video-tutorial">
                  <source src="/tutorial-video.mp4" type="video/mp4" />
                  <track src="/tutorial-captions.vtt" kind="captions" srcLang="es" label="Español" default />
                </video>
              </div>
            </div>

            {/* Info bullets */}
            <div className="px-6 pb-4 space-y-1">
              {[
                { icon: Clock, text: "Lunes a Viernes, 8:00 – 20:00" },
                { icon: Truck, text: "Dime qué traes y busco hueco" },
                { icon: MessageCircle, text: "Respondo las 24 horas del día" },
              ].map(({ icon: Icon, text }) => (
                <div key={text} className="flex items-center gap-3 py-2">
                  <div className="w-8 h-8 rounded-lg bg-white/15 backdrop-blur-sm flex items-center justify-center shrink-0">
                    <Icon className="h-4 w-4 text-white" />
                  </div>
                  <p className="text-sm text-white/85">{text}</p>
                </div>
              ))}
            </div>

            {/* Contact */}
            <div className="px-6 py-4 mt-auto">
              <div className="h-px bg-white/15 mb-4" />
              <div className="space-y-2.5">
                <a href="tel:+34953250000" className="flex items-center gap-2.5 text-sm text-white/70 hover:text-white transition-colors">
                  <Phone className="h-4 w-4" /><span>953 25 00 00</span>
                </a>
                <a href="mailto:almacen@centrohogarsanchez.es" className="flex items-center gap-2.5 text-sm text-white/70 hover:text-white transition-colors">
                  <Mail className="h-4 w-4" /><span>almacen@centrohogarsanchez.es</span>
                </a>
                <a href="https://maps.google.com/?q=Centro+Hogar+Sanchez+Jaen" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2.5 text-sm text-white/70 hover:text-white transition-colors">
                  <MapPin className="h-4 w-4" /><span>Ver ubicación</span>
                </a>
              </div>
              <div className="flex items-center justify-between pt-4 mt-3 border-t border-white/10">
                <a href="https://centrohogarsanchez.es" target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-sm text-white hover:text-white/90 font-medium">
                  <ExternalLink className="h-3.5 w-3.5" /><span>centrohogarsanchez.es</span>
                </a>
                <button onClick={toggleTheme} className="p-2 rounded-lg hover:bg-white/10 text-white/60 hover:text-white transition-colors" aria-label="Cambiar tema" data-testid="button-theme-toggle">
                  {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* ── CHAT PANEL ── */}
        <div className="flex-1 flex flex-col min-h-0 min-w-0 bg-white dark:bg-gray-900">

          {/* Desktop chat header */}
          <div className="hidden lg:flex items-center gap-3 px-5 h-14 bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800 shrink-0">
            <EliasAvatar size="lg" />
            <div className="flex-1 min-w-0">
              <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Elías Ortega</h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">Asistente de Almacén</p>
            </div>
            <span className="flex items-center gap-1.5 text-[10px] font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 px-2.5 py-1 rounded-full ring-1 ring-emerald-200 dark:ring-emerald-800/40">
              <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
              En línea
            </span>
            {hasConversation && (
              <button onClick={startNewConversation} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors" aria-label="Nueva conversación" data-testid="button-new-conversation-desktop">
                <RotateCcw className="h-4 w-4 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400" />
              </button>
            )}
            <button onClick={toggleSound} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors" aria-label="Sonido" data-testid="button-sound-toggle-desktop">
              {soundEnabled ? <Volume2 className="h-4 w-4 text-gray-400" /> : <VolumeX className="h-4 w-4 text-gray-300" />}
            </button>
          </div>

          <ProgressStepper currentStep={chatStep} />

          {/* Messages */}
          <div
            ref={scrollRef}
            onScroll={handleScroll}
            className="flex-1 overflow-y-auto p-4 sm:p-6 min-h-0 relative"
            role="log"
            aria-live="polite"
            aria-label="Mensajes"
            data-testid="chat-messages"
          >
            <div className="space-y-5 max-w-2xl mx-auto">
              {!hasConversation ? (
                <WelcomeCard onSuggestion={(text) => sendMessage(text)} />
              ) : (
                messages.map((msg) => {
                  const isError = msg.content.startsWith("__ERROR__");
                  const displayContent = isError ? msg.content.replace("__ERROR__", "") : msg.content;

                  return (
                    <div key={msg.id} className={`group flex gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`} data-testid={`message-${msg.role}-${msg.id}`}>
                      {msg.role === "assistant" && <EliasAvatar />}
                      <div className={`flex flex-col ${msg.role === "user" ? "items-end" : "items-start"} max-w-[80%] sm:max-w-[70%]`}>
                        <div className={`rounded-2xl px-4 py-3 ${
                          msg.role === "user"
                            ? "bg-gradient-to-br from-blue-600 to-blue-700 dark:from-blue-600 dark:to-blue-700 text-white shadow-md shadow-blue-500/20 rounded-br-md"
                            : isError
                              ? "bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 ring-1 ring-red-200 dark:ring-red-800 rounded-bl-md"
                              : "bg-gray-50 dark:bg-gray-800 text-gray-800 dark:text-gray-200 ring-1 ring-gray-100 dark:ring-gray-700 rounded-bl-md"
                        }`}>
                          {isError ? (
                            <div className="text-sm">
                              <p className="mb-2">{displayContent}</p>
                              <button onClick={retryLastMessage} className="flex items-center gap-1.5 text-xs font-medium text-red-500 hover:text-red-700 transition-colors" data-testid="button-retry">
                                <RotateCcw className="h-3.5 w-3.5" /> Reintentar
                              </button>
                            </div>
                          ) : msg.role === "assistant" ? (
                            <MarkdownContent content={displayContent} isUser={false} />
                          ) : (
                            <p className="whitespace-pre-wrap break-words leading-relaxed text-[15px]">{displayContent}</p>
                          )}
                        </div>
                        {/* Timestamp + status + actions */}
                        <div className="flex items-center gap-1.5 mt-1 px-1">
                          <span className="text-[11px] text-gray-400 dark:text-gray-500">
                            {msg.timestamp.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })}
                          </span>
                          {msg.role === "user" && msg.status && (
                            <span className="text-gray-400 dark:text-gray-500">
                              {msg.status === "sending" && <Clock className="h-3 w-3 inline" />}
                              {msg.status === "sent" && <Check className="h-3 w-3 inline" />}
                              {msg.status === "delivered" && <CheckCheck className="h-3 w-3 inline text-blue-500" />}
                            </span>
                          )}
                          {/* Actions — visible on group hover */}
                          {msg.role === "assistant" && !isError && displayContent && (
                            <div className="flex items-center gap-0.5 ml-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                              <CopyButton text={displayContent} />
                              <FeedbackButtons feedback={msg.feedback} onFeedback={(v) => handleFeedback(msg.id, v)} />
                            </div>
                          )}
                        </div>
                      </div>
                      {msg.role === "user" && (
                        <Avatar className="h-8 w-8 shrink-0 shadow-md ring-2 ring-blue-100 dark:ring-blue-900">
                          <AvatarFallback className="bg-gradient-to-br from-blue-600 to-blue-700 text-white"><User className="h-4 w-4" /></AvatarFallback>
                        </Avatar>
                      )}
                    </div>
                  );
                })
              )}

              {/* Typing indicator */}
              {isStreaming && messages[messages.length - 1]?.content === "" && (
                <div className="flex gap-3 justify-start" aria-label={typingText}>
                  <EliasAvatar />
                  <div className="bg-gray-50 dark:bg-gray-800 ring-1 ring-gray-100 dark:ring-gray-700 rounded-2xl rounded-bl-md px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <div className="flex gap-1">
                        <span className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: "0ms", animationDuration: "0.8s" }} />
                        <span className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: "0.2s", animationDuration: "0.8s" }} />
                        <span className="w-2 h-2 bg-blue-600 rounded-full animate-bounce" style={{ animationDelay: "0.4s", animationDuration: "0.8s" }} />
                      </div>
                      <span className="text-xs text-gray-400 dark:text-gray-500 italic">{typingText}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <ScrollToBottomFAB visible={showScrollFAB} onClick={() => scrollToBottom()} />
          </div>

          {/* Input area */}
          <div className="p-3 sm:p-4 bg-white dark:bg-gray-900 border-t border-gray-100 dark:border-gray-800 shrink-0 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
            {isStreaming && (
              <div className="flex justify-center mb-2.5">
                <button onClick={stopStreaming} className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 ring-1 ring-gray-200 dark:ring-gray-700 transition-colors" data-testid="button-stop-streaming">
                  <Square className="h-3 w-3 fill-current" /> Detener
                </button>
              </div>
            )}
            <div className="flex gap-3 items-end max-w-2xl mx-auto">
              <div className="relative flex-1">
                <Textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => { if (e.target.value.length <= MAX_MESSAGE_LENGTH) setInput(e.target.value); }}
                  onKeyDown={handleKeyDown}
                  placeholder="Escribe tu mensaje..."
                  className="resize-none min-h-[48px] max-h-[120px] rounded-2xl bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 focus-visible:ring-blue-500 focus-visible:border-blue-500 text-[15px] pr-14 transition-colors"
                  disabled={isStreaming || !isOnline}
                  data-testid="input-message"
                  aria-label="Mensaje"
                  maxLength={MAX_MESSAGE_LENGTH}
                />
                {input.length > MAX_MESSAGE_LENGTH * 0.8 && (
                  <span className={`absolute bottom-2 right-3 text-[10px] ${input.length >= MAX_MESSAGE_LENGTH ? "text-red-500 font-bold" : "text-gray-400"}`}>
                    {input.length}/{MAX_MESSAGE_LENGTH}
                  </span>
                )}
              </div>
              <Button
                onClick={() => sendMessage()}
                disabled={!input.trim() || isStreaming || !isOnline}
                size="icon"
                className="shrink-0 h-12 w-12 rounded-2xl bg-gradient-to-br from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white shadow-lg shadow-blue-500/25 active:scale-95 transition-all disabled:shadow-none"
                aria-label="Enviar"
                data-testid="button-send"
              >
                {isStreaming ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
              </Button>
            </div>
            <div className="mt-2 text-center">
              <p className="text-[10px] text-gray-400 dark:text-gray-500 hidden sm:block">Enter para enviar · Shift+Enter para nueva línea</p>
              <p className="text-[9px] text-gray-400/70 dark:text-gray-500/70 mt-0.5 flex items-center justify-center gap-1">
                <Sparkles className="h-2.5 w-2.5" />
                Asistente de IA ·{" "}
                <a href="https://centrohogarsanchez.es/privacidad" target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-gray-500">Privacidad</a>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
