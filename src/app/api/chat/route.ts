import { NextResponse } from "next/server";
import { getAppUser } from "@/lib/auth";
import { getAiProvider } from "@/lib/ai/provider";
import { chatCoachPrompt } from "@/lib/ai/prompts";
import { buildCoachContext } from "@/lib/coach/retrieval";

/** Load latest chat conversation + messages, or a specific conversationId. */
export async function GET(request: Request) {
  const { supabase, user } = await getAppUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const conversationId = searchParams.get("conversationId");

  let convId = conversationId;

  if (!convId) {
    const { data: latest } = await supabase
      .from("conversations")
      .select("id, title, updated_at")
      .eq("user_id", user.id)
      .eq("kind", "chat")
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    convId = (latest as { id: string } | null)?.id ?? null;
  }

  if (!convId) {
    return NextResponse.json({ conversationId: null, messages: [] });
  }

  const { data: messages } = await supabase
    .from("messages")
    .select("id, role, content, created_at")
    .eq("user_id", user.id)
    .eq("conversation_id", convId)
    .order("created_at", { ascending: true });

  return NextResponse.json({
    conversationId: convId,
    messages: (messages ?? []).map((m) => ({
      role: (m as { role: string }).role,
      content: (m as { content: string }).content,
    })),
  });
}

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
    await supabase
      .from("conversations")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", convId);
  }

  const context = await buildCoachContext(user.id, message);

  try {
    const provider = getAiProvider();
    const content = await provider.generate({
      system: `${chatCoachPrompt()}

User principles & memory (JSON):
${JSON.stringify(context)}`,
      prompt: message,
      maxTokens: 700,
    });

    if (convId) {
      await supabase.from("messages").insert({
        user_id: user.id,
        conversation_id: convId,
        role: "assistant",
        content,
      });
      await supabase
        .from("conversations")
        .update({ updated_at: new Date().toISOString() })
        .eq("id", convId);
    }

    return NextResponse.json({ content, conversationId: convId });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "AI failed" },
      { status: 500 },
    );
  }
}
