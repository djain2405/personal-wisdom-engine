"use client";

import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";

export function LoginForm() {
  async function signInWithGoogle() {
    const supabase = createClient();
    const origin = window.location.origin;
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${origin}/auth/callback`,
      },
    });
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4">
      <div className="w-full max-w-md rounded-2xl border border-stone-200 bg-white/90 p-8 shadow-lg backdrop-blur">
        <p className="font-display text-3xl tracking-tight text-teal-950">
          Wisdom Engine
        </p>
        <p className="mt-2 text-stone-600">
          An AI that learns your philosophy and helps you live it.
        </p>
        <p className="mt-6 text-sm text-stone-500">
          Sign in to open Coach Mode — daily identity, habits, principles, and
          reflection grounded in your own knowledge.
        </p>
        <Button
          className="mt-8 w-full"
          size="lg"
          onClick={signInWithGoogle}
          type="button"
        >
          Continue with Google
        </Button>
      </div>
    </div>
  );
}
