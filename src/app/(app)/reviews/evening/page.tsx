import { requireUser } from "@/lib/auth";
import { EveningReviewClient } from "@/components/evening-review-client";
import type { EveningReview } from "@/lib/types";

export default async function EveningReviewPage() {
  const { supabase, user } = await requireUser();
  const { data } = await supabase
    .from("evening_reviews")
    .select("*")
    .eq("user_id", user.id)
    .order("review_date", { ascending: false })
    .limit(7);

  return <EveningReviewClient recent={(data as EveningReview[]) ?? []} />;
}
