import { NextResponse } from "next/server";
import { getAppUser } from "@/lib/auth";
import { getAiProvider } from "@/lib/ai/provider";
import { coachSystemPrompt } from "@/lib/ai/prompts";
import { retrievePrinciples } from "@/lib/coach/retrieval";

export async function GET(request: Request) {
  const { supabase, user } = await getAppUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim() ?? "";
  const category = searchParams.get("category") ?? undefined;
  const synthesize = searchParams.get("synthesize") === "1";

  if (!q) {
    let query = supabase
      .from("principles")
      .select("*")
      .eq("user_id", user.id)
      .order("frequency_score", { ascending: false })
      .limit(50);
    if (category) query = query.eq("category", category);
    const { data } = await query;
    return NextResponse.json({ principles: data ?? [] });
  }

  const principles = await retrievePrinciples({
    userId: user.id,
    query: q,
    category,
    limit: 12,
  });

  if (!synthesize) {
    return NextResponse.json({ principles });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("ai_provider")
    .eq("id", user.id)
    .maybeSingle();

  try {
    const provider = getAiProvider(
      (profile as { ai_provider?: string } | null)?.ai_provider,
    );
    const synthesis = await provider.generate({
      system: coachSystemPrompt(),
      maxTokens: 2000,
      prompt: `The user asked: "What have I learned about ${q}?"

Synthesize a coherent answer from these principles. Cite titles. End with one action and one question.

Principles:
${JSON.stringify(
  principles.map((p) => ({
    title: p.title,
    summary: p.summary,
    category: p.category,
    frequency_score: p.frequency_score,
    confidence_score: p.confidence_score,
    action_steps: p.action_steps,
  })),
)}`,
    });
    return NextResponse.json({ principles, synthesis });
  } catch (e) {
    return NextResponse.json({
      principles,
      synthesis: null,
      error: e instanceof Error ? e.message : "Synthesis failed",
    });
  }
}
