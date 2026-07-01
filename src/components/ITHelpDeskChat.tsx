"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Headset, Send, X, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

const WEBHOOK_URL =
  "https://n8n.pros.mortgage/webhook/9ce2709c-faa0-4977-a3ce-5e9adb6d62f1/chat";
const SESSION_STORAGE_KEY = "it-helpdesk-session-id";
const AUTO_OPENED_KEY = "it-helpdesk-auto-opened";
const AUTO_OPEN_DELAY_MS = 10_000;
const WELCOME_MESSAGE =
  "Welcome to MortgagePros IT Support! How can I help you?";

interface ChatMessage {
  id: string;
  sender: "user" | "bot";
  text: string;
}

interface ITHelpDeskChatProps {
  userName: string;
  userEmail: string;
}

function makeId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.floor(Math.random() * 1e9)}`;
}

/** Render plain text with preserved line breaks and auto-linked URLs. */
function MessageText({ text }: { text: string }) {
  const lines = text.split("\n");
  return (
    <>
      {lines.map((line, i) => {
        const parts = line.split(/(https?:\/\/[^\s]+)/g);
        return (
          <span key={i}>
            {parts.map((part, j) =>
              /^https?:\/\//.test(part) ? (
                <a
                  key={j}
                  href={part}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline underline-offset-2 hover:opacity-80"
                >
                  {part}
                </a>
              ) : (
                <span key={j}>{part}</span>
              ),
            )}
            {i < lines.length - 1 && <br />}
          </span>
        );
      })}
    </>
  );
}

export function ITHelpDeskChat({ userName, userEmail }: ITHelpDeskChatProps) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    { id: "welcome", sender: "bot", text: WELCOME_MESSAGE },
  ]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [unread, setUnread] = useState(false);

  const sessionIdRef = useRef<string>("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const userInteractedRef = useRef(false);

  // Establish a stable session id that survives reloads.
  useEffect(() => {
    let id = "";
    try {
      id = localStorage.getItem(SESSION_STORAGE_KEY) ?? "";
    } catch {
      /* storage unavailable */
    }
    if (!id) {
      id = makeId();
      try {
        localStorage.setItem(SESSION_STORAGE_KEY, id);
      } catch {
        /* storage unavailable */
      }
    }
    sessionIdRef.current = id;
  }, []);

  // Auto-open once per browser session, 10s after first load.
  useEffect(() => {
    let alreadyOpened = false;
    try {
      alreadyOpened = sessionStorage.getItem(AUTO_OPENED_KEY) === "1";
    } catch {
      /* storage unavailable */
    }
    if (alreadyOpened) return;

    const t = setTimeout(() => {
      try {
        sessionStorage.setItem(AUTO_OPENED_KEY, "1");
      } catch {
        /* storage unavailable */
      }
      // Don't pop open if the user already engaged with the widget.
      if (!userInteractedRef.current) setOpen(true);
    }, AUTO_OPEN_DELAY_MS);

    return () => clearTimeout(t);
  }, []);

  // Auto-scroll to the latest message.
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, open, sending]);

  // Auto-grow the textarea to fit its content (capped by max-height via CSS).
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [input, open]);

  // Focus the input when the window opens; clear the unread dot.
  useEffect(() => {
    if (open) {
      setUnread(false);
      const t = setTimeout(() => inputRef.current?.focus(), 250);
      return () => clearTimeout(t);
    }
  }, [open]);

  const sendMessage = useCallback(async () => {
    const text = input.trim();
    if (!text || sending) return;

    const userMsg: ChatMessage = { id: makeId(), sender: "user", text };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setSending(true);

    try {
      const res = await fetch(WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "text/plain" },
        body: JSON.stringify({
          action: "sendMessage",
          sessionId: sessionIdRef.current,
          chatInput: text,
          metadata: { userName, userEmail },
        }),
      });

      let botText = "";
      const raw = await res.clone().text();
      try {
        const data = JSON.parse(raw);
        botText =
          data.output ?? data.text ?? data.message ?? data.response ?? "";
        if (typeof botText !== "string") botText = JSON.stringify(botText);
      } catch {
        botText = raw;
      }
      if (!botText.trim()) {
        botText = "Sorry, I didn't get a response. Please try again.";
      }

      setMessages((prev) => [
        ...prev,
        { id: makeId(), sender: "bot", text: botText },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: makeId(),
          sender: "bot",
          text: "I couldn't reach IT Support right now. Please try again in a moment.",
        },
      ]);
    } finally {
      setSending(false);
      if (!open) setUnread(true);
    }
  }, [input, sending, userName, userEmail, open]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void sendMessage();
    }
  };

  return (
    <>
      {/* Chat window */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.96 }}
            transition={{ type: "spring", damping: 26, stiffness: 320 }}
            className={cn(
              "fixed bottom-24 right-5 z-[60] flex w-[380px] max-w-[calc(100vw-2.5rem)]",
              "h-[560px] max-h-[calc(100vh-8rem)] flex-col overflow-hidden rounded-2xl",
              "border border-slate-200 bg-white shadow-2xl",
              "dark:border-slate-700 dark:bg-slate-900",
            )}
          >
            {/* Header */}
            <div className="flex items-center gap-3 bg-brand-blue px-5 py-4 text-white">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white/15">
                <Headset className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold leading-tight">
                  IT Support
                </p>
                <p className="flex items-center gap-1.5 text-xs text-white/80">
                  <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-400" />
                  We&apos;re here to help
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close chat"
                className="rounded-md p-1.5 text-white/80 transition hover:bg-white/15 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Messages */}
            <div
              ref={scrollRef}
              className="flex-1 space-y-3 overflow-y-auto bg-brand-bg px-4 py-4 dark:bg-slate-950"
            >
              {messages.map((m) => (
                <div
                  key={m.id}
                  className={cn(
                    "flex",
                    m.sender === "user" ? "justify-end" : "justify-start",
                  )}
                >
                  <div
                    className={cn(
                      "max-w-[80%] whitespace-pre-wrap break-words rounded-2xl px-3.5 py-2 text-sm leading-relaxed shadow-sm",
                      m.sender === "user"
                        ? "rounded-br-md bg-brand-blue text-white"
                        : "rounded-bl-md border border-slate-200 bg-white text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100",
                    )}
                  >
                    <MessageText text={m.text} />
                  </div>
                </div>
              ))}

              {sending && (
                <div className="flex justify-start">
                  <div className="flex items-center gap-1 rounded-2xl rounded-bl-md border border-slate-200 bg-white px-4 py-3 shadow-sm dark:border-slate-700 dark:bg-slate-800">
                    {[0, 1, 2].map((i) => (
                      <motion.span
                        key={i}
                        className="h-1.5 w-1.5 rounded-full bg-slate-400 dark:bg-slate-500"
                        animate={{ opacity: [0.3, 1, 0.3] }}
                        transition={{
                          duration: 1,
                          repeat: Infinity,
                          delay: i * 0.18,
                        }}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Input */}
            <div className="border-t border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
              <div className="flex items-end gap-2 rounded-xl border border-slate-300 bg-white px-3 py-2 focus-within:border-brand-blue dark:border-slate-600 dark:bg-slate-800">
                <textarea
                  ref={inputRef}
                  rows={1}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Type your message…"
                  className="max-h-28 flex-1 resize-none overflow-y-auto break-words bg-transparent text-sm leading-relaxed text-slate-800 outline-none placeholder:text-slate-400 dark:text-slate-100"
                />
                <button
                  type="button"
                  onClick={() => void sendMessage()}
                  disabled={!input.trim() || sending}
                  aria-label="Send message"
                  className={cn(
                    "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-white transition",
                    "bg-brand-blue hover:bg-brand-blue/90",
                    "disabled:cursor-not-allowed disabled:opacity-40",
                  )}
                >
                  {sending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                </button>
              </div>
              <p className="mt-1.5 text-center text-[10px] text-slate-400 dark:text-slate-500">
                Powered by MortgagePros IT
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating toggle button */}
      <button
        type="button"
        onClick={() => {
          userInteractedRef.current = true;
          setOpen((v) => !v);
        }}
        aria-label={open ? "Close IT Support chat" : "Open IT Support chat"}
        className={cn(
          "fixed bottom-5 right-5 z-[60] flex h-14 w-14 items-center justify-center rounded-full",
          "bg-brand-blue text-white shadow-lg transition hover:bg-brand-blue/90 hover:shadow-xl",
          "focus:outline-none focus-visible:ring-4 focus-visible:ring-brand-blue/30",
        )}
      >
        <AnimatePresence mode="wait" initial={false}>
          {open ? (
            <motion.span
              key="close"
              initial={{ rotate: -90, opacity: 0 }}
              animate={{ rotate: 0, opacity: 1 }}
              exit={{ rotate: 90, opacity: 0 }}
              transition={{ duration: 0.15 }}
            >
              <X className="h-6 w-6" />
            </motion.span>
          ) : (
            <motion.span
              key="open"
              initial={{ rotate: 90, opacity: 0 }}
              animate={{ rotate: 0, opacity: 1 }}
              exit={{ rotate: -90, opacity: 0 }}
              transition={{ duration: 0.15 }}
            >
              <Headset className="h-6 w-6" />
            </motion.span>
          )}
        </AnimatePresence>

        {/* Unread indicator */}
        {unread && !open && (
          <span className="absolute -right-0.5 -top-0.5 flex h-3.5 w-3.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex h-3.5 w-3.5 rounded-full bg-emerald-500" />
          </span>
        )}
      </button>
    </>
  );
}
