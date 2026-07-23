import { requireUser } from "@/lib/auth";
import { KnowledgeClient } from "@/components/knowledge-client";
import type { Document } from "@/lib/types";

export default async function KnowledgePage() {
  const { supabase, user } = await requireUser();
  // Exclude raw_text so large PDFs don't bloat/break the page payload
  const { data } = await supabase
    .from("documents")
    .select(
      "id, user_id, source_type, title, path, status, error_message, processed_at, created_at, updated_at",
    )
    .eq("user_id", user.id)
    .order("path", { ascending: true });

  return <KnowledgeClient documents={(data as Document[]) ?? []} />;
}
