"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, Flame, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type {
  HabitWithProgress,
  MorningCheckin,
} from "@/lib/types";

const SCALE = [1, 2, 3, 4, 5] as const;

function ScalePicker({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value: number | null;
  onChange: (value: number) => void;
}) {
  return (
    <fieldset>
      <legend className="text-sm font-medium text-stone-700">{label}</legend>
      <div className="mt-2 grid grid-cols-5 gap-2">
        {SCALE.map((score) => (
          <button
            key={score}
            id={score === 1 ? id : undefined}
            type="button"
            aria-label={`${label} ${score} out of 5`}
            aria-pressed={value === score}
            onClick={() => onChange(score)}
            className={cn(
              "min-h-11 rounded-md border text-sm font-medium transition-colors",
              value === score
                ? "border-teal-800 bg-teal-800 text-white"
                : "border-stone-300 bg-white text-stone-700 hover:border-teal-600",
            )}
          >
            {score}
          </button>
        ))}
      </div>
      <div className="mt-1 flex justify-between text-xs text-stone-500">
        <span>Low</span>
        <span>High</span>
      </div>
    </fieldset>
  );
}

export function MorningClient({
  date,
  initialCheckin,
  initialHabits,
  reflectionPrompt,
}: {
  date: string;
  initialCheckin: MorningCheckin | null;
  initialHabits: HabitWithProgress[];
  reflectionPrompt: string;
}) {
  const [intention, setIntention] = useState(
    initialCheckin?.intention ?? "",
  );
  const [becomingIdentity, setBecomingIdentity] = useState(
    initialCheckin?.becoming_identity ?? "",
  );
  const [gratitude, setGratitude] = useState<string[]>(
    initialCheckin?.gratitude?.length
      ? initialCheckin.gratitude
      : ["", "", ""],
  );
  const [reflection, setReflection] = useState(
    initialCheckin?.reflection ?? "",
  );
  const [mood, setMood] = useState<number | null>(
    initialCheckin?.mood ?? null,
  );
  const [energy, setEnergy] = useState<number | null>(
    initialCheckin?.energy ?? null,
  );
  const [habits, setHabits] = useState(initialHabits);
  const [saving, setSaving] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [coachSummary, setCoachSummary] = useState<{
    principle: string;
    priorities: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function saveCheckin() {
    setSaving(true);
    setError(null);
    setMessage(null);
    setCoachSummary(null);
    try {
      const res = await fetch("/api/morning", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          intention,
          becomingIdentity,
          gratitude,
          reflection,
          mood,
          energy,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not save");
      if (data.brief) {
        const principle =
          data.brief.principle_to_practice?.split(":")[0]?.trim() ||
          data.brief.principle_to_practice ||
          "updated";
        setMessage("Morning ritual saved. Coach Mode brief updated.");
        setCoachSummary({
          principle,
          priorities: data.brief.priorities || "",
        });
      } else if (data.briefError) {
        setMessage("Morning ritual saved.");
        setError(`Coach brief refresh failed: ${data.briefError}`);
      } else {
        setMessage("Morning ritual saved.");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save");
    } finally {
      setSaving(false);
    }
  }

  async function toggleHabit(habit: HabitWithProgress) {
    setTogglingId(habit.id);
    setError(null);
    const nextDone = !habit.completedToday;
    setHabits((current) =>
      current.map((item) =>
        item.id === habit.id
          ? { ...item, completedToday: nextDone }
          : item,
      ),
    );
    try {
      const res = await fetch("/api/habits", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "toggle",
          habitId: habit.id,
          date,
          done: nextDone,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not update habit");

      const refresh = await fetch("/api/habits?days=14");
      const refreshed = await refresh.json();
      if (refresh.ok) setHabits(refreshed.habits);
    } catch (e) {
      setHabits((current) =>
        current.map((item) =>
          item.id === habit.id
            ? { ...item, completedToday: habit.completedToday }
            : item,
        ),
      );
      setError(e instanceof Error ? e.message : "Could not update habit");
    } finally {
      setTogglingId(null);
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-2xl text-stone-900 md:text-3xl">
          Morning Ritual
        </h1>
        <p className="mt-1 text-sm text-stone-600 md:text-base">
          {date} — begin with awareness, identity, and intention.
        </p>
      </div>

      <Card className="space-y-5">
        <div>
          <Label htmlFor="becoming">Who am I becoming today?</Label>
          <Input
            id="becoming"
            className="mt-2"
            value={becomingIdentity}
            onChange={(event) => setBecomingIdentity(event.target.value)}
            placeholder="I am becoming someone who…"
          />
        </div>

        <div>
          <Label htmlFor="intention">My intention for today</Label>
          <Textarea
            id="intention"
            className="mt-2"
            rows={3}
            value={intention}
            onChange={(event) => setIntention(event.target.value)}
            placeholder="What matters most in how I show up today?"
          />
        </div>

        <div>
          <div className="flex items-center justify-between">
            <Label>Gratitude</Label>
            {gratitude.length < 10 && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setGratitude((items) => [...items, ""])}
              >
                <Plus className="mr-1 h-4 w-4" />
                Add
              </Button>
            )}
          </div>
          <div className="mt-2 space-y-2">
            {gratitude.map((item, index) => (
              <div key={index} className="flex gap-2">
                <Input
                  aria-label={`Gratitude ${index + 1}`}
                  value={item}
                  onChange={(event) =>
                    setGratitude((items) =>
                      items.map((value, itemIndex) =>
                        itemIndex === index ? event.target.value : value,
                      ),
                    )
                  }
                  placeholder={`I'm grateful for…`}
                />
                {gratitude.length > 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    aria-label={`Remove gratitude ${index + 1}`}
                    onClick={() =>
                      setGratitude((items) =>
                        items.filter((_, itemIndex) => itemIndex !== index),
                      )
                    }
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <ScalePicker
            id="mood"
            label="Mood"
            value={mood}
            onChange={setMood}
          />
          <ScalePicker
            id="energy"
            label="Energy"
            value={energy}
            onChange={setEnergy}
          />
        </div>

        <div>
          <Label htmlFor="reflection">Morning reflection</Label>
          <p className="mt-1 text-sm text-teal-900">{reflectionPrompt}</p>
          <Textarea
            id="reflection"
            className="mt-2"
            rows={6}
            value={reflection}
            onChange={(event) => setReflection(event.target.value)}
            placeholder="Write your response…"
          />
        </div>

        <Button
          className="w-full sm:w-auto"
          onClick={saveCheckin}
          disabled={saving}
        >
          {saving
            ? "Saving & refreshing Coach…"
            : initialCheckin?.intention || initialCheckin?.reflection
              ? "Update ritual"
              : "Save ritual"}
        </Button>
        {message && <p className="text-sm text-teal-800">{message}</p>}
        {coachSummary && (
          <div className="rounded-lg border border-teal-200 bg-teal-50/80 p-3 text-sm text-stone-700">
            <p>
              <span className="font-medium text-teal-950">Principle:</span>{" "}
              {coachSummary.principle}
            </p>
            {coachSummary.priorities && (
              <p className="mt-2 whitespace-pre-wrap">
                <span className="font-medium text-teal-950">Priorities:</span>
                {"\n"}
                {coachSummary.priorities}
              </p>
            )}
            <Link
              href="/"
              className="mt-3 inline-flex text-sm font-medium text-teal-800 hover:text-teal-950"
            >
              Open Coach Mode
            </Link>
          </div>
        )}
        {error && <p className="text-sm text-red-700">{error}</p>}
      </Card>

      <Card>
        <div className="flex items-center justify-between gap-3">
          <div>
            <CardTitle>Today&apos;s habits</CardTitle>
            <p className="mt-1 text-xs text-stone-500">
              Small promises kept build your identity.
            </p>
          </div>
          <Link
            href="/habits"
            className="text-sm font-medium text-teal-800 hover:text-teal-950"
          >
            Manage
          </Link>
        </div>

        {habits.length > 0 ? (
          <div className="mt-4 space-y-2">
            {habits.map((habit) => (
              <button
                key={habit.id}
                type="button"
                disabled={togglingId === habit.id}
                onClick={() => toggleHabit(habit)}
                className={cn(
                  "flex min-h-12 w-full items-center gap-3 rounded-lg border px-3 py-2 text-left transition-colors disabled:opacity-60",
                  habit.completedToday
                    ? "border-teal-300 bg-teal-50"
                    : "border-stone-200 bg-white hover:border-teal-400",
                )}
              >
                <span
                  className={cn(
                    "flex h-6 w-6 shrink-0 items-center justify-center rounded-md border",
                    habit.completedToday
                      ? "border-teal-800 bg-teal-800 text-white"
                      : "border-stone-400",
                  )}
                >
                  {habit.completedToday && <Check className="h-4 w-4" />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium text-stone-900">
                    {habit.title}
                  </span>
                  {habit.description && (
                    <span className="block truncate text-xs text-stone-500">
                      {habit.description}
                    </span>
                  )}
                </span>
                <span className="flex shrink-0 items-center gap-1 text-xs text-amber-700">
                  <Flame className="h-4 w-4" />
                  {habit.currentStreak}
                </span>
              </button>
            ))}
          </div>
        ) : (
          <div className="mt-4 rounded-lg border border-dashed border-stone-300 p-4 text-center">
            <p className="text-sm text-stone-600">
              Add the habits you want to practice every day.
            </p>
            <Link
              href="/habits"
              className="mt-2 inline-block text-sm font-medium text-teal-800"
            >
              Add your first habit
            </Link>
          </div>
        )}
      </Card>
    </div>
  );
}
