import fs from "fs/promises";
import path from "path";
import matter from "gray-matter";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getAiProvider } from "@/lib/ai/provider";
import { EXTRACTION_SYSTEM } from "@/lib/ai/prompts";
import { upsertEmbedding, findRelated } from "@/lib/ai/embeddings";
import { extractJson } from "@/lib/utils";
import { SOURCE_TYPES, type SourceType } from "@/lib/types";

const KNOWLEDGE_ROOT = path.join(process.cwd(), "knowledge");

const SUPPORTED_EXTENSIONS = new Set([".md", ".txt", ".pdf", ".markdown"]);

const ExtractionSchema = z.object({
  principles: z
    .array(
      z.object({
        title: z.string(),
        summary: z.string(),
        explanation: z.string().optional().default(""),
        category: z.string().optional().default("Mindset"),
        examples: z.array(z.string()).optional().default([]),
        action_steps: z.array(z.string()).optional().default([]),
        questions: z.array(z.string()).optional().default([]),
      }),
    )
    .default([]),
  habits: z
    .array(
      z.object({
        title: z.string(),
        description: z.string().optional().default(""),
        category: z.string().optional().default("Habits"),
      }),
    )
    .default([]),
  quotes: z
    .array(
      z.object({
        text: z.string(),
        attribution: z.string().optional().default(""),
      }),
    )
    .default([]),
  action_items: z
    .array(
      z.object({
        title: z.string(),
        description: z.string().optional().default(""),
      }),
    )
    .default([]),
  journal_prompts: z
    .array(
      z.object({
        prompt: z.string(),
        category: z.string().optional().default("Reflection"),
      }),
    )
    .default([]),
  mental_models: z.array(z.string()).optional().default([]),
});

function chunkText(text: string, size = 1200): string[] {
  const chunks: string[] = [];
  const cleaned = text.replace(/\r\n/g, "\n").trim();
  if (!cleaned) return [];
  let i = 0;
  while (i < cleaned.length) {
    chunks.push(cleaned.slice(i, i + size));
    i += size - 150;
  }
  return chunks;
}

async function walkKnowledgeFiles(dir: string): Promise<string[]> {
  const out: string[] = [];
  let entries;
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const entry of entries) {
    if (entry.name.startsWith(".")) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...(await walkKnowledgeFiles(full)));
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name).toLowerCase();
      if (SUPPORTED_EXTENSIONS.has(ext)) out.push(full);
    }
  }
  return out;
}

export async function listKnowledgeDiskPaths(): Promise<string[]> {
  const files = await walkKnowledgeFiles(KNOWLEDGE_ROOT);
  return files
    .map((f) => path.relative(KNOWLEDGE_ROOT, f).replace(/\\/g, "/"))
    .sort((a, b) => a.localeCompare(b));
}

export async function getKnowledgeInventory(userId: string) {
  const supabase = await createClient();
  const diskPaths = await listKnowledgeDiskPaths();
  const { data: docs, error } = await supabase
    .from("documents")
    .select(
      "id, title, path, status, error_message, source_type, processed_at, updated_at",
    )
    .eq("user_id", userId)
    .order("path", { ascending: true });

  if (error) throw new Error(error.message);

  const byPath = new Map(
    ((docs ?? []) as { path: string }[]).map((d) => [d.path, d]),
  );

  type DocRow = {
    id: string;
    title: string;
    path: string;
    status: string;
    error_message: string | null;
    source_type: string;
    processed_at: string | null;
    updated_at: string;
  };

  const diskSet = new Set(diskPaths);
  const rows = diskPaths.map((diskPath) => {
    const doc = byPath.get(diskPath) as DocRow | undefined;
    return {
      path: diskPath,
      title: doc?.title ?? titleFromFilename(diskPath),
      source_type: doc?.source_type ?? sourceTypeFromPath(path.join(KNOWLEDGE_ROOT, diskPath)),
      inDatabase: Boolean(doc),
      onDisk: true,
      id: doc?.id ?? null,
      status: doc?.status ?? "not_in_database",
      error_message: doc?.error_message ?? null,
      processed_at: doc?.processed_at ?? null,
    };
  });

  const dbOnly = ((docs ?? []) as DocRow[])
    .filter((d) => !diskSet.has(d.path))
    .map((d) => ({
      path: d.path,
      title: d.title,
      source_type: d.source_type,
      inDatabase: true,
      onDisk: false,
      id: d.id,
      status: d.status,
      error_message: d.error_message,
      processed_at: d.processed_at,
    }));

  const allRows = [...rows, ...dbOnly].sort((a, b) =>
    a.path.localeCompare(b.path),
  );

  const missing = allRows.filter((r) => !r.inDatabase || r.status !== "ready");

  return {
    diskCount: diskPaths.length,
    dbCount: (docs ?? []).length,
    readyCount: allRows.filter((r) => r.status === "ready").length,
    missingCount: missing.length,
    rows: allRows,
    dbOnly,
  };
}

function sourceTypeFromPath(filePath: string): SourceType {
  const rel = path.relative(KNOWLEDGE_ROOT, filePath);
  const parts = rel.split(path.sep);
  // File sitting directly in knowledge/ → inbox
  if (parts.length === 1) return "inbox";
  const top = parts[0];
  if (SOURCE_TYPES.includes(top as SourceType)) return top as SourceType;
  return "inbox";
}

function titleFromFilename(filePath: string) {
  return path
    .basename(filePath, path.extname(filePath))
    .replace(/[-_]+/g, " ")
    .trim();
}

async function readPdfTextFromBuffer(buf: Buffer): Promise<string> {
  // unpdf is reliable on Vercel/serverless (pdf-parse often fails there)
  try {
    const { extractText, getDocumentProxy } = await import("unpdf");
    const pdf = await getDocumentProxy(new Uint8Array(buf));
    const extracted = await extractText(pdf, { mergePages: true });
    const text = Array.isArray(extracted.text)
      ? extracted.text.join("\n")
      : String(extracted.text ?? "");
    const content = text.trim();
    if (content) return content;
  } catch (e) {
    // fall through to pdf-parse
    console.warn(
      "unpdf failed, trying pdf-parse:",
      e instanceof Error ? e.message : e,
    );
  }

  try {
    const { PDFParse } = await import("pdf-parse");
    const parser = new PDFParse({ data: buf });
    try {
      const result = await parser.getText();
      const content = (result.text || "").trim();
      if (content) return content;
    } finally {
      if (typeof parser.destroy === "function") {
        await parser.destroy();
      }
    }
  } catch (e) {
    throw new Error(
      `PDF extract failed: ${e instanceof Error ? e.message : "unknown error"}`,
    );
  }

  throw new Error("No extractable text in PDF (may be scanned/image-only)");
}

async function contentFromBuffer(
  filename: string,
  buf: Buffer,
): Promise<{ title: string; content: string }> {
  const ext = path.extname(filename).toLowerCase();
  if (ext === ".pdf") {
    const content = await readPdfTextFromBuffer(buf);
    return { title: titleFromFilename(filename), content };
  }

  const raw = buf.toString("utf8");
  if (ext === ".md" || ext === ".markdown") {
    const { data: front, content } = matter(raw);
    const title =
      (typeof front.title === "string" && front.title) ||
      titleFromFilename(filename);
    return { title, content };
  }

  return { title: titleFromFilename(filename), content: raw };
}

async function readDocumentContent(filePath: string): Promise<{
  title: string;
  content: string;
}> {
  const buf = await fs.readFile(filePath);
  return contentFromBuffer(path.basename(filePath), buf);
}

function sanitizeUploadFilename(name: string): string {
  const base = path.basename(name).replace(/[^\w.\- ()[\]]+/g, "_").trim();
  if (!base || base === "." || base === "..") {
    throw new Error("Invalid filename");
  }
  const ext = path.extname(base).toLowerCase();
  if (!SUPPORTED_EXTENSIONS.has(ext)) {
    throw new Error(`Unsupported file type: ${ext || "(none)"}`);
  }
  return base;
}

/** Save upload under knowledge/ when the filesystem allows (local); always ingest to DB. */
export async function ingestUploadedFile(
  userId: string,
  filename: string,
  data: Buffer,
  options?: { folder?: string },
) {
  const safeName = sanitizeUploadFilename(filename);
  const folder = (options?.folder ?? "").replace(/^\/+|\/+$/g, "");
  if (folder && (folder.includes("..") || path.isAbsolute(folder))) {
    throw new Error("Invalid folder");
  }
  if (folder && !SOURCE_TYPES.includes(folder as SourceType) && folder !== "inbox") {
    throw new Error(`Unknown folder: ${folder}`);
  }

  const rel = folder ? `${folder}/${safeName}` : safeName;
  const absolute = path.join(KNOWLEDGE_ROOT, rel);

  let savedToDisk = false;
  try {
    await fs.mkdir(path.dirname(absolute), { recursive: true });
    await fs.writeFile(absolute, data);
    savedToDisk = true;
  } catch {
    // Vercel/serverless is often read-only — DB ingest still works.
    savedToDisk = false;
  }

  const { title, content } = await contentFromBuffer(safeName, data);
  const source_type = sourceTypeFromPath(path.join(KNOWLEDGE_ROOT, rel));
  const supabase = await createClient();

  const { data: row, error } = await supabase
    .from("documents")
    .upsert(
      {
        user_id: userId,
        source_type,
        title,
        path: rel,
        raw_text: content,
        status: "pending",
        error_message: null,
        processed_at: null,
      },
      { onConflict: "user_id,path" },
    )
    .select("id, status, path, title")
    .single();

  if (error || !row) {
    throw new Error(error?.message ?? "Failed to save document");
  }

  return {
    id: (row as { id: string }).id,
    path: (row as { path: string }).path,
    title: (row as { title: string }).title,
    status: (row as { status: string }).status,
    savedToDisk,
    action: "new" as const,
  };
}

export async function syncKnowledgeFiles(userId: string) {
  const supabase = await createClient();
  const files = await walkKnowledgeFiles(KNOWLEDGE_ROOT);
  const synced: {
    path: string;
    id: string;
    status: string;
    action: "new" | "updated" | "unchanged" | "requeued" | "error";
  }[] = [];

  for (const file of files) {
    const rel = path.relative(KNOWLEDGE_ROOT, file).replace(/\\/g, "/");
    let title: string;
    let content: string;
    try {
      ({ title, content } = await readDocumentContent(file));
    } catch (e) {
      synced.push({
        path: rel,
        id: "",
        status: `error:${e instanceof Error ? e.message : "read failed"}`,
        action: "error",
      });
      continue;
    }

    const source_type = sourceTypeFromPath(file);

    const { data: existing } = await supabase
      .from("documents")
      .select("id, raw_text, status")
      .eq("user_id", userId)
      .eq("path", rel)
      .maybeSingle();

    const row = existing as {
      id: string;
      raw_text: string;
      status: string;
    } | null;

    // Same content already ready → skip
    // Compare fingerprints to avoid loading issues / tiny extract drift hiding files
    if (row && row.status === "ready" && row.raw_text != null) {
      const same =
        row.raw_text === content ||
        (row.raw_text.length === content.length &&
          row.raw_text.slice(0, 120) === content.slice(0, 120));
      if (same) {
        synced.push({
          path: rel,
          id: row.id,
          status: "ready",
          action: "unchanged",
        });
        continue;
      }
    }

    // Same content but stuck pending/error → requeue for processing
    if (row && row.raw_text === content && row.status !== "ready") {
      await supabase
        .from("documents")
        .update({
          status: "pending",
          error_message: null,
          processed_at: null,
        })
        .eq("id", row.id);
      synced.push({
        path: rel,
        id: row.id,
        status: "pending",
        action: "requeued",
      });
      continue;
    }

    const { data, error } = await supabase
      .from("documents")
      .upsert(
        {
          user_id: userId,
          source_type,
          title,
          path: rel,
          raw_text: content,
          status: "pending",
          error_message: null,
          processed_at: null,
        },
        { onConflict: "user_id,path" },
      )
      .select("id, status")
      .single();

    if (error || !data) {
      synced.push({
        path: rel,
        id: "",
        status: `error:${error?.message ?? "upsert failed"}`,
        action: "error",
      });
      continue;
    }

    synced.push({
      path: rel,
      id: (data as { id: string }).id,
      status: "pending",
      action: row ? "updated" : "new",
    });
  }

  return synced;
}

export function summarizeSync(
  synced: {
    action: "new" | "updated" | "unchanged" | "requeued" | "error";
  }[],
) {
  const summary = {
    total: synced.length,
    new: 0,
    updated: 0,
    unchanged: 0,
    requeued: 0,
    error: 0,
  };
  for (const s of synced) {
    summary[s.action] += 1;
  }
  return summary;
}

async function mergeOrCreatePrinciple(
  userId: string,
  documentId: string,
  principle: z.infer<typeof ExtractionSchema>["principles"][number],
) {
  const supabase = await createClient();
  const similar = await findRelated({
    userId,
    query: `${principle.title}\n${principle.summary}`,
    entityType: "principle",
    limit: 3,
  });

  const best = similar.find((s) => s.similarity >= 0.82);
  if (best) {
    const { data: existing } = await supabase
      .from("principles")
      .select("*")
      .eq("id", best.entity_id)
      .eq("user_id", userId)
      .maybeSingle();

    if (existing) {
      const row = existing as {
        id: string;
        frequency_score: number;
        confidence_score: number;
        examples: string[] | null;
        action_steps: string[] | null;
        questions: string[] | null;
      };
      const frequency = row.frequency_score + 1;
      const confidence = Math.min(1, row.confidence_score + 0.08);
      await supabase
        .from("principles")
        .update({
          frequency_score: frequency,
          confidence_score: confidence,
          examples: Array.from(
            new Set([...(row.examples ?? []), ...(principle.examples ?? [])]),
          ).slice(0, 12),
          action_steps: Array.from(
            new Set([
              ...(row.action_steps ?? []),
              ...(principle.action_steps ?? []),
            ]),
          ).slice(0, 12),
          questions: Array.from(
            new Set([...(row.questions ?? []), ...(principle.questions ?? [])]),
          ).slice(0, 12),
          summary: principle.summary || undefined,
          explanation: principle.explanation || undefined,
        })
        .eq("id", row.id);

      await supabase.from("principle_sources").insert({
        user_id: userId,
        principle_id: row.id,
        document_id: documentId,
        excerpt: principle.summary.slice(0, 500),
        weight: 1,
      });

      await upsertEmbedding({
        userId,
        entityType: "principle",
        entityId: row.id,
        content: `${principle.title}\n${principle.summary}\n${principle.explanation}`,
      });
      return row.id;
    }
  }

  const { data: created, error } = await supabase
    .from("principles")
    .insert({
      user_id: userId,
      title: principle.title,
      summary: principle.summary,
      explanation: principle.explanation,
      category: principle.category,
      examples: principle.examples,
      action_steps: principle.action_steps,
      questions: principle.questions,
      confidence_score: 0.55,
      frequency_score: 1,
    })
    .select("id")
    .single();

  if (error || !created) return null;
  const id = (created as { id: string }).id;

  await supabase.from("principle_sources").insert({
    user_id: userId,
    principle_id: id,
    document_id: documentId,
    excerpt: principle.summary.slice(0, 500),
    weight: 1,
  });

  await upsertEmbedding({
    userId,
    entityType: "principle",
    entityId: id,
    content: `${principle.title}\n${principle.summary}\n${principle.explanation}`,
  });

  return id;
}

export async function processDocument(userId: string, documentId: string) {
  const supabase = await createClient();
  const { data: doc } = await supabase
    .from("documents")
    .select("*")
    .eq("id", documentId)
    .eq("user_id", userId)
    .maybeSingle();

  if (!doc) throw new Error("Document not found");

  const document = doc as {
    id: string;
    title: string;
    raw_text: string | null;
    source_type: string;
  };

  await supabase
    .from("documents")
    .update({ status: "processing", error_message: null })
    .eq("id", documentId);

  try {
    const text = document.raw_text ?? "";
    const chunks = chunkText(text);

    await supabase.from("document_chunks").delete().eq("document_id", documentId);

    for (let i = 0; i < chunks.length; i++) {
      const { data: chunk } = await supabase
        .from("document_chunks")
        .insert({
          user_id: userId,
          document_id: documentId,
          content: chunks[i],
          ordinal: i,
        })
        .select("id")
        .single();

      if (chunk) {
        await upsertEmbedding({
          userId,
          entityType: "chunk",
          entityId: (chunk as { id: string }).id,
          content: chunks[i],
        });
      }
    }

    const provider = getAiProvider();
    const raw = await provider.generate({
      system: EXTRACTION_SYSTEM,
      maxTokens: 4000,
      prompt: `Extract wisdom from this ${document.source_type} document titled "${document.title}".

Return JSON:
{
  "principles": [{ "title", "summary", "explanation", "category", "examples": [], "action_steps": [], "questions": [] }],
  "habits": [{ "title", "description", "category" }],
  "quotes": [{ "text", "attribution" }],
  "action_items": [{ "title", "description" }],
  "journal_prompts": [{ "prompt", "category" }],
  "mental_models": ["..."]
}

Document:
${text.slice(0, 14000)}`,
    });

    const parsed = extractJson<unknown>(raw);
    const extraction = ExtractionSchema.parse(parsed ?? {});

    for (const p of extraction.principles) {
      await mergeOrCreatePrinciple(userId, documentId, p);
    }

    for (const h of extraction.habits) {
      await supabase.from("habits").insert({
        user_id: userId,
        document_id: documentId,
        title: h.title,
        description: h.description,
        category: h.category,
      });
    }

    for (const q of extraction.quotes) {
      await supabase.from("quotes").insert({
        user_id: userId,
        document_id: documentId,
        text: q.text,
        attribution: q.attribution || null,
      });
    }

    for (const a of extraction.action_items) {
      await supabase.from("action_items").insert({
        user_id: userId,
        document_id: documentId,
        title: a.title,
        description: a.description,
      });
    }

    for (const jp of extraction.journal_prompts) {
      await supabase.from("journal_prompts").insert({
        user_id: userId,
        document_id: documentId,
        prompt: jp.prompt,
        category: jp.category,
      });
    }

    // Promote mental models into principles lightly
    for (const mm of extraction.mental_models ?? []) {
      if (!mm.trim()) continue;
      await mergeOrCreatePrinciple(userId, documentId, {
        title: mm.slice(0, 120),
        summary: `Mental model: ${mm}`,
        explanation: mm,
        category: "Mindset",
        examples: [],
        action_steps: [],
        questions: [`How does "${mm}" apply today?`],
      });
    }

    await supabase
      .from("documents")
      .update({
        status: "ready",
        processed_at: new Date().toISOString(),
        error_message: null,
      })
      .eq("id", documentId);

    return { ok: true, principles: extraction.principles.length };
  } catch (e) {
    await supabase
      .from("documents")
      .update({
        status: "error",
        error_message: e instanceof Error ? e.message : "Processing failed",
      })
      .eq("id", documentId);
    throw e;
  }
}

export async function processPendingDocuments(userId: string, limit = 25) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("documents")
    .select("id")
    .eq("user_id", userId)
    .eq("status", "pending")
    .limit(limit);

  const results = [];
  for (const row of data ?? []) {
    const id = (row as { id: string }).id;
    try {
      const r = await processDocument(userId, id);
      results.push({ id, ...r });
    } catch (e) {
      results.push({
        id,
        ok: false,
        error: e instanceof Error ? e.message : "failed",
      });
    }
  }
  return results;
}
