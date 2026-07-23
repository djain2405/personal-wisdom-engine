"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";

export function SituationClient() {
  const [situation, setSituation] = useState("");
  const [result, setResult] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/situation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ situation }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      setResult(data.content);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-display text-3xl text-stone-900">Situation Coach</h1>
        <p className="mt-1 text-stone-600">
          Describe a moment. Get current vs desired identity, models, and a response.
        </p>
      </div>
      <Textarea
        value={situation}
        onChange={(e) => setSituation(e.target.value)}
        rows={6}
        placeholder="My manager upset me in the standup…"
      />
      <Button onClick={run} disabled={loading || !situation.trim()}>
        {loading ? "Coaching…" : "Coach this situation"}
      </Button>
      {error && <p className="text-sm text-red-700">{error}</p>}
      {result && (
        <Card>
          <div className="prose prose-stone max-w-none whitespace-pre-wrap text-sm">
            {result}
          </div>
        </Card>
      )}
    </div>
  );
}
