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

  const body = await request.json().catch(() => ({}));
  const narrative =
    typeof body?.narrative === "string" ? body.narrative.trim() : "";
  const evidence = Array.isArray(body?.evidence)
    ? body.evidence.filter((e: unknown) => typeof e === "string" && e.trim())
    : [];
  if (!narrative) {
    return NextResponse.json({ error: "Evidence required" }, { status: 400 });
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
    const evidenceList = evidence.length
      ? evidence.map((e: string, i: number) => `${i + 1}. ${e}`).join("\n")
      : narrative;

    const raw = await provider.generate({
      system: coachSystemPrompt(),
      maxTokens: 2200,
      prompt: `Evening review — Daily Compass.

The user collected today's identity evidence (3 bullets):
${evidenceList}

Full narrative:
${narrative}

Return ONLY JSON with these fields:
{
  "wins": "3 numbered wins paraphrasing/expanding their evidence",
  "patterns": "1-2 paragraphs naming principles/patterns (use **bold** for principle titles)",
  "identity_reinforce": "warm paragraph linking evidence to who they're becoming / morning becoming identity",
  "tomorrow": "concrete next-day focus in 2-4 sentences",
  "markdown": "full formatted review (see template)"
}

The "markdown" field MUST follow this exact structure (and render well as markdown):

# Evening Review

## Wins
1. ...
2. ...
3. ...

## Patterns
...

## Identity Reinforcement
...

## Tomorrow
...

Rules:
- Ground Wins in their evidence bullets — expand them into clear identity votes, don't invent unrelated wins.
- Patterns: name relevant principles from Context with **bold** titles when they fit.
- Identity Reinforcement: speak to their becoming identity / dream identity; affirming and specific.
- Tomorrow: small aligned actions, not a lecture.
- No shame. Prefer their knowledge principles over generic advice.
- When morning check-in exists, compare becoming identity with the evidence collected.

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

    const fallbackMarkdown = [
      "# Evening Review",
      "",
      "## Wins",
      parsed?.wins ?? evidenceList,
      "",
      "## Patterns",
      parsed?.patterns ?? "—",
      "",
      "## Identity Reinforcement",
      parsed?.identity_reinforce ?? "—",
      "",
      "## Tomorrow",
      parsed?.tomorrow ?? "—",
    ].join("\n");

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
      markdown: parsed?.markdown?.trim() || fallbackMarkdown,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "AI failed" },
      { status: 500 },
    );
  }
}
