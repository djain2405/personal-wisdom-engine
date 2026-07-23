"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";

export async function saveIdentityMemory(formData: FormData) {
  const { supabase, user } = await requireUser();

  const payload = {
    user_id: user.id,
    dream_identity: String(formData.get("dream_identity") || ""),
    values: String(formData.get("values") || ""),
    goals: String(formData.get("goals") || ""),
    current_habits: String(formData.get("current_habits") || ""),
    challenges: String(formData.get("challenges") || ""),
    life_areas: String(formData.get("life_areas") || ""),
    notes: String(formData.get("notes") || ""),
  };

  const { error } = await supabase
    .from("identity_memory")
    .upsert(payload, { onConflict: "user_id" });

  if (error) {
    return { ok: false as const, error: error.message };
  }

  revalidatePath("/memory");
  return { ok: true as const };
}

export async function saveAiProvider(formData: FormData) {
  const { supabase, user } = await requireUser();
  const provider = String(formData.get("ai_provider") || "claude");

  const { error } = await supabase
    .from("profiles")
    .upsert(
      {
        id: user.id,
        ai_provider: provider,
        display_name: "Personal",
      },
      { onConflict: "id" },
    );

  if (error) {
    return { ok: false as const, error: error.message };
  }

  revalidatePath("/settings");
  return { ok: true as const };
}
