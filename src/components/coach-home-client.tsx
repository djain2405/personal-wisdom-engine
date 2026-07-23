"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import type { DailyBrief } from "@/lib/types";

export function CoachHomeClient({
  initialBrief,
  initialError,
}: {
  initialBrief: DailyBrief | null;
  initialError?: string | null;
}) {
  const [brief, setBrief] = useState(initialBrief);
  const [error, setError] = useState(initialError ?? null);
  const [loading, setLoading] = useState(false);

  async function regenerate() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/coach/brief", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ regenerate: true }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      setBrief(data.brief);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to regenerate");
    } finally {
      setLoading(false);
    }
  }

  if (!brief) {
    return (
      <div className="space-y-4">
        <div>
          <h1 className="font-display text-3xl text-stone-900 animate-rise">
            Coach Mode
          </h1>
          <p className="mt-1 text-stone-600 animate-rise-delay-1">
            Your daily operating system — identity first, then action.
          </p>
        </div>
        <Card className="animate-rise-delay-2">
          <p className="text-sm text-stone-600">
            {error ||
              "No brief yet. Configure AI keys and generate today's coach brief."}
          </p>
          <Button className="mt-4" onClick={regenerate} disabled={loading}>
            {loading ? "Generating…" : "Generate today's brief"}
          </Button>
        </Card>
      </div>
    );
  }

  const blocks = [
    { label: "Today's Identity", value: brief.todays_identity },
    { label: "Keystone Habit", value: brief.keystone_habit },
    { label: "Principle to Practice", value: brief.principle_to_practice },
    { label: "Challenge", value: brief.challenge },
    { label: "Reflection", value: brief.reflection_question },
    { label: "Evening Prompt", value: brief.evening_prompt },
    { label: "Priorities", value: brief.priorities },
    { label: "Mindset Reminder", value: brief.mindset_reminder },
    { label: "Mantra", value: brief.mantra },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl text-stone-900 animate-rise">
            Coach Mode
          </h1>
          <p className="mt-1 text-stone-600 animate-rise-delay-1">
            {brief.brief_date} — shape the day around who you&apos;re becoming.
          </p>
        </div>
        <div className="flex gap-2 animate-rise-delay-2">
          <Button variant="secondary" onClick={regenerate} disabled={loading}>
            {loading ? "Regenerating…" : "Regenerate"}
          </Button>
          <Link
            href="/reviews/evening"
            className="inline-flex h-10 items-center rounded-md bg-teal-800 px-4 text-sm font-medium text-white hover:bg-teal-900"
          >
            Evening review
          </Link>
        </div>
      </div>

      {error && (
        <p className="text-sm text-red-700">{error}</p>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        {blocks.map((b, i) => (
          <Card
            key={b.label}
            className={i === 0 ? "sm:col-span-2 animate-rise" : "animate-rise-delay-1"}
          >
            <CardTitle className="text-teal-900">{b.label}</CardTitle>
            <p className="mt-2 whitespace-pre-wrap text-sm text-stone-700">
              {b.value || "—"}
            </p>
          </Card>
        ))}
      </div>
    </div>
  );
}
