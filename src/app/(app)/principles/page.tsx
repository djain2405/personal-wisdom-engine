import { requireUser } from "@/lib/auth";
import { PrinciplesClient } from "@/components/principles-client";
import type { Principle } from "@/lib/types";

export default async function PrinciplesPage() {
  const { supabase, user } = await requireUser();
  const { data } = await supabase
    .from("principles")
    .select("*")
    .eq("user_id", user.id)
    .order("frequency_score", { ascending: false })
    .limit(40);

  return <PrinciplesClient initial={(data as Principle[]) ?? []} />;
}
