"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import type { IdentityMemory } from "@/lib/types";
import { saveIdentityMemory } from "@/app/(app)/actions";

export function MemoryForm({ memory }: { memory: IdentityMemory | null }) {
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onSubmit(formData: FormData) {
    setMessage(null);
    startTransition(async () => {
      const result = await saveIdentityMemory(formData);
      setMessage(result.ok ? "Saved" : result.error);
    });
  }

  const fields = [
    { name: "dream_identity", label: "Dream identity", value: memory?.dream_identity },
    { name: "values", label: "Values", value: memory?.values },
    { name: "goals", label: "Goals", value: memory?.goals },
    { name: "current_habits", label: "Current habits", value: memory?.current_habits },
    { name: "challenges", label: "Challenges", value: memory?.challenges },
    { name: "life_areas", label: "Life areas", value: memory?.life_areas },
    { name: "notes", label: "Notes", value: memory?.notes },
  ] as const;

  return (
    <form action={onSubmit} className="space-y-4">
      <div>
        <h1 className="font-display text-3xl text-stone-900">Life Blueprint</h1>
        <p className="mt-1 text-stone-600">
          Memory the coach uses: identity, values, habits, and challenges.
        </p>
      </div>
      <Card className="space-y-4">
        {fields.map((f) => (
          <div key={f.name}>
            <Label htmlFor={f.name}>{f.label}</Label>
            <Textarea
              id={f.name}
              name={f.name}
              className="mt-1"
              rows={3}
              defaultValue={f.value ?? ""}
            />
          </div>
        ))}
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save blueprint"}
        </Button>
        {message && <p className="text-sm text-stone-600">{message}</p>}
      </Card>
    </form>
  );
}
