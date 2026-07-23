"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { saveAiProvider } from "@/app/(app)/actions";

export function SettingsClient({
  profile,
  keysPresent,
  personalMode,
}: {
  profile: {
    display_name: string | null;
    avatar_url: string | null;
    ai_provider: string | null;
  } | null;
  keysPresent: {
    claude: boolean;
    gemini: boolean;
    openai: boolean;
    supabase: boolean;
    serviceRole: boolean;
  };
  personalMode: boolean;
}) {
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onSaveProvider(formData: FormData) {
    setMessage(null);
    startTransition(async () => {
      const result = await saveAiProvider(formData);
      setMessage(result.ok ? "Saved" : result.error);
    });
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl text-stone-900">Settings</h1>
        <p className="mt-1 text-stone-600">
          {personalMode
            ? "Personal mode — no login. Keys stay on the server."
            : "Profile and AI provider configuration"}
        </p>
      </div>

      <Card>
        <CardTitle>Profile</CardTitle>
        <dl className="mt-3 space-y-2 text-sm">
          <div>
            <dt className="text-stone-500">Name</dt>
            <dd>
              {profile?.display_name ?? (personalMode ? "Personal" : "—")}
            </dd>
          </div>
          <div>
            <dt className="text-stone-500">Mode</dt>
            <dd>{personalMode ? "Personal (no login)" : "Authenticated"}</dd>
          </div>
        </dl>
      </Card>

      <Card>
        <CardTitle>Default AI provider</CardTitle>
        <form action={onSaveProvider} className="mt-3 space-y-3">
          <Label htmlFor="ai_provider">Provider</Label>
          <select
            id="ai_provider"
            name="ai_provider"
            defaultValue={profile?.ai_provider ?? "claude"}
            className="flex h-10 w-full rounded-md border border-stone-300 bg-white px-3 text-sm"
          >
            <option value="claude">Claude</option>
            <option value="gemini">Gemini</option>
            <option value="openai">OpenAI</option>
          </select>
          <Button type="submit" disabled={pending}>
            {pending ? "Saving…" : "Save"}
          </Button>
          {message && <p className="text-sm text-stone-600">{message}</p>}
        </form>
      </Card>

      <Card>
        <CardTitle>API keys (server-side)</CardTitle>
        <ul className="mt-3 space-y-1 text-sm text-stone-600">
          <li>
            Supabase URL/anon: {keysPresent.supabase ? "configured" : "missing"}
          </li>
          <li>
            Service role (personal mode):{" "}
            {keysPresent.serviceRole ? "configured" : "missing"}
          </li>
          <li>Claude: {keysPresent.claude ? "configured" : "missing"}</li>
          <li>Gemini: {keysPresent.gemini ? "configured" : "missing"}</li>
          <li>
            OpenAI (embeddings):{" "}
            {keysPresent.openai ? "configured" : "missing"}
          </li>
        </ul>
        <p className="mt-3 text-xs text-stone-500">
          Keys live in environment variables only — never exposed to the
          browser.
        </p>
      </Card>
    </div>
  );
}
