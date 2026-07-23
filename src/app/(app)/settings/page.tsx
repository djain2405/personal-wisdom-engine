import { isSupabaseConfigured } from "@/lib/supabase/config";
import { isPersonalMode, hasServiceRoleKey } from "@/lib/personal-mode";
import { getAppUser } from "@/lib/auth";
import { SettingsClient } from "./settings-client";

export default async function SettingsPage() {
  let profile = null;
  if (isSupabaseConfigured()) {
    try {
      const { supabase, user } = await getAppUser();
      if (user) {
        const { data } = await supabase
          .from("profiles")
          .select("display_name, avatar_url, ai_provider")
          .eq("id", user.id)
          .maybeSingle();
        profile = data as {
          display_name: string | null;
          avatar_url: string | null;
          ai_provider: string | null;
        } | null;
      }
    } catch {
      profile = null;
    }
  }

  return (
    <SettingsClient
      profile={profile}
      personalMode={isPersonalMode()}
      keysPresent={{
        supabase: isSupabaseConfigured(),
        serviceRole: hasServiceRoleKey(),
        claude: Boolean(process.env.ANTHROPIC_API_KEY),
        gemini: Boolean(process.env.GOOGLE_AI_API_KEY),
        openai: Boolean(process.env.OPENAI_API_KEY),
      }}
    />
  );
}
