import { createClient } from "@/lib/supabase/server";
import { getEmbeddingProvider } from "@/lib/ai/provider";

export async function upsertEmbedding(args: {
  userId: string;
  entityType: string;
  entityId: string;
  content: string;
}) {
  const text = args.content.trim();
  if (!text) return;

  const provider = await getEmbeddingProvider();
  let embedding: number[] | null = null;
  if (provider?.embed) {
    try {
      embedding = await provider.embed(text.slice(0, 8000));
    } catch {
      embedding = null;
    }
  }

  const supabase = await createClient();
  await supabase.from("embeddings").upsert(
    {
      user_id: args.userId,
      entity_type: args.entityType,
      entity_id: args.entityId,
      content: text.slice(0, 4000),
      embedding: embedding as unknown as number[] | null,
    },
    { onConflict: "user_id,entity_type,entity_id" },
  );
}

export async function findRelated(args: {
  userId: string;
  query: string;
  entityType?: string;
  limit?: number;
}) {
  const provider = await getEmbeddingProvider();
  const supabase = await createClient();

  if (provider?.embed) {
    try {
      const embedding = await provider.embed(args.query.slice(0, 8000));
      const { data, error } = await supabase.rpc("match_embeddings", {
        query_embedding: embedding,
        match_user_id: args.userId,
        match_count: args.limit ?? 8,
        filter_entity_type: args.entityType ?? null,
      });
      if (!error && data) {
        return data as {
          entity_type: string;
          entity_id: string;
          content: string;
          similarity: number;
        }[];
      }
    } catch {
      // fall through
    }
  }

  let q = supabase
    .from("embeddings")
    .select("entity_type, entity_id, content")
    .eq("user_id", args.userId)
    .ilike("content", `%${args.query.slice(0, 80)}%`)
    .limit(args.limit ?? 8);
  if (args.entityType) q = q.eq("entity_type", args.entityType);
  const { data } = await q;
  return (data ?? []).map((row) => ({
    ...(row as {
      entity_type: string;
      entity_id: string;
      content: string;
    }),
    similarity: 0,
  }));
}
