"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { CoachMarkdown } from "@/components/coach-markdown";
import { COMPASS } from "@/lib/coach/compass";
import type { EveningReview } from "@/lib/types";

export function EveningReviewClient({
  recent,
  eveningPrompt,
}: {
  recent: EveningReview[];
  eveningPrompt?: string | null;
}) {
  const [bullets, setBullets] = useState(["", "", ""]);
  const [markdown, setMarkdown] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const filled = bullets.map((b) => b.trim()).filter(Boolean);
  const canSubmit = filled.length === 3;

  async function submit() {
    setLoading(true);
    setError(null);
    try {
      const narrative = filled.map((b) => `• ${b}`).join("\n");
      const res = await fetch("/api/reviews/evening", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ narrative, evidence: filled }),
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
        <h1 className="font-display text-3xl text-stone-900">
          {COMPASS.evening.title}
        </h1>
        <p className="mt-1 text-stone-600">{COMPASS.evening.subtitle}</p>
      </div>
      <div>
        <Label>{eveningPrompt?.trim() || COMPASS.evening.question}</Label>
        <p className="mt-1 text-sm text-stone-500">
          Three short bullets in — a full Wins / Patterns / Identity / Tomorrow
          review out.
        </p>
        <div className="mt-2 space-y-2">
          {bullets.map((bullet, index) => (
            <Input
              key={index}
              value={bullet}
              onChange={(e) =>
                setBullets((items) =>
                  items.map((value, i) =>
                    i === index ? e.target.value : value,
                  ),
                )
              }
              placeholder={
                COMPASS.evening.bulletPlaceholders[index] ?? `Evidence ${index + 1}`
              }
              aria-label={`Evidence ${index + 1}`}
            />
          ))}
        </div>
      </div>
      <Button onClick={submit} disabled={loading || !canSubmit}>
        {loading ? "Reviewing…" : "Run evening review"}
      </Button>
      {error && <p className="text-sm text-red-700">{error}</p>}
      {markdown && (
        <Card>
          <CoachMarkdown content={markdown} />
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
              <p className="mt-1 whitespace-pre-wrap text-sm text-stone-700">
                {r.wins || r.narrative.slice(0, 240)}
              </p>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
