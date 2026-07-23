import { requireUser } from "@/lib/auth";
import { WeeklyReviewClient } from "@/components/weekly-review-client";
import type { WeeklyReview } from "@/lib/types";

export default async function WeeklyReviewPage() {
  const { supabase, user } = await requireUser();
  const { data } = await supabase
    .from("weekly_reviews")
    .select("*")
    .eq("user_id", user.id)
    .order("week_start", { ascending: false })
    .limit(12);

  return <WeeklyReviewClient reviews={(data as WeeklyReview[]) ?? []} />;
}
