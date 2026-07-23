import { Sidebar } from "@/components/sidebar";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { isPersonalMode } from "@/lib/personal-mode";
import { getAppUser } from "@/lib/auth";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let email: string | null = isPersonalMode() ? "Personal mode" : null;
  if (isSupabaseConfigured() && !isPersonalMode()) {
    try {
      const { user } = await getAppUser();
      email = user?.email ?? null;
    } catch {
      email = null;
    }
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar userEmail={email} />
      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-5xl px-6 py-8">{children}</div>
      </main>
    </div>
  );
}
