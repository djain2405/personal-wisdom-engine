import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import {
  hasServiceRoleKey,
  isPersonalMode,
  LOCAL_USER_EMAIL,
  LOCAL_USER_ID,
} from "@/lib/personal-mode";

type AppUser = {
  id: string;
  email?: string | null;
};

async function ensureLocalUser(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: existing, error: getErr } =
    await supabase.auth.admin.getUserById(LOCAL_USER_ID);

  if (!getErr && existing?.user) {
    await ensureProfileAndMemory(supabase, LOCAL_USER_ID, "Personal");
    return {
      id: existing.user.id,
      email: existing.user.email ?? LOCAL_USER_EMAIL,
    } satisfies AppUser;
  }

  const { data: created, error: createErr } =
    await supabase.auth.admin.createUser({
      id: LOCAL_USER_ID,
      email: LOCAL_USER_EMAIL,
      email_confirm: true,
      user_metadata: { full_name: "Personal" },
    });

  if (createErr) {
    const { data: listed } = await supabase.auth.admin.listUsers({
      page: 1,
      perPage: 200,
    });
    const found = listed?.users?.find((u) => u.email === LOCAL_USER_EMAIL);
    if (found) {
      await ensureProfileAndMemory(supabase, found.id, "Personal");
      return { id: found.id, email: found.email };
    }
    throw new Error(
      `Could not create local user: ${createErr.message}. Add SUPABASE_SERVICE_ROLE_KEY to .env.local (Legacy service_role key from Supabase API Keys).`,
    );
  }

  const user = created.user;
  if (!user) throw new Error("Local user creation returned no user");
  await ensureProfileAndMemory(supabase, user.id, "Personal");
  return { id: user.id, email: user.email ?? LOCAL_USER_EMAIL };
}

async function ensureProfileAndMemory(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  displayName: string,
) {
  await supabase.from("profiles").upsert(
    {
      id: userId,
      display_name: displayName,
      ai_provider: process.env.AI_PROVIDER || "claude",
    },
    { onConflict: "id" },
  );
  await supabase.from("identity_memory").upsert(
    { user_id: userId },
    { onConflict: "user_id" },
  );
}

/** For API routes and pages — never redirects. */
export async function getAppUser() {
  if (isPersonalMode() && !hasServiceRoleKey()) {
    throw new Error(
      "PERSONAL_MODE is on but SUPABASE_SERVICE_ROLE_KEY is missing in .env.local. Copy the Legacy service_role key from Supabase → API Keys.",
    );
  }

  const supabase = await createClient();

  if (isPersonalMode()) {
    const user = await ensureLocalUser(supabase);
    return { supabase, user };
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { supabase, user: null };
  return {
    supabase,
    user: { id: user.id, email: user.email } satisfies AppUser,
  };
}

/** For pages that require a user — redirects to login unless PERSONAL_MODE. */
export async function requireUser() {
  const { supabase, user } = await getAppUser();
  if (!user) {
    if (isPersonalMode()) {
      throw new Error("Personal mode failed to resolve local user.");
    }
    redirect("/login");
  }
  return { supabase, user };
}
