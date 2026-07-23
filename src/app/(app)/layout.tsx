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
    <div className="flex min-h-dvh flex-col md:flex-row">
      <Sidebar userEmail={email} />
      <main className="min-w-0 flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-5xl px-4 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] md:px-6 md:py-8">
          {children}
        </div>
      </main>
    </div>
  );
}
