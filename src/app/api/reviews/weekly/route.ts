import { NextResponse } from "next/server";
import { getAppUser } from "@/lib/auth";
import { getAiProvider } from "@/lib/ai/provider";
import { coachSystemPrompt } from "@/lib/ai/prompts";
import { COMPASS, type WeeklyCompassAnswers } from "@/lib/coach/compass";
import { buildCoachContext } from "@/lib/coach/retrieval";
import { extractJson, startOfWeekISO } from "@/lib/utils";

function parseCompass(raw: unknown): WeeklyCompassAnswers | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;
  const answers = {} as WeeklyCompassAnswers;
  for (const q of COMPASS.weekly.questions) {
    const value = obj[q.key];
    if (typeof value !== "string" || !value.trim()) return null;
    answers[q.key] = value.trim();
  }
  return answers;
}

export async function POST(request: Request) {
  const { supabase, user } = await getAppUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const compass = parseCompass(body?.compass);
  if (!compass) {
    return NextResponse.json(
      { error: "All six Weekly Reset answers are required" },
      { status: 400 },
    );
  }

  const weekStart = startOfWeekISO();
  const { data: profile } = await supabase
    .from("profiles")
    .select("ai_provider")
    .eq("id", user.id)
    .maybeSingle();

  const [{ data: evenings }, { data: briefs }, context] = await Promise.all([
    supabase
      .from("evening_reviews")
      .select("review_date, wins, patterns, identity_reinforce, tomorrow, narrative")
      .eq("user_id", user.id)
      .gte("review_date", weekStart)
      .order("review_date", { ascending: true }),
    supabase
      .from("daily_briefs")
      .select("brief_date, todays_identity, principle_to_practice, challenge")
      .eq("user_id", user.id)
      .gte("brief_date", weekStart),
    buildCoachContext(user.id, "weekly review patterns lessons identity"),
  ]);

  try {
    const provider = getAiProvider(
      (profile as { ai_provider?: string } | null)?.ai_provider,
    );
    const compassBlock = COMPASS.weekly.questions
      .map((q) => `${q.label}\n${compass[q.key]}`)
      .join("\n\n");

    const raw = await provider.generate({
      system: coachSystemPrompt(),
      maxTokens: 2500,
      prompt: `Generate a Weekly Reset synthesis (Daily Compass).

The user answered the six Compass questions:

${compassBlock}

Return JSON:
{
  "wins": "...",
  "lessons": "...",
  "patterns": "...",
  "repeated_mistakes": "...",
  "recurring_thoughts": "...",
  "best_principles": "...",
  "focus_next": "...",
  "markdown": "well-structured markdown with ## headings synthesizing their Compass answers"
}

Ground the markdown in THEIR Compass answers first, then evening reviews and daily briefs.
Evening reviews: ${JSON.stringify(evenings ?? [])}
Daily briefs: ${JSON.stringify(briefs ?? [])}
Use morning check-ins and habit consistency in Context for trends. Be specific and non-judgmental.
Context: ${JSON.stringify(context)}`,
    });

    const parsed = extractJson<{
      wins?: string;
      lessons?: string;
      patterns?: string;
      repeated_mistakes?: string;
      recurring_thoughts?: string;
      best_principles?: string;
      focus_next?: string;
      markdown?: string;
    }>(raw);

    const { data } = await supabase
      .from("weekly_reviews")
      .upsert(
        {
          user_id: user.id,
          week_start: weekStart,
          wins: parsed?.wins ?? null,
          lessons: parsed?.lessons ?? null,
          patterns: parsed?.patterns ?? null,
          repeated_mistakes: parsed?.repeated_mistakes ?? null,
          recurring_thoughts: parsed?.recurring_thoughts ?? null,
          best_principles: parsed?.best_principles ?? null,
          focus_next: parsed?.focus_next ?? null,
          raw_json: { ...(parsed ?? { raw }), compass },
        },
        { onConflict: "user_id,week_start" },
      )
      .select("*")
      .single();

    return NextResponse.json({
      review: data,
      markdown: parsed?.markdown ?? raw,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "AI failed" },
      { status: 500 },
    );
  }
}

export async function GET() {
  const { supabase, user } = await getAppUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data } = await supabase
    .from("weekly_reviews")
    .select("*")
    .eq("user_id", user.id)
    .order("week_start", { ascending: false })
    .limit(12);

  return NextResponse.json({ reviews: data ?? [] });
}
