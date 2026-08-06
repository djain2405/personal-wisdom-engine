"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CoachMarkdown } from "@/components/coach-markdown";
import { COMPASS, type WeeklyCompassAnswers } from "@/lib/coach/compass";
import type { WeeklyReview } from "@/lib/types";

const EMPTY: WeeklyCompassAnswers = {
  becoming: "",
  attention: "",
  standards: "",
  presence: "",
  future_actions: "",
  evidence: "",
};

export function WeeklyReviewClient({ reviews }: { reviews: WeeklyReview[] }) {
  const router = useRouter();
  const [compass, setCompass] = useState<WeeklyCompassAnswers>(EMPTY);
  const [markdown, setMarkdown] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ready = COMPASS.weekly.questions.every(
    (q) => compass[q.key].trim().length > 0,
  );

  async function generate() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/reviews/weekly", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ compass }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      setMarkdown(data.markdown);
      router.refresh();
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
          {COMPASS.weekly.title}
        </h1>
        <p className="mt-1 text-stone-600">{COMPASS.weekly.subtitle}</p>
      </div>

      <Card className="space-y-4">
        {COMPASS.weekly.questions.map((q) => (
          <div key={q.key}>
            <Label htmlFor={`weekly-${q.key}`}>{q.label}</Label>
            <Input
              id={`weekly-${q.key}`}
              className="mt-1.5"
              value={compass[q.key]}
              onChange={(e) =>
                setCompass((prev) => ({ ...prev, [q.key]: e.target.value }))
              }
              placeholder="Write a short answer…"
            />
          </div>
        ))}
        <Button onClick={generate} disabled={loading || !ready}>
          {loading ? "Generating…" : "Generate weekly reset"}
        </Button>
      </Card>

      {error && <p className="text-sm text-red-700">{error}</p>}
      {markdown && (
        <Card>
          <CoachMarkdown content={markdown} />
        </Card>
      )}
      <div className="space-y-2">
        {reviews.map((r) => (
          <Card key={r.id}>
            <CardTitle>Week of {r.week_start}</CardTitle>
            <p className="mt-2 whitespace-pre-wrap text-sm text-stone-700">
              {r.focus_next || r.wins || "—"}
            </p>
          </Card>
        ))}
      </div>
    </div>
  );
}
