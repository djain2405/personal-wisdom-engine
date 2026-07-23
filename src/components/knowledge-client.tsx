"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import type { Document } from "@/lib/types";
import { cn } from "@/lib/utils";

type InventoryRow = {
  path: string;
  title: string;
  source_type: string;
  inDatabase: boolean;
  id: string | null;
  status: string;
  error_message: string | null;
  processed_at: string | null;
};

type Inventory = {
  diskCount: number;
  dbCount: number;
  readyCount: number;
  missingCount: number;
  rows: InventoryRow[];
};

export function KnowledgeClient({ documents }: { documents: Document[] }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [log, setLog] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [details, setDetails] = useState<
    { path: string; action: string; status: string }[] | null
  >(null);
  const [inventory, setInventory] = useState<Inventory | null>(null);

  async function loadInventory() {
    try {
      const res = await fetch("/api/knowledge/process");
      const data = await res.json();
      if (res.ok) setInventory(data);
    } catch {
      // non-fatal
    }
  }

  useEffect(() => {
    void loadInventory();
  }, []);

  async function sync() {
    setLoading(true);
    setError(null);
    setDetails(null);
    try {
      const res = await fetch("/api/knowledge/process", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "sync_and_process", limit: 30 }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      const s = data.summary ?? {};
      const queued = (s.new ?? 0) + (s.updated ?? 0) + (s.requeued ?? 0);
      const processedCount = data.processed?.length ?? 0;
      const parts = [
        `Found ${s.total ?? data.synced?.length ?? 0} files on disk`,
        `${s.unchanged ?? 0} already processed`,
        `${queued} queued for AI`,
        `AI finished ${processedCount}` +
          (data.processedFail ? ` (${data.processedFail} failed)` : ""),
      ];
      if (s.error) {
        parts.push(`${s.error} failed to read`);
      }
      setLog(parts.join(" · "));
      setDetails(
        (data.synced ?? []).map(
          (x: { path: string; action: string; status: string }) => ({
            path: x.path,
            action: x.action,
            status: x.status,
          }),
        ),
      );
      if (data.inventory) setInventory(data.inventory);
      else await loadInventory();
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sync failed");
    } finally {
      setLoading(false);
    }
  }

  const rows =
    inventory?.rows ??
    documents.map((d) => ({
      path: d.path,
      title: d.title,
      source_type: d.source_type,
      inDatabase: true,
      id: d.id,
      status: d.status,
      error_message: d.error_message,
      processed_at: d.processed_at,
    }));

  const notReady = rows.filter((r) => r.status !== "ready");

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="font-display text-2xl text-stone-900 md:text-3xl">
            Knowledge
          </h1>
          <p className="mt-1 text-sm text-stone-600 md:text-base">
            Every file under <code className="text-xs">knowledge/</code> should
            appear below. On Vercel, push new files to GitHub before syncing.
          </p>
        </div>
        <Button
          className="w-full shrink-0 sm:w-auto"
          onClick={sync}
          disabled={loading}
        >
          {loading ? "Syncing…" : "Sync knowledge"}
        </Button>
      </div>

      {inventory && (
        <p className="text-sm text-stone-600">
          Disk: {inventory.diskCount} · In database: {inventory.dbCount} · Ready:{" "}
          {inventory.readyCount}
          {inventory.missingCount > 0
            ? ` · Needs attention: ${inventory.missingCount}`
            : ""}
        </p>
      )}

      {log && <p className="text-sm text-teal-800">{log}</p>}
      {error && <p className="text-sm text-red-700">{error}</p>}

      {notReady.length > 0 && (
        <Card className="border-amber-300 bg-amber-50">
          <CardTitle className="text-amber-950">
            Files not ready ({notReady.length})
          </CardTitle>
          <ul className="mt-2 space-y-1 text-sm text-amber-950">
            {notReady.map((r) => (
              <li key={r.path}>
                <span className="font-medium">{r.path}</span> — {r.status}
                {r.error_message ? `: ${r.error_message}` : ""}
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-amber-900">
            Hit Sync knowledge again to queue these for AI processing.
          </p>
        </Card>
      )}

      {details && details.length > 0 && (
        <details className="rounded-lg border border-stone-200 bg-white/80 p-3 text-sm">
          <summary className="cursor-pointer font-medium text-stone-800">
            Last sync detail ({details.length} files)
          </summary>
          <ul className="mt-2 max-h-56 space-y-1 overflow-y-auto text-xs text-stone-600">
            {details.map((d) => (
              <li key={d.path}>
                <span className="font-medium text-stone-800">{d.path}</span> —{" "}
                {d.action} ({d.status})
              </li>
            ))}
          </ul>
        </details>
      )}

      <div className="space-y-2">
        {rows.map((r) => (
          <Card
            key={r.path}
            className={cn(
              r.status !== "ready" && "border-amber-300",
              /Transcript_0(9|10)/i.test(r.path) && "ring-1 ring-teal-700/30",
            )}
          >
            <CardTitle>{r.title}</CardTitle>
            <p className="mt-1 text-xs text-stone-500">
              {r.source_type} · {r.path} ·{" "}
              <span
                className={cn(
                  r.status === "ready"
                    ? "text-teal-800"
                    : r.status === "not_in_database"
                      ? "font-semibold text-red-700"
                      : "font-semibold text-amber-800",
                )}
              >
                {r.status}
              </span>
              {!r.inDatabase ? " · missing from database" : ""}
            </p>
            {r.error_message && (
              <p className="mt-1 text-xs text-red-600">{r.error_message}</p>
            )}
          </Card>
        ))}
        {rows.length === 0 && (
          <p className="text-sm text-stone-500">
            No files found under knowledge/.
          </p>
        )}
      </div>
    </div>
  );
}
