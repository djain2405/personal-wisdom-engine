import { createClient } from "@/lib/supabase/server";
import { findRelated } from "@/lib/ai/embeddings";
import { getMorningContext, shiftISODate } from "@/lib/coach/morning";
import { todayISO } from "@/lib/utils";
import type { IdentityMemory, Principle } from "@/lib/types";

export type KnowledgeExcerpt = {
  path: string;
  snippet: string;
  document_id?: string | null;
  processed_at?: string | null;
  source: "chunk" | "recent_document";
};

export type KnowledgeSource = {
  path: string;
  processed_at?: string | null;
  principle_title?: string | null;
  excerpt?: string | null;
};

function interleaveLanes(...lanes: Principle[][]): Principle[] {
  const max = Math.max(0, ...lanes.map((l) => l.length));
  const out: Principle[] = [];
  const seen = new Set<string>();
  for (let i = 0; i < max; i++) {
    for (const lane of lanes) {
      const p = lane[i];
      if (!p || seen.has(p.id)) continue;
      seen.add(p.id);
      out.push(p);
    }
  }
  return out;
}

function applyExclude(
  principles: Principle[],
  exclude: Set<string>,
): Principle[] {
  const filtered = principles.filter((p) => !exclude.has(p.id));
  return filtered.length ? filtered : principles;
}

/** Principles practiced in Coach briefs over the last N calendar days (incl. today). */
export async function getRecentPrincipleCooldown(
  userId: string,
  days = 7,
): Promise<{ ids: string[]; documents: string[] }> {
  const supabase = await createClient();
  const since = shiftISODate(todayISO(), -(days - 1));
  const { data } = await supabase
    .from("daily_briefs")
    .select("principle_id, raw_json")
    .eq("user_id", userId)
    .gte("brief_date", since);

  const ids = new Set<string>();
  const documents = new Set<string>();

  for (const row of data ?? []) {
    const principleId = (row as { principle_id?: string | null }).principle_id;
    if (principleId) ids.add(principleId);

    const raw = (row as { raw_json?: unknown }).raw_json;
    if (!raw || typeof raw !== "object") continue;
    const provenance = (raw as { provenance?: Record<string, unknown> })
      .provenance;
    if (!provenance) continue;

    const chosen = provenance.chosen_principle_id;
    if (typeof chosen === "string" && chosen) ids.add(chosen);

    const docs =
      provenance.knowledge_sources ??
      provenance.documents ??
      provenance.recent_documents;
    if (Array.isArray(docs)) {
      for (const d of docs) {
        if (typeof d === "string" && d) documents.add(d);
        else if (d && typeof d === "object" && "path" in d) {
          const path = (d as { path?: unknown }).path;
          if (typeof path === "string" && path) documents.add(path);
        }
      }
    }

    const excerpts = provenance.knowledge_excerpts;
    if (Array.isArray(excerpts)) {
      for (const e of excerpts) {
        if (e && typeof e === "object" && "path" in e) {
          const path = (e as { path?: unknown }).path;
          if (typeof path === "string" && path) documents.add(path);
        }
      }
    }
  }

  return { ids: [...ids], documents: [...documents] };
}

export async function getIdentityMemory(userId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("identity_memory")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  return (data as IdentityMemory | null) ?? null;
}

export async function getTopPrinciples(args: {
  userId: string;
  category?: string;
  limit?: number;
}) {
  const supabase = await createClient();
  let q = supabase
    .from("principles")
    .select("*")
    .eq("user_id", args.userId)
    .order("frequency_score", { ascending: false })
    .order("confidence_score", { ascending: false })
    .limit(args.limit ?? 12);
  if (args.category) q = q.eq("category", args.category);
  const { data } = await q;
  return (data as Principle[]) ?? [];
}

export async function getRecentPrinciples(args: {
  userId: string;
  limit?: number;
  excludeIds?: string[];
}) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("principles")
    .select("*")
    .eq("user_id", args.userId)
    .order("updated_at", { ascending: false })
    .limit((args.limit ?? 5) * 3);
  const exclude = new Set(args.excludeIds ?? []);
  return applyExclude((data as Principle[]) ?? [], exclude).slice(
    0,
    args.limit ?? 5,
  );
}

/** Long-tail / underused principles — opposite of the frequency elite. */
export async function getUnderusedPrinciples(args: {
  userId: string;
  limit?: number;
  excludeIds?: string[];
}) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("principles")
    .select("*")
    .eq("user_id", args.userId)
    .order("frequency_score", { ascending: true })
    .order("updated_at", { ascending: false })
    .limit((args.limit ?? 8) * 2);
  const exclude = new Set(args.excludeIds ?? []);
  return applyExclude((data as Principle[]) ?? [], exclude).slice(
    0,
    args.limit ?? 8,
  );
}

export async function retrievePrinciples(args: {
  userId: string;
  query: string;
  category?: string;
  limit?: number;
  /** When true, weigh vector/keyword match over frequency. */
  variety?: boolean;
}): Promise<Principle[]> {
  const limit = args.limit ?? 8;
  const supabase = await createClient();

  const vectorHits = await findRelated({
    userId: args.userId,
    query: args.query,
    entityType: "principle",
    limit: limit * 2,
  });

  const ids = vectorHits.map((h) => h.entity_id).filter(Boolean);
  let vectorPrinciples: Principle[] = [];
  if (ids.length) {
    let q = supabase
      .from("principles")
      .select("*")
      .eq("user_id", args.userId)
      .in("id", ids);
    if (args.category) q = q.eq("category", args.category);
    const { data } = await q;
    vectorPrinciples = (data as Principle[]) ?? [];
  }

  const scored = await getTopPrinciples({
    userId: args.userId,
    category: args.category,
    limit: limit * 2,
  });

  const terms = args.query
    .toLowerCase()
    .split(/\W+/)
    .filter((t) => t.length > 3);
  const keywordMatches = scored.filter((p) => {
    const blob =
      `${p.title} ${p.summary ?? ""} ${p.explanation ?? ""} ${p.category ?? ""}`.toLowerCase();
    return terms.some((t) => blob.includes(t));
  });

  const byId = new Map<string, Principle>();
  for (const p of [...vectorPrinciples, ...keywordMatches, ...scored]) {
    if (!byId.has(p.id)) byId.set(p.id, p);
  }

  const similarityById = new Map(
    vectorHits.map((h) => [h.entity_id, h.similarity ?? 0]),
  );

  const ranked = [...byId.values()].sort((a, b) => {
    const score = (p: Principle) => {
      const vectorBonus = ids.includes(p.id)
        ? args.variety
          ? 4 + (similarityById.get(p.id) ?? 0) * 2
          : 1.5
        : 0;
      const keywordBonus = keywordMatches.some((k) => k.id === p.id)
        ? args.variety
          ? 2
          : 0.5
        : 0;
      const freqWeight = args.variety
        ? p.frequency_score * 0.35
        : p.frequency_score * 2;
      return freqWeight + p.confidence_score + vectorBonus + keywordBonus;
    };
    return score(b) - score(a);
  });

  return ranked.slice(0, limit);
}

/**
 * Blend query-matched + underused + freshly reinforced + small enduring anchor.
 * With variety, prefers long-tail and match over pure frequency.
 */
export async function getBlendedPrinciples(args: {
  userId: string;
  query?: string;
  limit?: number;
  excludeIds?: string[];
  variety?: boolean;
}): Promise<Principle[]> {
  const limit = args.limit ?? 10;
  const exclude = new Set((args.excludeIds ?? []).filter(Boolean));
  const variety = args.variety ?? false;

  const [top, recent, underused, matched] = await Promise.all([
    getTopPrinciples({ userId: args.userId, limit: variety ? 6 : 10 }),
    getRecentPrinciples({
      userId: args.userId,
      limit: variety ? 6 : 6,
      excludeIds: [...exclude],
    }),
    variety
      ? getUnderusedPrinciples({
          userId: args.userId,
          limit: 8,
          excludeIds: [...exclude],
        })
      : Promise.resolve([] as Principle[]),
    args.query
      ? retrievePrinciples({
          userId: args.userId,
          query: args.query,
          limit: variety ? 10 : 8,
          variety,
        })
      : Promise.resolve([] as Principle[]),
  ]);

  const topEliteIds = new Set(top.slice(0, 4).map((p) => p.id));
  // Freshly reinforced but not the eternal top elite
  const fresh = recent.filter((p) => !topEliteIds.has(p.id));

  if (!variety) {
    const byId = new Map<string, Principle>();
    for (const p of [...top, ...matched, ...recent]) {
      if (exclude.has(p.id)) continue;
      if (!byId.has(p.id)) byId.set(p.id, p);
    }
    let pool = [...byId.values()];
    if (!pool.length) {
      for (const p of [...top, ...matched, ...recent]) {
        if (!byId.has(p.id)) byId.set(p.id, p);
      }
      pool = [...byId.values()];
    }
    return pool.slice(0, limit);
  }

  const matchedLane = applyExclude(matched, exclude);
  const underusedLane = applyExclude(underused, exclude);
  const freshLane = applyExclude(fresh.length ? fresh : recent, exclude);
  const anchorLane = applyExclude(top.slice(0, 2), exclude);

  let pool = interleaveLanes(
    matchedLane,
    underusedLane,
    freshLane,
    anchorLane,
  );

  if (!pool.length) {
    const byId = new Map<string, Principle>();
    for (const p of [...matched, ...underused, ...fresh, ...top, ...recent]) {
      if (!byId.has(p.id)) byId.set(p.id, p);
    }
    pool = [...byId.values()];
  }

  return pool.slice(0, limit);
}

/** Prefer underused / matched candidates over high-frequency anchors. */
export function preferVariedPrinciple(
  principles: Array<{
    id: string;
    title: string;
    summary?: string | null;
    frequency_score?: number;
  }>,
): (typeof principles)[number] | undefined {
  if (!principles.length) return undefined;
  // Interleave puts matched/underused early — pick lowest frequency among first 5
  const head = principles.slice(0, Math.min(5, principles.length));
  return [...head].sort(
    (a, b) => (a.frequency_score ?? 0) - (b.frequency_score ?? 0),
  )[0];
}

export async function getFreshKnowledgeExcerpts(args: {
  userId: string;
  query?: string;
  limit?: number;
  avoidPaths?: string[];
}): Promise<KnowledgeExcerpt[]> {
  const limit = args.limit ?? 6;
  const avoid = new Set(args.avoidPaths ?? []);
  const supabase = await createClient();
  const since = shiftISODate(todayISO(), -14);

  const [chunkHits, recentDocs] = await Promise.all([
    args.query
      ? findRelated({
          userId: args.userId,
          query: args.query,
          entityType: "chunk",
          limit: limit * 2,
        })
      : Promise.resolve([]),
    supabase
      .from("documents")
      .select("id, path, processed_at, source_type, raw_text")
      .eq("user_id", args.userId)
      .eq("status", "ready")
      .or(`processed_at.gte.${since},created_at.gte.${since}`)
      .order("processed_at", { ascending: false, nullsFirst: false })
      .limit(12),
  ]);

  const excerpts: KnowledgeExcerpt[] = [];
  const seenPaths = new Set<string>();

  // Resolve chunk → document path
  const chunkIds = chunkHits.map((h) => h.entity_id).filter(Boolean);
  let chunkMeta = new Map<
    string,
    { path: string; document_id: string; processed_at: string | null }
  >();
  if (chunkIds.length) {
    const { data: chunks } = await supabase
      .from("document_chunks")
      .select("id, document_id, documents(path, processed_at)")
      .in("id", chunkIds);
    for (const row of chunks ?? []) {
      const docs = (
        row as {
          id: string;
          document_id: string;
          documents?:
            | { path?: string; processed_at?: string | null }
            | { path?: string; processed_at?: string | null }[]
            | null;
        }
      ).documents;
      const doc = Array.isArray(docs) ? docs[0] : docs;
      if (doc?.path) {
        chunkMeta.set(row.id as string, {
          path: doc.path,
          document_id: (row as { document_id: string }).document_id,
          processed_at: doc.processed_at ?? null,
        });
      }
    }
  }

  for (const hit of chunkHits) {
    if (excerpts.length >= limit) break;
    const meta = chunkMeta.get(hit.entity_id);
    const path = meta?.path ?? `chunk:${hit.entity_id}`;
    if (avoid.has(path) || seenPaths.has(path)) continue;
    seenPaths.add(path);
    excerpts.push({
      path,
      snippet: (hit.content ?? "").slice(0, 400).trim(),
      document_id: meta?.document_id ?? null,
      processed_at: meta?.processed_at ?? null,
      source: "chunk",
    });
  }

  for (const doc of recentDocs.data ?? []) {
    if (excerpts.length >= limit) break;
    const path = (doc as { path: string }).path;
    if (!path || avoid.has(path) || seenPaths.has(path)) continue;
    seenPaths.add(path);
    const raw = ((doc as { raw_text?: string | null }).raw_text ?? "").trim();
    excerpts.push({
      path,
      snippet: raw.slice(0, 400) || `(Recently processed: ${path})`,
      document_id: (doc as { id: string }).id,
      processed_at: (doc as { processed_at?: string | null }).processed_at ?? null,
      source: "recent_document",
    });
  }

  // If avoid filtered everything, retry without avoid so we still ground the brief
  if (!excerpts.length && avoid.size) {
    return getFreshKnowledgeExcerpts({
      ...args,
      avoidPaths: [],
    });
  }

  return excerpts.slice(0, limit);
}

export async function getPrincipleSourceSummary(
  userId: string,
  principleIds: string[],
  options?: {
    avoidPaths?: string[];
    principleTitles?: Map<string, string>;
    limit?: number;
  },
) {
  if (!principleIds.length) {
    return {
      sourceCount: 0,
      sources: [] as KnowledgeSource[],
      recentDocumentPaths: [] as string[],
    };
  }
  const supabase = await createClient();
  const { data } = await supabase
    .from("principle_sources")
    .select(
      "principle_id, excerpt, created_at, documents(path, processed_at)",
    )
    .eq("user_id", userId)
    .in("principle_id", principleIds)
    .order("created_at", { ascending: false })
    .limit(80);

  type Row = {
    principle_id: string;
    excerpt?: string | null;
    created_at?: string;
    documents?:
      | { path?: string; processed_at?: string | null }
      | { path?: string; processed_at?: string | null }[]
      | null;
  };

  const rows = (data ?? []) as Row[];
  const avoid = new Set(options?.avoidPaths ?? []);
  const titles = options?.principleTitles;
  const limit = options?.limit ?? 6;

  const toSource = (row: Row): KnowledgeSource | null => {
    const docs = row.documents;
    const doc = Array.isArray(docs) ? docs[0] : docs;
    const path = doc?.path;
    if (!path) return null;
    return {
      path,
      processed_at: doc?.processed_at ?? row.created_at ?? null,
      principle_title: titles?.get(row.principle_id) ?? null,
      excerpt: row.excerpt?.slice(0, 220) ?? null,
    };
  };

  const preferred: KnowledgeSource[] = [];
  const fallback: KnowledgeSource[] = [];
  const seen = new Set<string>();

  // Prefer sources not cited in the last week; sort by processed_at desc within each bucket
  const enriched = rows
    .map(toSource)
    .filter((s): s is KnowledgeSource => Boolean(s))
    .sort((a, b) => {
      const ta = a.processed_at ? Date.parse(a.processed_at) : 0;
      const tb = b.processed_at ? Date.parse(b.processed_at) : 0;
      return tb - ta;
    });

  for (const source of enriched) {
    if (seen.has(source.path)) continue;
    seen.add(source.path);
    if (avoid.has(source.path)) fallback.push(source);
    else preferred.push(source);
  }

  const sources = [...preferred, ...fallback].slice(0, limit);
  return {
    sourceCount: rows.length,
    sources,
    recentDocumentPaths: sources.map((s) => s.path),
  };
}

export async function buildCoachContext(
  userId: string,
  query?: string,
  options?: {
    excludePrincipleIds?: string[];
    variety?: boolean;
    limit?: number;
    /** Defaults true — load 7-day brief cooldown automatically. */
    applyCooldown?: boolean;
    includeExcerpts?: boolean;
  },
) {
  const variety = options?.variety ?? true;
  const applyCooldown = options?.applyCooldown ?? true;

  const cooldown = applyCooldown
    ? await getRecentPrincipleCooldown(userId, 7)
    : { ids: [] as string[], documents: [] as string[] };

  const excludeIds = [
    ...new Set([
      ...(options?.excludePrincipleIds ?? []),
      ...cooldown.ids,
    ]),
  ];

  const [memory, principles, habits, morning, excerpts] = await Promise.all([
    getIdentityMemory(userId),
    getBlendedPrinciples({
      userId,
      query,
      limit: options?.limit ?? 10,
      excludeIds,
      variety,
    }),
    (async () => {
      const supabase = await createClient();
      const { data } = await supabase
        .from("habits")
        .select("id, title, description, category")
        .eq("user_id", userId)
        .limit(15);
      return data ?? [];
    })(),
    getMorningContext(userId),
    options?.includeExcerpts === false
      ? Promise.resolve([] as KnowledgeExcerpt[])
      : getFreshKnowledgeExcerpts({
          userId,
          query,
          limit: 5,
          avoidPaths: cooldown.documents,
        }),
  ]);

  const titleMap = new Map(principles.map((p) => [p.id, p.title]));
  const provenance = await getPrincipleSourceSummary(
    userId,
    principles.map((p) => p.id),
    {
      avoidPaths: cooldown.documents,
      principleTitles: titleMap,
      limit: 6,
    },
  );

  const preferred = preferVariedPrinciple(principles);

  return {
    memory: memory
      ? {
          dream_identity: memory.dream_identity,
          values: memory.values,
          goals: memory.goals,
          current_habits: memory.current_habits,
          challenges: memory.challenges,
          life_areas: memory.life_areas,
        }
      : null,
    principles: principles.map((p) => ({
      id: p.id,
      title: p.title,
      summary: p.summary,
      category: p.category,
      action_steps: p.action_steps,
      questions: p.questions,
      confidence_score: p.confidence_score,
      frequency_score: p.frequency_score,
    })),
    preferredPrincipleId: preferred?.id ?? null,
    habits,
    morning,
    knowledge_excerpts: excerpts,
    provenance: {
      principleCount: principles.length,
      sourceCount: provenance.sourceCount,
      documents: provenance.sources,
      principleTitles: principles.slice(0, 8).map((p) => p.title),
      excludedPrincipleIds: excludeIds,
      cooldownDays: applyCooldown ? 7 : 0,
    },
  };
}

export function formatPrinciplesForPrompt(principles: Principle[]) {
  return principles
    .map(
      (p, i) =>
        `${i + 1}. [${p.category ?? "General"}] ${p.title} (freq=${p.frequency_score.toFixed(1)}, conf=${p.confidence_score.toFixed(2)})\n   ${p.summary ?? ""}\n   Actions: ${(p.action_steps ?? []).slice(0, 3).join("; ")}`,
    )
    .join("\n");
}
