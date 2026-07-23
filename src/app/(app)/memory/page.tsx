import { requireUser } from "@/lib/auth";
import { MemoryForm } from "./memory-form";
import type { IdentityMemory } from "@/lib/types";

export default async function MemoryPage() {
  const { supabase, user } = await requireUser();
  const { data } = await supabase
    .from("identity_memory")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  return <MemoryForm memory={(data as IdentityMemory | null) ?? null} />;
}
