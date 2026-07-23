"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import type { EveningReview } from "@/lib/types";

export function EveningReviewClient({
  recent,
}: {
  recent: EveningReview[];
}) {
  const [narrative, setNarrative] = useState("");
  const [markdown, setMarkdown] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/reviews/evening", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ narrative }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      setMarkdown(data.markdown);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-display text-3xl text-stone-900">Evening Review</h1>
        <p className="mt-1 text-stone-600">
          What happened today? Detect wins, patterns, and tomorrow&apos;s move.
        </p>
      </div>
      <Textarea
        value={narrative}
        onChange={(e) => setNarrative(e.target.value)}
        rows={8}
        placeholder="What happened today…"
      />
      <Button onClick={submit} disabled={loading || !narrative.trim()}>
        {loading ? "Reviewing…" : "Run evening review"}
      </Button>
      {error && <p className="text-sm text-red-700">{error}</p>}
      {markdown && (
        <Card>
          <pre className="whitespace-pre-wrap font-sans text-sm text-stone-700">
            {markdown}
          </pre>
        </Card>
      )}
      {recent.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-stone-500">
            Recent
          </h2>
          {recent.map((r) => (
            <Card key={r.id}>
              <p className="text-xs text-stone-500">{r.review_date}</p>
              <p className="mt-1 text-sm text-stone-700">
                {r.wins || r.narrative.slice(0, 160)}
              </p>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
