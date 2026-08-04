"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import type { DailyBrief } from "@/lib/types";
import { todayISO } from "@/lib/utils";

type KnowledgeSource = {
  path?: string;
  processed_at?: string | null;
  principle_title?: string | null;
  excerpt?: string | null;
};

type KnowledgeExcerpt = {
  path?: string;
  snippet?: string;
  processed_at?: string | null;
  source?: string;
};

type BriefProvenance = {
  principle_count?: number;
  source_count?: number;
  chosen_principle_title?: string | null;
  candidate_principle_titles?: string[];
  source_principle_titles?: string[];
  knowledge_sources?: KnowledgeSource[];
  knowledge_excerpts?: KnowledgeExcerpt[];
  excluded_principle_ids?: string[];
  cooldown_days?: number;
  recent_documents?: string[];
};

function basename(path: string) {
  return path.split("/").pop() ?? path;
}

function formatDate(value?: string | null) {
  if (!value) return null;
  const d = value.slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : null;
}

function WhyThisBrief({ provenance }: { provenance: BriefProvenance }) {
  const [open, setOpen] = useState(false);

  const sources = provenance.knowledge_sources ?? [];
  const excerpts = provenance.knowledge_excerpts ?? [];
  const candidates = (
    provenance.candidate_principle_titles ??
    provenance.source_principle_titles ??
    []
  ).filter(
    (t) => t && t !== provenance.chosen_principle_title,
  );
  const skipped = provenance.excluded_principle_ids?.length ?? 0;
  const cooldownDays = provenance.cooldown_days ?? 7;

  const knowledgeLines: { label: string; detail?: string | null }[] = [];
  for (const s of sources.slice(0, 4)) {
    if (!s.path) continue;
    knowledgeLines.push({
      label: basename(s.path),
      detail: formatDate(s.processed_at),
    });
  }
  for (const e of excerpts.slice(0, 3)) {
    if (!e.path) continue;
    if (knowledgeLines.some((k) => k.label === basename(e.path!))) continue;
    knowledgeLines.push({
      label: basename(e.path),
      detail: e.source === "chunk" ? "fresh excerpt" : formatDate(e.processed_at),
    });
  }
  // Legacy briefs
  if (!knowledgeLines.length && provenance.recent_documents?.length) {
    for (const path of provenance.recent_documents.slice(0, 3)) {
      knowledgeLines.push({ label: basename(path) });
    }
  }

  const summaryBits = [
    provenance.chosen_principle_title
      ? `Principle: ${provenance.chosen_principle_title}`
      : null,
    knowledgeLines.length
      ? `Knowledge: ${knowledgeLines
          .slice(0, 2)
          .map((k) => k.label)
          .join(", ")}`
      : null,
    skipped > 0 ? `Skipped ${skipped} used in last ${cooldownDays}d` : null,
  ].filter(Boolean);

  return (
    <div className="mt-3 max-w-xl">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="text-left text-xs text-stone-500 underline-offset-2 hover:text-stone-700 hover:underline"
        aria-expanded={open}
      >
        {open ? "Hide why this brief" : "Why this brief"}
        {!open && summaryBits.length ? ` — ${summaryBits.join(" · ")}` : ""}
      </button>
      {open && (
        <div className="mt-2 space-y-2 rounded-md border border-stone-200 bg-stone-50/80 px-3 py-2 text-xs text-stone-600">
          {provenance.chosen_principle_title && (
            <p>
              <span className="font-medium text-stone-800">
                Principle practiced:
              </span>{" "}
              {provenance.chosen_principle_title}
              {skipped > 0
                ? ` (rotated off ${skipped} principles from the last ${cooldownDays} days)`
                : ""}
            </p>
          )}
          {knowledgeLines.length > 0 && (
            <div>
              <p className="font-medium text-stone-800">Knowledge used</p>
              <ul className="mt-1 list-disc space-y-0.5 pl-4">
                {knowledgeLines.map((k) => (
                  <li key={k.label}>
                    {k.label}
                    {k.detail ? (
                      <span className="text-stone-500"> · {k.detail}</span>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {excerpts[0]?.snippet && (
            <p className="italic text-stone-500">
              “{excerpts[0].snippet.slice(0, 160)}
              {excerpts[0].snippet.length > 160 ? "…" : ""}”
            </p>
          )}
          {candidates.length > 0 && (
            <p>
              <span className="font-medium text-stone-800">Also considered:</span>{" "}
              {candidates.slice(0, 3).join("; ")}
            </p>
          )}
          {skipped > 0 && (
            <p>
              Cooldown skipped {skipped} principle
              {skipped === 1 ? "" : "s"} used in Coach over the last{" "}
              {cooldownDays} days.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export function CoachHomeClient({
  initialBrief,
  initialError,
  morningCompleted,
}: {
  initialBrief: DailyBrief | null;
  initialError?: string | null;
  morningCompleted: boolean;
}) {
  const [brief, setBrief] = useState(initialBrief);
  const [error, setError] = useState(initialError ?? null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const today = todayISO();
    if (initialBrief?.brief_date === today) return;

    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await fetch("/api/coach/brief");
        const data = await res.json();
        if (cancelled) return;
        if (!res.ok) throw new Error(data.error || "Failed to load today's brief");
        setBrief(data.brief);
        setError(null);
      } catch (e) {
        if (!cancelled) {
          setError(
            e instanceof Error ? e.message : "Failed to load today's brief",
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [initialBrief?.brief_date]);

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
          <h1 className="font-display text-2xl text-stone-900 animate-rise md:text-3xl">
            Coach Mode
          </h1>
          <p className="mt-1 text-sm text-stone-600 animate-rise-delay-1 md:text-base">
            Your daily operating system — identity first, then action.
          </p>
        </div>
        {!morningCompleted && (
          <Card className="border-teal-200 bg-teal-50/80">
            <CardTitle className="text-teal-950">
              Start with your own voice
            </CardTitle>
            <p className="mt-1 text-sm text-stone-600">
              Record your intention, gratitude, mood, and habits for today.
            </p>
            <Link
              href="/morning"
              className="mt-3 inline-flex min-h-10 items-center rounded-md bg-teal-800 px-4 text-sm font-medium text-white hover:bg-teal-900"
            >
              Log morning ritual
            </Link>
          </Card>
        )}
        <Card className="animate-rise-delay-2">
          <p className="text-sm text-stone-600">
            {error ||
              (loading
                ? "Loading today's coach brief…"
                : "No brief yet. Configure AI keys and generate today's coach brief.")}
          </p>
          <Button
            className="mt-4 w-full sm:w-auto"
            onClick={regenerate}
            disabled={loading}
          >
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

  const isToday = brief.brief_date === todayISO();
  const provenance = (
    brief.raw_json &&
    typeof brief.raw_json === "object" &&
    brief.raw_json !== null &&
    "provenance" in brief.raw_json
      ? (brief.raw_json as { provenance?: BriefProvenance }).provenance
      : null
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="font-display text-2xl text-stone-900 animate-rise md:text-3xl">
            Coach Mode
          </h1>
          <p className="mt-1 text-sm text-stone-600 animate-rise-delay-1 md:text-base">
            {brief.brief_date}
            {!isToday ? " (refreshing to today…)" : ""} — shape the day around
            who you&apos;re becoming.
          </p>
          {provenance && <WhyThisBrief provenance={provenance} />}
        </div>
        <div className="flex w-full flex-col gap-2 animate-rise-delay-2 sm:w-auto sm:flex-row">
          <Button
            variant="secondary"
            className="w-full sm:w-auto"
            onClick={regenerate}
            disabled={loading}
          >
            {loading ? "Regenerating…" : "Regenerate"}
          </Button>
          <Link
            href="/reviews/evening"
            className="inline-flex min-h-11 w-full items-center justify-center rounded-md bg-teal-800 px-4 text-sm font-medium text-white hover:bg-teal-900 sm:w-auto"
          >
            Evening review
          </Link>
        </div>
      </div>

      {error && <p className="text-sm text-red-700">{error}</p>}

      {!morningCompleted && (
        <Card className="border-teal-200 bg-teal-50/80">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-teal-950">
                Your morning ritual is waiting
              </CardTitle>
              <p className="mt-1 text-sm text-stone-600">
                Set your intention, note gratitude, and check off today&apos;s
                habits.
              </p>
            </div>
            <Link
              href="/morning"
              className="inline-flex min-h-10 shrink-0 items-center justify-center rounded-md bg-teal-800 px-4 text-sm font-medium text-white hover:bg-teal-900"
            >
              Log morning ritual
            </Link>
          </div>
        </Card>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        {blocks.map((b, i) => (
          <Card
            key={b.label}
            className={
              i === 0 ? "sm:col-span-2 animate-rise" : "animate-rise-delay-1"
            }
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
