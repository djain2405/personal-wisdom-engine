"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardTitle } from "@/components/ui/card";
import { CoachMarkdown } from "@/components/coach-markdown";
import { PRINCIPLE_CATEGORIES } from "@/lib/types";
import type { Principle } from "@/lib/types";

export function PrinciplesClient({
  initial,
}: {
  initial: Principle[];
}) {
  const [q, setQ] = useState("");
  const [category, setCategory] = useState("");
  const [principles, setPrinciples] = useState(initial);
  const [synthesis, setSynthesis] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function search(synthesize = false) {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (q) params.set("q", q);
      if (category) params.set("category", category);
      if (synthesize) params.set("synthesize", "1");
      const res = await fetch(`/api/principles?${params}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      setPrinciples(data.principles ?? []);
      setSynthesis(data.synthesis ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-display text-2xl text-stone-900 md:text-3xl">Principles</h1>
        <p className="mt-1 text-sm text-stone-600 md:text-base">
          Browse and synthesize what you&apos;ve learned across sources.
        </p>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder='e.g. discipline, confidence, relationships'
          className="w-full sm:max-w-md"
        />
        <select
          className="h-11 w-full rounded-md border border-stone-300 bg-white px-3 text-base sm:h-10 sm:w-auto sm:text-sm"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
        >
          <option value="">All categories</option>
          {PRINCIPLE_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <div className="flex gap-2">
          <Button className="flex-1 sm:flex-none" onClick={() => search(false)} disabled={loading}>
            Search
          </Button>
          <Button
            className="flex-1 sm:flex-none"
            variant="secondary"
            onClick={() => search(true)}
            disabled={loading || !q}
          >
            Synthesize
          </Button>
        </div>
      </div>
      {error && <p className="text-sm text-red-700">{error}</p>}
      {synthesis && (
        <Card>
          <CardTitle>Synthesis</CardTitle>
          <div className="mt-2">
            <CoachMarkdown content={synthesis} />
          </div>
        </Card>
      )}
      <div className="space-y-3">
        {principles.map((p) => (
          <Card key={p.id}>
            <CardTitle>
              {p.title}
              {p.category ? (
                <span className="ml-2 text-xs font-normal text-teal-800">
                  {p.category}
                </span>
              ) : null}
            </CardTitle>
            <p className="mt-1 text-xs text-stone-500">
              freq {p.frequency_score.toFixed(1)} · conf{" "}
              {p.confidence_score.toFixed(2)}
            </p>
            <p className="mt-2 text-sm text-stone-700">{p.summary}</p>
            {(p.action_steps?.length ?? 0) > 0 && (
              <ul className="mt-2 list-disc pl-5 text-sm text-stone-600">
                {p.action_steps!.slice(0, 4).map((a) => (
                  <li key={a}>{a}</li>
                ))}
              </ul>
            )}
          </Card>
        ))}
        {principles.length === 0 && (
          <p className="text-sm text-stone-500">
            No principles yet — sync knowledge to extract them.
          </p>
        )}
      </div>
    </div>
  );
}
