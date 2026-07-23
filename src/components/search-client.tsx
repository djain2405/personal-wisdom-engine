"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardTitle } from "@/components/ui/card";

export function SearchClient() {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<{
    principles: { id: string; title: string; summary: string | null; category: string | null }[];
    quotes: { id: string; text: string; attribution: string | null }[];
    documents: { id: string; title: string; path: string; source_type: string }[];
    habits: { id: string; title: string; description: string | null }[];
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      setResults(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-display text-2xl text-stone-900 md:text-3xl">Search</h1>
        <p className="mt-1 text-sm text-stone-600 md:text-base">
          Find everything about confidence, identity, gratitude, discipline…
        </p>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search your wisdom"
          onKeyDown={(e) => e.key === "Enter" && run()}
          className="w-full"
        />
        <Button
          className="w-full shrink-0 sm:w-auto"
          onClick={run}
          disabled={loading || !q.trim()}
        >
          {loading ? "Searching…" : "Search"}
        </Button>
      </div>
      {error && <p className="text-sm text-red-700">{error}</p>}
      {results && (
        <div className="space-y-4">
          <Section title="Principles" empty={results.principles.length === 0}>
            {results.principles.map((p) => (
              <Card key={p.id}>
                <CardTitle>
                  {p.title}
                  {p.category ? (
                    <span className="ml-2 text-xs font-normal text-teal-800">
                      {p.category}
                    </span>
                  ) : null}
                </CardTitle>
                <p className="mt-1 text-sm text-stone-600">{p.summary}</p>
              </Card>
            ))}
          </Section>
          <Section title="Quotes" empty={results.quotes.length === 0}>
            {results.quotes.map((q) => (
              <Card key={q.id}>
                <p className="text-sm italic text-stone-700">&ldquo;{q.text}&rdquo;</p>
                {q.attribution && (
                  <p className="mt-1 text-xs text-stone-500">— {q.attribution}</p>
                )}
              </Card>
            ))}
          </Section>
          <Section title="Habits" empty={results.habits.length === 0}>
            {results.habits.map((h) => (
              <Card key={h.id}>
                <CardTitle>{h.title}</CardTitle>
                <p className="mt-1 text-sm text-stone-600">{h.description}</p>
              </Card>
            ))}
          </Section>
          <Section title="Documents" empty={results.documents.length === 0}>
            {results.documents.map((d) => (
              <Card key={d.id}>
                <CardTitle>{d.title}</CardTitle>
                <p className="mt-1 text-xs text-stone-500">
                  {d.source_type} · {d.path}
                </p>
              </Card>
            ))}
          </Section>
        </div>
      )}
    </div>
  );
}

function Section({
  title,
  empty,
  children,
}: {
  title: string;
  empty: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-stone-500">
        {title}
      </h2>
      {empty ? (
        <p className="text-sm text-stone-400">None</p>
      ) : (
        <div className="space-y-2">{children}</div>
      )}
    </div>
  );
}
