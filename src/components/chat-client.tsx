"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { CoachMarkdown } from "@/components/coach-markdown";

type Msg = { role: "user" | "assistant"; content: string };

export function ChatClient() {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [hydrating, setHydrating] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/chat");
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to load chat");
        if (cancelled) return;
        if (data.conversationId) setConversationId(data.conversationId);
        if (Array.isArray(data.messages)) {
          setMessages(
            data.messages.filter(
              (m: Msg) => m.role === "user" || m.role === "assistant",
            ),
          );
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Failed to load chat");
        }
      } finally {
        if (!cancelled) setHydrating(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  async function send() {
    if (!input.trim() || loading) return;
    const message = input.trim();
    setInput("");
    setMessages((m) => [...m, { role: "user", content: message }]);
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, conversationId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      if (data.conversationId) setConversationId(data.conversationId);
      setMessages((m) => [...m, { role: "assistant", content: data.content }]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Chat failed");
    } finally {
      setLoading(false);
    }
  }

  async function startNewChat() {
    setMessages([]);
    setConversationId(null);
    setError(null);
  }

  return (
    <div className="flex h-[calc(100dvh-7.5rem)] flex-col gap-3 md:h-[calc(100dvh-4rem)] md:gap-4">
      <div className="flex shrink-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="font-display text-2xl text-stone-900 md:text-3xl">
            Chat Coach
          </h1>
          <p className="mt-1 text-sm text-stone-600 md:text-base">
            Talk through anxiety, conflict, or decisions — grounded in your
            principles.
          </p>
        </div>
        <Button
          variant="secondary"
          type="button"
          className="min-h-11 w-full sm:w-auto"
          onClick={startNewChat}
        >
          New chat
        </Button>
      </div>

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto rounded-xl border border-stone-200 bg-white/70 p-3 shadow-sm md:space-y-4 md:p-4">
        {hydrating && (
          <p className="py-6 text-center text-sm text-stone-500">
            Loading conversation…
          </p>
        )}

        {!hydrating && messages.length === 0 && !loading && (
          <div className="space-y-2 py-6 text-center">
            <p className="text-sm text-stone-500">Try one of these:</p>
            <div className="flex flex-wrap justify-center gap-2">
              {["I'm anxious.", "I procrastinated.", "I want to quit."].map(
                (s) => (
                  <button
                    key={s}
                    type="button"
                    className="min-h-11 rounded-full border border-stone-200 bg-white px-3 py-2 text-sm text-stone-700 hover:border-teal-700/40 hover:text-teal-900"
                    onClick={() => setInput(s)}
                  >
                    {s}
                  </button>
                ),
              )}
            </div>
          </div>
        )}

        {messages.map((m, i) =>
          m.role === "user" ? (
            <div key={i} className="flex justify-end">
              <div className="max-w-[95%] rounded-2xl rounded-br-md bg-teal-800 px-4 py-2.5 text-[15px] leading-relaxed text-white sm:max-w-[85%]">
                {m.content}
              </div>
            </div>
          ) : (
            <div key={i} className="flex justify-start">
              <div className="max-w-[98%] rounded-2xl rounded-bl-md border border-stone-200 bg-[#fafaf8] px-3 py-3 shadow-sm sm:max-w-[92%] sm:px-4">
                <CoachMarkdown content={m.content} />
              </div>
            </div>
          ),
        )}

        {loading && (
          <div className="flex justify-start">
            <div className="rounded-2xl border border-stone-200 bg-[#fafaf8] px-4 py-3 text-sm text-stone-500">
              Thinking…
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {error && <p className="text-sm text-red-700">{error}</p>}

      <div
        className="shrink-0 space-y-2"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <Textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="What's going on?"
          rows={3}
          className="min-h-[5.5rem] text-base md:text-sm"
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void send();
            }
          }}
        />
        <div className="flex items-center justify-between gap-3">
          <p className="hidden text-xs text-stone-400 sm:block">
            Enter to send · Shift+Enter for new line
          </p>
          <Button
            className="min-h-11 w-full sm:ml-auto sm:w-auto"
            onClick={send}
            disabled={loading || !input.trim()}
          >
            {loading ? "Thinking…" : "Send"}
          </Button>
        </div>
      </div>
    </div>
  );
}
