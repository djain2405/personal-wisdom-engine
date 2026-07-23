import { isSupabaseConfigured } from "@/lib/supabase/config";
import { getAppUser } from "@/lib/auth";
import { getOrCreateDailyBrief } from "@/lib/coach/daily-brief";
import { CoachHomeClient } from "@/components/coach-home-client";
import { EmptyState } from "@/components/empty-state";
import type { DailyBrief } from "@/lib/types";

export default async function HomePage() {
  if (!isSupabaseConfigured()) {
    return (
      <EmptyState message="Add NEXT_PUBLIC_SUPABASE_URL and keys to .env.local, then run the SQL migration." />
    );
  }

  let brief: DailyBrief | null = null;
  let error: string | null = null;

  try {
    const { supabase, user } = await getAppUser();
    if (!user) {
      return (
        <EmptyState
          message="Sign in to open Coach Mode, or set PERSONAL_MODE=true for no-login MVP."
          actionHref="/login"
          actionLabel="Sign in"
        />
      );
    }

    const { data: existing } = await supabase
      .from("daily_briefs")
      .select("*")
      .eq("user_id", user.id)
      .eq("brief_date", new Date().toISOString().slice(0, 10))
      .maybeSingle();

    if (existing) {
      brief = existing as DailyBrief;
    } else {
      const { data: profile } = await supabase
        .from("profiles")
        .select("ai_provider")
        .eq("id", user.id)
        .maybeSingle();
      brief = await getOrCreateDailyBrief(user.id, {
        provider: (profile as { ai_provider?: string } | null)?.ai_provider,
      });
    }
  } catch (e) {
    error = e instanceof Error ? e.message : "Could not load Coach Mode";
  }

  return <CoachHomeClient initialBrief={brief} initialError={error} />;
}
