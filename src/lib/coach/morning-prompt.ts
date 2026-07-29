import { createClient } from "@/lib/supabase/server";
import { getAiProvider } from "@/lib/ai/provider";
import { coachSystemPrompt } from "@/lib/ai/prompts";
import { shiftISODate } from "@/lib/coach/morning";
import { getBlendedPrinciples, getIdentityMemory } from "@/lib/coach/retrieval";
import { todayISO } from "@/lib/utils";
import type { MorningCheckin } from "@/lib/types";

const FALLBACK_PROMPTS = [
  "Where am I voting for my future self today — and where am I voting against it?",
  "What would Future Me ask me to notice before noon?",
  "What feeling am I treating as a signal rather than a verdict?",
  "Which principle wants practice in the next hard conversation or task?",
  "What am I ready to release so I can become who I say I am?",
];

function fallbackPromptForDate(date: string) {
  const dayNum = Number(date.replaceAll("-", "")) || 0;
  return FALLBACK_PROMPTS[dayNum % FALLBACK_PROMPTS.length];
}

/** One fresh reflection prompt per calendar day, grounded in the user's wisdom. */
export async function getOrCreateMorningPrompt(userId: string) {
  const supabase = await createClient();
  const date = todayISO();
  const yesterday = shiftISODate(date, -1);

  const { data: existing } = await supabase
    .from("morning_checkins")
    .select("*")
    .eq("user_id", userId)
    .eq("checkin_date", date)
    .maybeSingle();

  const existingCheckin = existing as MorningCheckin | null;
  if (existingCheckin?.reflection_prompt?.trim()) {
    return {
      prompt: existingCheckin.reflection_prompt.trim(),
      checkin: existingCheckin,
    };
  }

  const [memory, principles, evening] = await Promise.all([
    getIdentityMemory(userId),
    getBlendedPrinciples({
      userId,
      query: `morning reflection identity becoming ${date}`,
      limit: 5,
      variety: true,
    }),
    supabase
      .from("evening_reviews")
      .select("wins, patterns, identity_reinforce, tomorrow")
      .eq("user_id", userId)
      .eq("review_date", yesterday)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  let prompt = fallbackPromptForDate(date);
  try {
    const provider = getAiProvider();
    const raw = await provider.generate({
      system: coachSystemPrompt(),
      maxTokens: 200,
      prompt: `Write ONE morning reflection prompt for date ${date}.

Rules:
- One or two sentences max. No preamble. No quotes around the whole answer.
- Personal, sharp, identity-first — grounded in THIS user's principles and dream identity.
- Different from generic journaling fluff. Make it specific to their philosophy.
- Do not ask more than one core question.

Dream identity: ${memory?.dream_identity ?? "becoming their best self"}
Principles: ${principles.map((p) => p.title).join("; ") || "identity through action"}
Yesterday evening: ${JSON.stringify(evening.data ?? null)}

Return ONLY the prompt text.`,
    });
    const cleaned = raw
      .replace(/^["'\s]+|["'\s]+$/g, "")
      .replace(/^Prompt:\s*/i, "")
      .trim();
    if (cleaned.length >= 12 && cleaned.length <= 400) {
      prompt = cleaned;
    }
  } catch {
    // keep date-based fallback
  }

  const { data: upserted, error } = await supabase
    .from("morning_checkins")
    .upsert(
      {
        user_id: userId,
        checkin_date: date,
        reflection_prompt: prompt,
        gratitude: existingCheckin?.gratitude ?? [],
        intention: existingCheckin?.intention ?? null,
        becoming_identity: existingCheckin?.becoming_identity ?? null,
        reflection: existingCheckin?.reflection ?? null,
        mood: existingCheckin?.mood ?? null,
        energy: existingCheckin?.energy ?? null,
      },
      { onConflict: "user_id,checkin_date" },
    )
    .select("*")
    .single();

  if (error) throw error;
  return {
    prompt,
    checkin: upserted as MorningCheckin,
  };
}
