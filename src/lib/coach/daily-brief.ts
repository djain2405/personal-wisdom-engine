import { createClient } from "@/lib/supabase/server";
import { getAiProvider } from "@/lib/ai/provider";
import { coachSystemPrompt } from "@/lib/ai/prompts";
import { buildCoachContext } from "@/lib/coach/retrieval";
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

export async function getOrCreateDailyBrief(
  userId: string,
  options?: { regenerate?: boolean; provider?: string | null },
) {
  const supabase = await createClient();
  const date = todayISO();

  if (!options?.regenerate) {
    const { data: existing } = await supabase
      .from("daily_briefs")
      .select("*")
      .eq("user_id", userId)
      .eq("brief_date", date)
      .maybeSingle();
    if (existing) return existing as DailyBrief;
  }

  const context = await buildCoachContext(userId, "daily coach identity habits challenges");
  const provider = getAiProvider(options?.provider);
  const raw = await provider.generate({
    system: coachSystemPrompt(),
    maxTokens: 2000,
    prompt: `Generate today's Coach Mode brief for the user.

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

Use the user's dream identity and recurring principles. Prefer high frequency/confidence principles.

Context JSON:
${JSON.stringify(context)}`,
  });

  const parsed = extractJson<BriefPayload>(raw) ?? {
    todays_identity:
      context.memory?.dream_identity?.split("\n")[0] ||
      "Be the person your principles describe.",
    keystone_habit:
      (context.habits[0] as { title?: string } | undefined)?.title ||
      "One focused block on what matters most",
    principle_to_practice:
      context.principles[0]?.title ||
      "Act from identity, not mood",
    principle_id: context.principles[0]?.id ?? null,
    challenge: "Do the hard thing first for 25 minutes",
    reflection_question: "Where did I practice my chosen identity today?",
    evening_prompt: "What happened today? What patterns showed up?",
    priorities: "1. Protect deep work\n2. One relationship touchpoint\n3. Move your body",
    mindset_reminder: "Progress compounds when principles guide action.",
    mantra: "I become who I practice being.",
  };

  const row = {
    user_id: userId,
    brief_date: date,
    todays_identity: parsed.todays_identity,
    keystone_habit: parsed.keystone_habit,
    principle_to_practice: parsed.principle_to_practice,
    principle_id: parsed.principle_id || context.principles[0]?.id || null,
    challenge: parsed.challenge,
    reflection_question: parsed.reflection_question,
    evening_prompt: parsed.evening_prompt,
    priorities: parsed.priorities,
    mindset_reminder: parsed.mindset_reminder,
    mantra: parsed.mantra,
    raw_json: parsed,
  };

  const { data, error } = await supabase
    .from("daily_briefs")
    .upsert(row, { onConflict: "user_id,brief_date" })
    .select("*")
    .single();

  if (error) throw error;
  return data as DailyBrief;
}
