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

export async function buildCoachContext(userId: string, query?: string) {
  const [memory, principles, habits, morning] = await Promise.all([
    getIdentityMemory(userId),
    query
      ? retrievePrinciples({ userId, query, limit: 8 })
      : getTopPrinciples({ userId, limit: 10 }),
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
