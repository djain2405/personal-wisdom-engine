import { NextResponse } from "next/server";
import { getAppUser } from "@/lib/auth";
import { getAiProvider } from "@/lib/ai/provider";
import { coachSystemPrompt } from "@/lib/ai/prompts";
import { buildCoachContext } from "@/lib/coach/retrieval";
import { extractJson, startOfMonthISO } from "@/lib/utils";

export async function POST() {
  const { supabase, user } = await getAppUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const monthStart = startOfMonthISO();
  const { data: profile } = await supabase
    .from("profiles")
    .select("ai_provider")
    .eq("id", user.id)
    .maybeSingle();

  const [{ data: evenings }, { data: weeklies }, { data: memory }, context] =
    await Promise.all([
      supabase
        .from("evening_reviews")
        .select("review_date, wins, patterns, identity_reinforce")
        .eq("user_id", user.id)
        .gte("review_date", monthStart)
        .limit(40),
      supabase
        .from("weekly_reviews")
        .select("*")
        .eq("user_id", user.id)
        .gte("week_start", monthStart)
        .limit(6),
      supabase
        .from("identity_memory")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle(),
      buildCoachContext(user.id, "monthly identity growth habits emotions"),
    ]);

  try {
    const provider = getAiProvider(
      (profile as { ai_provider?: string } | null)?.ai_provider,
    );
    const raw = await provider.generate({
      system: coachSystemPrompt(),
      maxTokens: 2800,
      prompt: `Generate a Monthly Identity Report.

Return JSON:
{
  "identity_shifts": "...",
  "growth": "...",
  "habit_trends": "...",
  "emotional_trends": "...",
  "what_improved": "...",
  "what_needs_work": "...",
  "recommended_principles": "...",
  "markdown": "..."
}

Memory: ${JSON.stringify(memory)}
Evenings: ${JSON.stringify(evenings ?? [])}
Weeklies: ${JSON.stringify(weeklies ?? [])}
Context: ${JSON.stringify(context)}`,
    });

    const parsed = extractJson<{
      identity_shifts?: string;
      growth?: string;
      habit_trends?: string;
      emotional_trends?: string;
      what_improved?: string;
      what_needs_work?: string;
      recommended_principles?: string;
      markdown?: string;
    }>(raw);

    const { data } = await supabase
      .from("monthly_reports")
      .upsert(
        {
          user_id: user.id,
          month_start: monthStart,
          identity_shifts: parsed?.identity_shifts ?? null,
          growth: parsed?.growth ?? null,
          habit_trends: parsed?.habit_trends ?? null,
          emotional_trends: parsed?.emotional_trends ?? null,
          what_improved: parsed?.what_improved ?? null,
          what_needs_work: parsed?.what_needs_work ?? null,
          recommended_principles: parsed?.recommended_principles ?? null,
          raw_json: parsed ?? { raw },
        },
        { onConflict: "user_id,month_start" },
      )
      .select("*")
      .single();

    return NextResponse.json({
      report: data,
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
    .from("monthly_reports")
    .select("*")
    .eq("user_id", user.id)
    .order("month_start", { ascending: false })
    .limit(12);

  return NextResponse.json({ reports: data ?? [] });
}
