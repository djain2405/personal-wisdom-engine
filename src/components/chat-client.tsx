"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";

type Msg = { role: "user" | "assistant"; content: string };

export function ChatClient() {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-display text-3xl text-stone-900">Chat Coach</h1>
        <p className="mt-1 text-stone-600">
          Talk through anxiety, conflict, or decisions — grounded in your principles.
        </p>
      </div>

      <Card className="min-h-[320px] space-y-3">
        {messages.length === 0 && (
          <p className="text-sm text-stone-500">
            Try: &quot;I&apos;m anxious.&quot; / &quot;I procrastinated.&quot; / &quot;I want to quit.&quot;
          </p>
        )}
        {messages.map((m, i) => (
          <div
            key={i}
            className={
              m.role === "user"
                ? "ml-8 rounded-md bg-teal-50 px-3 py-2 text-sm"
                : "mr-8 rounded-md bg-stone-50 px-3 py-2 text-sm whitespace-pre-wrap"
            }
          >
            {m.content}
          </div>
        ))}
      </Card>

      {error && <p className="text-sm text-red-700">{error}</p>}

      <Textarea
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder="What's going on?"
        rows={3}
      />
      <Button onClick={send} disabled={loading}>
        {loading ? "Thinking…" : "Send"}
      </Button>
    </div>
  );
}
