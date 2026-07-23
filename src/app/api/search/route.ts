import { NextResponse } from "next/server";
import { getAppUser } from "@/lib/auth";
import { retrievePrinciples } from "@/lib/coach/retrieval";
import { findRelated } from "@/lib/ai/embeddings";

export async function GET(request: Request) {
  const { supabase, user } = await getAppUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const q = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  if (!q) {
    return NextResponse.json({
      principles: [],
      quotes: [],
      documents: [],
      habits: [],
    });
  }

  const [principles, related, quotes, documents, habits] = await Promise.all([
    retrievePrinciples({ userId: user.id, query: q, limit: 10 }),
    findRelated({ userId: user.id, query: q, limit: 10 }),
    supabase
      .from("quotes")
      .select("*")
      .eq("user_id", user.id)
      .ilike("text", `%${q.slice(0, 60)}%`)
      .limit(10),
    supabase
      .from("documents")
      .select("id, title, path, source_type, status")
      .eq("user_id", user.id)
      .or(`title.ilike.%${q.slice(0, 60)}%,raw_text.ilike.%${q.slice(0, 60)}%`)
      .limit(10),
    supabase
      .from("habits")
      .select("*")
      .eq("user_id", user.id)
      .or(`title.ilike.%${q.slice(0, 60)}%,description.ilike.%${q.slice(0, 60)}%`)
      .limit(10),
  ]);

  return NextResponse.json({
    principles,
    related,
    quotes: quotes.data ?? [],
    documents: documents.data ?? [],
    habits: habits.data ?? [],
  });
}
