import { createClient } from "@/lib/supabase/server";
import { findRelated } from "@/lib/ai/embeddings";
import { getMorningContext } from "@/lib/coach/morning";
import type { IdentityMemory, Principle } from "@/lib/types";

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
}) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("principles")
    .select("*")
    .eq("user_id", args.userId)
    .order("updated_at", { ascending: false })
    .limit(args.limit ?? 5);
  return (data as Principle[]) ?? [];
}

export async function retrievePrinciples(args: {
  userId: string;
  query: string;
  category?: string;
  limit?: number;
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
    let q = supabase.from("principles").select("*").eq("user_id", args.userId).in("id", ids);
    if (args.category) q = q.eq("category", args.category);
    const { data } = await q;
    vectorPrinciples = (data as Principle[]) ?? [];
  }

  const scored = await getTopPrinciples({
    userId: args.userId,
    category: args.category,
    limit: limit * 2,
  });

  // Keyword boost for query terms
  const terms = args.query
    .toLowerCase()
    .split(/\W+/)
    .filter((t) => t.length > 3);
  const keywordMatches = scored.filter((p) => {
    const blob = `${p.title} ${p.summary ?? ""} ${p.explanation ?? ""} ${p.category ?? ""}`.toLowerCase();
    return terms.some((t) => blob.includes(t));
  });

  const byId = new Map<string, Principle>();
  for (const p of [...vectorPrinciples, ...keywordMatches, ...scored]) {
    if (!byId.has(p.id)) byId.set(p.id, p);
  }

  const ranked = [...byId.values()].sort((a, b) => {
    const score = (p: Principle) =>
      p.frequency_score * 2 + p.confidence_score + (ids.includes(p.id) ? 1.5 : 0);
    return score(b) - score(a);
  });

  return ranked.slice(0, limit);
}

/** Blend enduring + recently reinforced + query-relevant principles. */
export async function getBlendedPrinciples(args: {
  userId: string;
  query?: string;
  limit?: number;
  excludeIds?: string[];
  variety?: boolean;
}): Promise<Principle[]> {
  const limit = args.limit ?? 10;
  const exclude = new Set((args.excludeIds ?? []).filter(Boolean));
  const [top, recent, matched] = await Promise.all([
    getTopPrinciples({ userId: args.userId, limit: 10 }),
    getRecentPrinciples({ userId: args.userId, limit: 6 }),
    args.query
      ? retrievePrinciples({ userId: args.userId, query: args.query, limit: 8 })
      : Promise.resolve([] as Principle[]),
  ]);

  const byId = new Map<string, Principle>();
  for (const p of [...top, ...matched, ...recent]) {
    if (exclude.has(p.id)) continue;
    if (!byId.has(p.id)) byId.set(p.id, p);
  }

  let pool = [...byId.values()];
  // If exclusion emptied the pool, fall back to full set (better than no principles).
  if (!pool.length) {
    for (const p of [...top, ...matched, ...recent]) {
      if (!byId.has(p.id)) byId.set(p.id, p);
    }
    pool = [...byId.values()];
  }

  if (args.variety && pool.length > 2) {
    const byFreq = [...pool].sort(
      (a, b) => b.frequency_score - a.frequency_score,
    );
    const high = byFreq.slice(0, Math.ceil(byFreq.length / 2));
    const low = byFreq.slice(Math.ceil(byFreq.length / 2)).reverse();
    const interleaved: Principle[] = [];
    for (let i = 0; i < Math.max(high.length, low.length); i++) {
      if (high[i]) interleaved.push(high[i]);
      if (low[i]) interleaved.push(low[i]);
    }
    // Dedup while preserving interleave order
    const seen = new Set<string>();
    pool = interleaved.filter((p) => {
      if (seen.has(p.id)) return false;
      seen.add(p.id);
      return true;
    });
  }

  return pool.slice(0, limit);
}

export async function getPrincipleSourceSummary(userId: string, principleIds: string[]) {
  if (!principleIds.length) {
    return { sourceCount: 0, recentDocumentPaths: [] as string[] };
  }
  const supabase = await createClient();
  const { data } = await supabase
    .from("principle_sources")
    .select("document_id, documents(path)")
    .eq("user_id", userId)
    .in("principle_id", principleIds)
    .limit(80);

  const paths: string[] = [];
  const seen = new Set<string>();
  for (const row of data ?? []) {
    const path = (
      row as { documents?: { path?: string } | { path?: string }[] | null }
    ).documents;
    const p = Array.isArray(path) ? path[0]?.path : path?.path;
    if (p && !seen.has(p)) {
      seen.add(p);
      paths.push(p);
    }
  }
  return {
    sourceCount: (data ?? []).length,
    recentDocumentPaths: paths.slice(0, 5),
  };
}

export async function buildCoachContext(
  userId: string,
  query?: string,
  options?: { excludePrincipleIds?: string[]; variety?: boolean; limit?: number },
) {
  const [memory, principles, habits, morning] = await Promise.all([
    getIdentityMemory(userId),
    getBlendedPrinciples({
      userId,
      query,
      limit: options?.limit ?? 10,
      excludeIds: options?.excludePrincipleIds,
      variety: options?.variety ?? false,
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
  ]);

  const provenance = await getPrincipleSourceSummary(
    userId,
    principles.map((p) => p.id),
  );

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
    habits,
    morning,
    provenance: {
      principleCount: principles.length,
      sourceCount: provenance.sourceCount,
      recentDocuments: provenance.recentDocumentPaths,
      principleTitles: principles.slice(0, 6).map((p) => p.title),
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
