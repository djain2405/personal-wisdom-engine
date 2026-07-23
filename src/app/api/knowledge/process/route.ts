import { NextResponse } from "next/server";
import { getAppUser } from "@/lib/auth";
import {
  getKnowledgeInventory,
  processPendingDocuments,
  summarizeSync,
  syncKnowledgeFiles,
} from "@/lib/knowledge/pipeline";

export const maxDuration = 300;
export const runtime = "nodejs";

export async function GET() {
  const { user } = await getAppUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const inventory = await getKnowledgeInventory(user.id);
    return NextResponse.json(inventory);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Inventory failed" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  const { user } = await getAppUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const action = body.action ?? "sync_and_process";

  if (action === "sync" || action === "sync_and_process") {
    const synced = await syncKnowledgeFiles(user.id);
    const summary = summarizeSync(synced);
    if (action === "sync") {
      return NextResponse.json({ synced, summary });
    }
    const processed = await processPendingDocuments(user.id, body.limit ?? 30);
    const processedOk = processed.filter((p) => (p as { ok?: boolean }).ok !== false).length;
    const processedFail = processed.length - processedOk;
    const inventory = await getKnowledgeInventory(user.id);
    return NextResponse.json({
      synced,
      summary,
      processed,
      processedOk,
      processedFail,
      inventory,
    });
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
