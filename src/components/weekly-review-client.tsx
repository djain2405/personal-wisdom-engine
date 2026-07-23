"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import type { WeeklyReview } from "@/lib/types";

export function WeeklyReviewClient({ reviews }: { reviews: WeeklyReview[] }) {
  const router = useRouter();
  const [markdown, setMarkdown] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function generate() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/reviews/weekly", { method: "POST" });
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
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl text-stone-900">Weekly Review</h1>
          <p className="mt-1 text-stone-600">
            Wins, lessons, patterns, and focus for next week.
          </p>
        </div>
        <Button onClick={generate} disabled={loading}>
          {loading ? "Generating…" : "Generate this week"}
        </Button>
      </div>
      {error && <p className="text-sm text-red-700">{error}</p>}
      {markdown && (
        <Card>
          <pre className="whitespace-pre-wrap font-sans text-sm text-stone-700">
            {markdown}
          </pre>
        </Card>
      )}
      <div className="space-y-2">
        {reviews.map((r) => (
          <Card key={r.id}>
            <CardTitle>Week of {r.week_start}</CardTitle>
            <p className="mt-2 text-sm text-stone-700 whitespace-pre-wrap">
              {r.focus_next || r.wins || "—"}
            </p>
          </Card>
        ))}
      </div>
    </div>
  );
}
