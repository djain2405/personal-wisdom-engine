"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";

export function RoutineClient() {
  const [energy, setEnergy] = useState("medium");
  const [timeAvailable, setTimeAvailable] = useState("6 hours focused");
  const [goals, setGoals] = useState("");
  const [plan, setPlan] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function generate() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/routine", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ energy, timeAvailable, goals }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      setPlan(data.plan);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-display text-3xl text-stone-900">Daily Routine</h1>
        <p className="mt-1 text-stone-600">
          Build the day from energy, time, goals, habits, and principles.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label htmlFor="energy">Energy</Label>
          <select
            id="energy"
            className="mt-1 flex h-10 w-full rounded-md border border-stone-300 bg-white px-3 text-sm"
            value={energy}
            onChange={(e) => setEnergy(e.target.value)}
          >
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </select>
        </div>
        <div>
          <Label htmlFor="time">Time available</Label>
          <Input
            id="time"
            className="mt-1"
            value={timeAvailable}
            onChange={(e) => setTimeAvailable(e.target.value)}
          />
        </div>
      </div>
      <div>
        <Label htmlFor="goals">Today&apos;s goals (optional)</Label>
        <Textarea
          id="goals"
          className="mt-1"
          value={goals}
          onChange={(e) => setGoals(e.target.value)}
          rows={3}
        />
      </div>
      <Button onClick={generate} disabled={loading}>
        {loading ? "Building…" : "Generate routine"}
      </Button>
      {error && <p className="text-sm text-red-700">{error}</p>}
      {plan && (
        <Card>
          <pre className="whitespace-pre-wrap font-sans text-sm text-stone-700">
            {plan}
          </pre>
        </Card>
      )}
    </div>
  );
}
