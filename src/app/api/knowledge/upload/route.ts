import { NextResponse } from "next/server";
import { getAppUser } from "@/lib/auth";
import {
  getKnowledgeInventory,
  ingestUploadedFile,
  processPendingDocuments,
} from "@/lib/knowledge/pipeline";

export const maxDuration = 300;
export const runtime = "nodejs";

const MAX_BYTES = 20 * 1024 * 1024; // 20MB per file
const MAX_FILES = 20;

export async function POST(request: Request) {
  const { user } = await getAppUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "Expected multipart form data" }, { status: 400 });
  }

  const folder = String(form.get("folder") ?? "").trim() || undefined;
  const process = form.get("process") !== "0";
  const entries = form.getAll("files").filter((f): f is File => f instanceof File);

  if (entries.length === 0) {
    return NextResponse.json({ error: "No files uploaded" }, { status: 400 });
  }
  if (entries.length > MAX_FILES) {
    return NextResponse.json(
      { error: `Too many files (max ${MAX_FILES})` },
      { status: 400 },
    );
  }

  const uploaded: Awaited<ReturnType<typeof ingestUploadedFile>>[] = [];
  const errors: { name: string; error: string }[] = [];

  for (const file of entries) {
    try {
      if (file.size > MAX_BYTES) {
        throw new Error(`File too large (max ${MAX_BYTES / (1024 * 1024)}MB)`);
      }
      const buf = Buffer.from(await file.arrayBuffer());
      const result = await ingestUploadedFile(user.id, file.name, buf, {
        folder,
      });
      uploaded.push(result);
    } catch (e) {
      errors.push({
        name: file.name,
        error: e instanceof Error ? e.message : "Upload failed",
      });
    }
  }

  let processed: unknown[] = [];
  let processedOk = 0;
  let processedFail = 0;
  if (process && uploaded.length > 0) {
    processed = await processPendingDocuments(user.id, Math.min(30, uploaded.length + 5));
    processedOk = processed.filter((p) => (p as { ok?: boolean }).ok !== false).length;
    processedFail = processed.length - processedOk;
  }

  const inventory = await getKnowledgeInventory(user.id);

  return NextResponse.json({
    uploaded,
    errors,
    processed,
    processedOk,
    processedFail,
    inventory,
  });
}
