"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import type { Document } from "@/lib/types";

export function KnowledgeClient({ documents }: { documents: Document[] }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [log, setLog] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function sync() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/knowledge/process", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "sync_and_process", limit: 30 }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      const s = data.summary ?? {};
      const queued =
        (s.new ?? 0) + (s.updated ?? 0) + (s.requeued ?? 0);
      const processedCount = data.processed?.length ?? 0;
      const parts = [
        `Found ${s.total ?? data.synced?.length ?? 0} files on disk`,
        `${s.unchanged ?? 0} already processed`,
        `${queued} queued for AI`,
        `AI finished ${processedCount}` +
          (data.processedFail
            ? ` (${data.processedFail} failed)`
            : ""),
      ];
      if (queued === 0 && processedCount === 0) {
        parts.push(
          "No new/changed files to process. On Vercel, new files must be pushed to GitHub and redeployed first.",
        );
      }
      setLog(parts.join(" · "));
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sync failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="font-display text-2xl text-stone-900 md:text-3xl">Knowledge</h1>
          <p className="mt-1 text-sm text-stone-600 md:text-base">
            Drop any <code className="text-xs">.md</code>,{" "}
            <code className="text-xs">.txt</code>, or{" "}
            <code className="text-xs">.pdf</code> into{" "}
            <code className="text-xs">knowledge/</code> (folders optional), then
            sync. On the live site, commit &amp; push new files so Vercel can
            see them.
          </p>
        </div>
        <Button className="w-full shrink-0 sm:w-auto" onClick={sync} disabled={loading}>
          {loading ? "Syncing…" : "Sync knowledge"}
        </Button>
      </div>
      {log && <p className="text-sm text-teal-800">{log}</p>}
      {error && <p className="text-sm text-red-700">{error}</p>}
      <div className="space-y-2">
        {documents.map((d) => (
          <Card key={d.id}>
            <CardTitle>{d.title}</CardTitle>
            <p className="mt-1 text-xs text-stone-500">
              {d.source_type} · {d.path} · {d.status}
            </p>
            {d.error_message && (
              <p className="mt-1 text-xs text-red-600">{d.error_message}</p>
            )}
          </Card>
        ))}
        {documents.length === 0 && (
          <p className="text-sm text-stone-500">
            No documents yet. Drop files into knowledge/ (root is fine) and hit
            Sync.
          </p>
        )}
      </div>
    </div>
  );
}
