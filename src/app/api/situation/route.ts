import { NextResponse } from "next/server";
import { getAppUser } from "@/lib/auth";
import { getAiProvider } from "@/lib/ai/provider";
import { coachSystemPrompt } from "@/lib/ai/prompts";
import { buildCoachContext } from "@/lib/coach/retrieval";
import { extractJson } from "@/lib/utils";

export async function POST(request: Request) {
  const { supabase, user } = await getAppUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { situation } = await request.json();
  if (!situation || typeof situation !== "string") {
    return NextResponse.json({ error: "Situation required" }, { status: 400 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("ai_provider")
    .eq("id", user.id)
    .maybeSingle();

  const context = await buildCoachContext(user.id, situation);

  const { data: conv } = await supabase
    .from("conversations")
    .insert({
      user_id: user.id,
      kind: "situation",
      title: situation.slice(0, 80),
    })
    .select("id")
    .single();

  const convId = (conv as { id: string } | null)?.id;
  if (convId) {
    await supabase.from("messages").insert({
      user_id: user.id,
      conversation_id: convId,
      role: "user",
      content: situation,
    });
  }

  try {
    const provider = getAiProvider(
      (profile as { ai_provider?: string } | null)?.ai_provider,
    );
    const raw = await provider.generate({
      system: coachSystemPrompt(),
      maxTokens: 2500,
      prompt: `Analyze this situation as Situation Coach.

Return JSON:
{
  "current_identity": "...",
  "desired_identity": "...",
  "mental_models": ["..."],
  "suggested_response": "...",
  "reflection_afterwards": "...",
  "principles_used": ["titles"]
}

Also include a markdown field "markdown" with a readable version.

Situation:
${situation}

Context:
${JSON.stringify(context)}`,
    });

    const parsed = extractJson<{
      current_identity?: string;
      desired_identity?: string;
      mental_models?: string[];
      suggested_response?: string;
      reflection_afterwards?: string;
      principles_used?: string[];
      markdown?: string;
    }>(raw);

    const content =
      parsed?.markdown ||
      [
        `## Current identity\n${parsed?.current_identity ?? "—"}`,
        `## Desired identity\n${parsed?.desired_identity ?? "—"}`,
        `## Mental models\n${(parsed?.mental_models ?? []).map((m) => `- ${m}`).join("\n") || "—"}`,
        `## Suggested response\n${parsed?.suggested_response ?? raw}`,
        `## Reflection afterwards\n${parsed?.reflection_afterwards ?? "—"}`,
      ].join("\n\n");

    if (convId) {
      await supabase.from("messages").insert({
        user_id: user.id,
        conversation_id: convId,
        role: "assistant",
        content,
      });
    }

    return NextResponse.json({ content, analysis: parsed, conversationId: convId });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "AI failed" },
      { status: 500 },
    );
  }
}
