import { NextResponse } from "next/server";
import { getAppUser } from "@/lib/auth";
import { getAiProvider } from "@/lib/ai/provider";
import { coachSystemPrompt } from "@/lib/ai/prompts";
import { buildCoachContext } from "@/lib/coach/retrieval";

export async function POST(request: Request) {
  const { supabase, user } = await getAppUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { message, conversationId } = await request.json();
  if (!message || typeof message !== "string") {
    return NextResponse.json({ error: "Message required" }, { status: 400 });
  }

  let convId = conversationId as string | undefined;
  if (!convId) {
    const { data: conv } = await supabase
      .from("conversations")
      .insert({
        user_id: user.id,
        kind: "chat",
        title: message.slice(0, 80),
      })
      .select("id")
      .single();
    convId = (conv as { id: string } | null)?.id;
  }

  if (convId) {
    await supabase.from("messages").insert({
      user_id: user.id,
      conversation_id: convId,
      role: "user",
      content: message,
    });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("ai_provider")
    .eq("id", user.id)
    .maybeSingle();

  const context = await buildCoachContext(user.id, message);

  try {
    const provider = getAiProvider(
      (profile as { ai_provider?: string } | null)?.ai_provider,
    );
    const content = await provider.generate({
      system: `${coachSystemPrompt()}

Respond as Chat Coach. Ground advice in the principles below. Cite principle titles. End with one action and one question.

Context:
${JSON.stringify(context)}`,
      prompt: message,
      maxTokens: 2200,
    });

    if (convId) {
      await supabase.from("messages").insert({
        user_id: user.id,
        conversation_id: convId,
        role: "assistant",
        content,
      });
    }

    return NextResponse.json({ content, conversationId: convId });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "AI failed" },
      { status: 500 },
    );
  }
}
