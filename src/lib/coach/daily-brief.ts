import { createClient } from "@/lib/supabase/server";
import { getAiProvider } from "@/lib/ai/provider";
import { coachSystemPrompt } from "@/lib/ai/prompts";
import { buildCoachContext } from "@/lib/coach/retrieval";
import { getTodayCheckin, shiftISODate } from "@/lib/coach/morning";
import { extractJson, todayISO } from "@/lib/utils";
import type { DailyBrief } from "@/lib/types";

type BriefPayload = {
  todays_identity: string;
  keystone_habit: string;
  principle_to_practice: string;
  principle_id?: string | null;
  challenge: string;
  reflection_question: string;
  evening_prompt: string;
  priorities: string;
  mindset_reminder: string;
  mantra: string;
};

function buildDailyQuery(
  date: string,
  morning: Awaited<ReturnType<typeof getTodayCheckin>>,
) {
  if (!morning) return `identity becoming habits challenges ${date}`;
  const parts = [
    morning.intention,
    morning.becoming_identity,
    ...(morning.gratitude ?? []).slice(0, 3),
    morning.mood != null ? `mood ${morning.mood}` : null,
    morning.energy != null ? `energy ${morning.energy}` : null,
    date,
  ].filter(Boolean);
  return parts.join(" ").slice(0, 500);
}

export async function getOrCreateDailyBrief(
  userId: string,
  options?: { regenerate?: boolean; provider?: string | null },
) {
  const supabase = await createClient();
  const date = todayISO();
  const yesterday = shiftISODate(date, -1);

  if (!options?.regenerate) {
    const { data: existing } = await supabase
      .from("daily_briefs")
      .select("*")
      .eq("user_id", userId)
      .eq("brief_date", date)
      .maybeSingle();
    if (existing) return existing as DailyBrief;
  }

  const [{ data: yesterdayBrief }, morning] = await Promise.all([
    supabase
      .from("daily_briefs")
      .select("principle_id, principle_to_practice, priorities")
      .eq("user_id", userId)
      .eq("brief_date", yesterday)
      .maybeSingle(),
    getTodayCheckin(userId),
  ]);

  const yesterdayPrincipleId =
    (yesterdayBrief as { principle_id?: string | null } | null)?.principle_id ??
    null;
  const yesterdayPrincipleTitle =
    (yesterdayBrief as { principle_to_practice?: string | null } | null)
      ?.principle_to_practice ?? null;

  const query = buildDailyQuery(date, morning);
  const context = await buildCoachContext(userId, query, {
    excludePrincipleIds: yesterdayPrincipleId ? [yesterdayPrincipleId] : [],
    variety: true,
    limit: 10,
  });

  const preferred = context.principles[0];
  const provider = getAiProvider(options?.provider);
  const raw = await provider.generate({
    system: coachSystemPrompt(),
    maxTokens: 2000,
    prompt: `Generate today's Coach Mode brief for date ${date}.

Return ONLY JSON:
{
  "todays_identity": "...",
  "keystone_habit": "...",
  "principle_to_practice": "title + one sentence why",
  "principle_id": "uuid if matching a provided principle else null",
  "challenge": "...",
  "reflection_question": "...",
  "evening_prompt": "...",
  "priorities": "3 short bullet priorities as one string with newlines",
  "mindset_reminder": "...",
  "mantra": "short mantra"
}

Hard rules for variety and personalization:
- This brief is for ${date}. Make principle_to_practice and priorities distinct for THIS day.
- Do NOT reuse yesterday's principle when alternatives exist. Yesterday's principle was: "${yesterdayPrincipleTitle ?? "none"}"${yesterdayPrincipleId ? ` (id ${yesterdayPrincipleId})` : ""}.
- Pick principle_id from the provided Context principles list. Prefer the first candidate when it fits today's morning, otherwise another from the list.
- Suggested principle for today: "${preferred?.title ?? "none"}" (id ${preferred?.id ?? "null"}).
- Priorities must be concrete actions for today, grounded in morning intention/becoming identity AND the chosen principle — never generic filler like "Protect deep work" unless that truly matches today's intention.
- Honor today's morning intention, becoming identity, gratitude, mood, and energy when present.
- Prefer the user's own knowledge principles over stock advice.

Context JSON:
${JSON.stringify(context)}`,
  });

  let parsed = extractJson<BriefPayload>(raw);
  if (!parsed) {
    parsed = {
      todays_identity:
        morning?.becoming_identity ||
        context.memory?.dream_identity?.split("\n")[0] ||
        "Be the person your principles describe.",
      keystone_habit:
        (context.habits[0] as { title?: string } | undefined)?.title ||
        "One focused block on what matters most",
      principle_to_practice:
        preferred
          ? `${preferred.title}: ${preferred.summary ?? "Practice this today."}`
          : "Act from identity, not mood",
      principle_id: preferred?.id ?? null,
      challenge: "Do the hard thing first for 25 minutes",
      reflection_question: "Where did I practice my chosen identity today?",
      evening_prompt: "What happened today? What patterns showed up?",
      priorities: [
        morning?.intention
          ? `1. Live today's intention: ${morning.intention.slice(0, 120)}`
          : "1. One identity vote before noon",
        preferred
          ? `2. Practice: ${preferred.title}`
          : "2. One relationship or body touchpoint",
        "3. Close the day with a 2-minute review",
      ].join("\n"),
      mindset_reminder: "Progress compounds when principles guide action.",
      mantra: "I become who I practice being.",
    };
  }

  // Enforce rotation if the model ignored the constraint.
  const candidateIds = new Set(context.principles.map((p) => p.id));
  let principleId = parsed.principle_id || preferred?.id || null;
  if (
    yesterdayPrincipleId &&
    principleId === yesterdayPrincipleId &&
    preferred?.id &&
    preferred.id !== yesterdayPrincipleId
  ) {
    principleId = preferred.id;
    parsed.principle_to_practice = `${preferred.title}: ${preferred.summary ?? "Practice this today."}`;
  }
  if (principleId && !candidateIds.has(principleId) && preferred?.id) {
    principleId = preferred.id;
  }

  const provenance = {
    source_principle_ids: context.principles.map((p) => p.id),
    source_principle_titles: context.principles.map((p) => p.title),
    principle_count:
      context.provenance?.principleCount ?? context.principles.length,
    source_count: context.provenance?.sourceCount ?? 0,
    recent_documents: context.provenance?.recentDocuments ?? [],
    excluded_yesterday_principle_id: yesterdayPrincipleId,
    retrieval_query: query,
  };

  const row = {
    user_id: userId,
    brief_date: date,
    todays_identity: parsed.todays_identity,
    keystone_habit: parsed.keystone_habit,
    principle_to_practice: parsed.principle_to_practice,
    principle_id: principleId,
    challenge: parsed.challenge,
    reflection_question: parsed.reflection_question,
    evening_prompt: parsed.evening_prompt,
    priorities: parsed.priorities,
    mindset_reminder: parsed.mindset_reminder,
    mantra: parsed.mantra,
    raw_json: { ...parsed, provenance },
  };

  const { data, error } = await supabase
    .from("daily_briefs")
    .upsert(row, { onConflict: "user_id,brief_date" })
    .select("*")
    .single();

  if (error) throw error;
  return data as DailyBrief;
}
