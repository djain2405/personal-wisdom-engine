import { requireUser } from "@/lib/auth";
import { EveningReviewClient } from "@/components/evening-review-client";
import { todayISO } from "@/lib/utils";
import type { EveningReview } from "@/lib/types";

export default async function EveningReviewPage() {
  const { supabase, user } = await requireUser();
  const [{ data }, { data: brief }] = await Promise.all([
    supabase
      .from("evening_reviews")
      .select("*")
      .eq("user_id", user.id)
      .order("review_date", { ascending: false })
      .limit(7),
    supabase
      .from("daily_briefs")
      .select("evening_prompt")
      .eq("user_id", user.id)
      .eq("brief_date", todayISO())
      .maybeSingle(),
  ]);

  return (
    <EveningReviewClient
      recent={(data as EveningReview[]) ?? []}
      eveningPrompt={
        (brief as { evening_prompt?: string | null } | null)?.evening_prompt
      }
    />
  );
}
