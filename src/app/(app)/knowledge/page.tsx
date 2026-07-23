import { requireUser } from "@/lib/auth";
import { KnowledgeClient } from "@/components/knowledge-client";
import type { Document } from "@/lib/types";

export default async function KnowledgePage() {
  const { supabase, user } = await requireUser();
  const { data } = await supabase
    .from("documents")
    .select("*")
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false });

  return <KnowledgeClient documents={(data as Document[]) ?? []} />;
}
