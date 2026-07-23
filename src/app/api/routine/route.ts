import { NextResponse } from "next/server";
import { getAppUser } from "@/lib/auth";
import { getAiProvider } from "@/lib/ai/provider";
import { coachSystemPrompt } from "@/lib/ai/prompts";
import { buildCoachContext } from "@/lib/coach/retrieval";
import { todayISO } from "@/lib/utils";

export async function POST(request: Request) {
  const { supabase, user } = await getAppUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { energy, timeAvailable, goals } = await request.json();
  const { data: profile } = await supabase
    .from("profiles")
    .select("ai_provider")
    .eq("id", user.id)
    .maybeSingle();

  const context = await buildCoachContext(
    user.id,
    `${goals ?? ""} routine habits energy ${energy ?? ""}`,
  );

  try {
    const provider = getAiProvider(
      (profile as { ai_provider?: string } | null)?.ai_provider,
    );
    const plan = await provider.generate({
      system: coachSystemPrompt(),
      maxTokens: 2200,
      prompt: `Build today's routine from the user's principles, habits, and goals.

Inputs:
- Energy: ${energy ?? "medium"}
- Time available: ${timeAvailable ?? "unspecified"}
- Goals focus: ${goals ?? "from memory"}

Return structured markdown with: Morning block, Deep work, Relationships/body, Wind-down, Keystone habit, Principle to practice.

Context:
${JSON.stringify(context)}`,
    });

    const { data } = await supabase
      .from("routines")
      .insert({
        user_id: user.id,
        routine_date: todayISO(),
        energy: energy ?? null,
        time_available: timeAvailable ?? null,
        goals: goals ?? null,
        plan,
      })
      .select("*")
      .single();

    return NextResponse.json({ plan, routine: data });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "AI failed" },
      { status: 500 },
    );
  }
}
