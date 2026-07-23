import { NextResponse } from "next/server";
import { getAppUser } from "@/lib/auth";
import {
  processPendingDocuments,
  syncKnowledgeFiles,
} from "@/lib/knowledge/pipeline";

export const maxDuration = 300;
export const runtime = "nodejs";

export async function POST(request: Request) {
  const { supabase, user } = await getAppUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const action = body.action ?? "sync_and_process";

  if (action === "sync" || action === "sync_and_process") {
    const synced = await syncKnowledgeFiles(user.id);
    if (action === "sync") {
      return NextResponse.json({ synced });
    }
    const processed = await processPendingDocuments(user.id, body.limit ?? 30);
    return NextResponse.json({ synced, processed });
  }

  if (action === "process" && body.documentId) {
    const { processDocument } = await import("@/lib/knowledge/pipeline");
    const result = await processDocument(user.id, body.documentId);
    return NextResponse.json(result);
  }

  if (action === "process_pending") {
    const processed = await processPendingDocuments(user.id, body.limit ?? 30);
    return NextResponse.json({ processed });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}

export async function GET() {
  const { supabase, user } = await getAppUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data } = await supabase
    .from("documents")
    .select("*")
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false });

  return NextResponse.json({ documents: data ?? [] });
}
