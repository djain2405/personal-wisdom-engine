import { NextResponse } from "next/server";
import { getAppUser } from "@/lib/auth";
import { getAiProvider } from "@/lib/ai/provider";
import { coachSystemPrompt } from "@/lib/ai/prompts";
import { buildCoachContext } from "@/lib/coach/retrieval";
import { extractJson, todayISO } from "@/lib/utils";

export async function POST(request: Request) {
  const { supabase, user } = await getAppUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { narrative } = await request.json();
  if (!narrative || typeof narrative !== "string") {
    return NextResponse.json({ error: "Narrative required" }, { status: 400 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("ai_provider")
    .eq("id", user.id)
    .maybeSingle();

  const context = await buildCoachContext(user.id, narrative);

  try {
    const provider = getAiProvider(
      (profile as { ai_provider?: string } | null)?.ai_provider,
    );
    const raw = await provider.generate({
      system: coachSystemPrompt(),
      maxTokens: 2200,
      prompt: `Evening review. User's day:

${narrative}

Return JSON:
{
  "wins": "...",
  "patterns": "...",
  "identity_reinforce": "...",
  "tomorrow": "...",
  "markdown": "readable markdown combining the above"
}

Use principles from context when reinforcing identity.
When a morning check-in exists, compare the user's stated intention and becoming identity with how the day unfolded. Reference habit follow-through without shaming.

Context:
${JSON.stringify(context)}`,
    });

    const parsed = extractJson<{
      wins?: string;
      patterns?: string;
      identity_reinforce?: string;
      tomorrow?: string;
      markdown?: string;
    }>(raw);

    const { data } = await supabase
      .from("evening_reviews")
      .insert({
        user_id: user.id,
        review_date: todayISO(),
        narrative,
        wins: parsed?.wins ?? null,
        patterns: parsed?.patterns ?? null,
        identity_reinforce: parsed?.identity_reinforce ?? null,
        tomorrow: parsed?.tomorrow ?? null,
        analysis_json: parsed ?? { raw },
      })
      .select("*")
      .single();

    // Append a light signal into memory notes
    const { data: memory } = await supabase
      .from("identity_memory")
      .select("notes, suggested_actions_history")
      .eq("user_id", user.id)
      .maybeSingle();

    if (memory) {
      const history = Array.isArray(
        (memory as { suggested_actions_history?: unknown }).suggested_actions_history,
      )
        ? ([
            ...((memory as { suggested_actions_history: unknown[] })
              .suggested_actions_history ?? []),
            {
              date: todayISO(),
              tomorrow: parsed?.tomorrow,
              patterns: parsed?.patterns,
            },
          ] as unknown[]).slice(-40)
        : [
            {
              date: todayISO(),
              tomorrow: parsed?.tomorrow,
              patterns: parsed?.patterns,
            },
          ];

      await supabase
        .from("identity_memory")
        .update({
          suggested_actions_history: history,
          notes: [
            (memory as { notes?: string | null }).notes ?? "",
            parsed?.identity_reinforce
              ? `\n[${todayISO()}] ${parsed.identity_reinforce}`
              : "",
          ]
            .join("")
            .slice(-8000),
        })
        .eq("user_id", user.id);
    }

    return NextResponse.json({
      review: data,
      markdown:
        parsed?.markdown ||
        [
          `## Wins\n${parsed?.wins ?? "—"}`,
          `## Patterns\n${parsed?.patterns ?? "—"}`,
          `## Identity\n${parsed?.identity_reinforce ?? "—"}`,
          `## Tomorrow\n${parsed?.tomorrow ?? "—"}`,
        ].join("\n\n"),
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "AI failed" },
      { status: 500 },
    );
  }
}
