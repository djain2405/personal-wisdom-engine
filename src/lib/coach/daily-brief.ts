import { createClient } from "@/lib/supabase/server";
import { getAiProvider } from "@/lib/ai/provider";
import { coachSystemPrompt } from "@/lib/ai/prompts";
import {
  buildCoachContext,
  getRecentPrincipleCooldown,
  preferVariedPrinciple,
} from "@/lib/coach/retrieval";
import { getTodayCheckin, shiftISODate } from "@/lib/coach/morning";
import {
  defaultDecisionFilter,
  defaultEveningPrompt,
  defaultMiddayCheck,
} from "@/lib/coach/compass";
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
  midday_check?: string;
  decision_filter?: string;
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

  const [{ data: yesterdayBrief }, morning, cooldown] = await Promise.all([
    supabase
      .from("daily_briefs")
      .select("principle_id, principle_to_practice, priorities")
      .eq("user_id", userId)
      .eq("brief_date", yesterday)
      .maybeSingle(),
    getTodayCheckin(userId),
    getRecentPrincipleCooldown(userId, 7),
  ]);

  const yesterdayPrincipleId =
    (yesterdayBrief as { principle_id?: string | null } | null)?.principle_id ??
    null;
  const yesterdayPrincipleTitle =
    (yesterdayBrief as { principle_to_practice?: string | null } | null)
      ?.principle_to_practice ?? null;

  const query = buildDailyQuery(date, morning);
  // Cooldown is applied inside buildCoachContext; also pass yesterday explicitly
  const context = await buildCoachContext(userId, query, {
    excludePrincipleIds: yesterdayPrincipleId ? [yesterdayPrincipleId] : [],
    variety: true,
    limit: 10,
    applyCooldown: true,
    includeExcerpts: true,
  });

  const preferred =
    preferVariedPrinciple(context.principles) ??
    context.principles.find((p) => p.id === context.preferredPrincipleId) ??
    context.principles[0];

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
  "evening_prompt": "What evidence did I collect today? (Daily Compass evening)",
  "midday_check": "short Midday attention check: question + gentle redirect (2-3 sentences)",
  "decision_filter": "Future-self decision filter: question + 3-5 concrete example actions for THIS user today",
  "priorities": "3 short bullet priorities as one string with newlines",
  "mindset_reminder": "...",
  "mantra": "short mantra"
}

Hard rules for variety and personalization:
- This brief is for ${date}. Make principle_to_practice and priorities distinct for THIS day.
- Do NOT reuse principles from the last 7 days when alternatives exist. Cooldown ids: ${JSON.stringify(cooldown.ids.slice(0, 20))}.
- Yesterday's principle was: "${yesterdayPrincipleTitle ?? "none"}"${yesterdayPrincipleId ? ` (id ${yesterdayPrincipleId})` : ""}.
- Pick principle_id from the provided Context principles list.
- Prefer underused / query-matched principles and freshly ingested knowledge excerpts over high-frequency favorites.
- Suggested principle for today: "${preferred?.title ?? "none"}" (id ${preferred?.id ?? "null"}).
- Ground priorities in morning intention + chosen principle + knowledge_excerpts when present.
- Priorities must be concrete actions for today — never generic filler like "Protect deep work" unless that truly matches today's intention.
- Prefer the user's own knowledge principles over stock advice.
- midday_check and decision_filter must follow Daily Compass: Midday = attention redirect; Decision = "What does my future self do now?" with concrete actions.

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
      principle_to_practice: preferred
        ? `${preferred.title}: ${preferred.summary ?? "Practice this today."}`
        : "Act from identity, not mood",
      principle_id: preferred?.id ?? null,
      challenge: "Do the hard thing first for 25 minutes",
      reflection_question: "Where did I practice my chosen identity today?",
      evening_prompt: defaultEveningPrompt(),
      midday_check: defaultMiddayCheck(),
      decision_filter: defaultDecisionFilter(),
      priorities: [
        morning?.intention
          ? `1. Live today's intention: ${morning.intention.slice(0, 120)}`
          : "1. One identity vote before noon",
        preferred
          ? `2. Practice: ${preferred.title}`
          : "2. One relationship or body touchpoint",
        "3. Close the day with three evidence bullets",
      ].join("\n"),
      mindset_reminder: "Progress compounds when principles guide action.",
      mantra: "I become who I practice being.",
    };
  }

  parsed.evening_prompt = parsed.evening_prompt?.trim() || defaultEveningPrompt();
  parsed.midday_check = parsed.midday_check?.trim() || defaultMiddayCheck();
  parsed.decision_filter =
    parsed.decision_filter?.trim() || defaultDecisionFilter();

  const candidateIds = new Set(context.principles.map((p) => p.id));
  const cooldownSet = new Set(cooldown.ids);
  let principleId = parsed.principle_id || preferred?.id || null;

  // Enforce: not yesterday, not in 7-day cooldown when alternatives exist
  const isBlocked = (id: string | null | undefined) =>
    Boolean(
      id &&
        (id === yesterdayPrincipleId || cooldownSet.has(id)) &&
        preferred?.id &&
        preferred.id !== id,
    );

  if (isBlocked(principleId) && preferred?.id) {
    principleId = preferred.id;
    parsed.principle_to_practice = `${preferred.title}: ${preferred.summary ?? "Practice this today."}`;
  }
  if (principleId && !candidateIds.has(principleId) && preferred?.id) {
    principleId = preferred.id;
  }

  const chosen =
    context.principles.find((p) => p.id === principleId) ?? preferred;

  const provenance = {
    chosen_principle_id: principleId,
    chosen_principle_title: chosen?.title ?? null,
    source_principle_ids: context.principles.map((p) => p.id),
    source_principle_titles: context.principles.map((p) => p.title),
    candidate_principle_titles: context.principles.map((p) => p.title),
    principle_count:
      context.provenance?.principleCount ?? context.principles.length,
    source_count: context.provenance?.sourceCount ?? 0,
    knowledge_sources: context.provenance?.documents ?? [],
    knowledge_excerpts: context.knowledge_excerpts ?? [],
    excluded_principle_ids: context.provenance?.excludedPrincipleIds ?? [],
    excluded_yesterday_principle_id: yesterdayPrincipleId,
    cooldown_days: 7,
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
