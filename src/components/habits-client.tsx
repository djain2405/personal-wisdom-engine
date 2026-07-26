"use client";

import { useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  Check,
  Flame,
  Pencil,
  Plus,
  RotateCcw,
  Trash2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type { HabitWithProgress } from "@/lib/types";

export function HabitsClient({
  initialHabits,
  dates,
}: {
  initialHabits: HabitWithProgress[];
  dates: string[];
}) {
  const [habits, setHabits] = useState(initialHabits);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function reload() {
    const res = await fetch("/api/habits?includeInactive=1&days=14");
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Could not load habits");
    setHabits(data.habits);
  }

  async function createHabit() {
    if (!title.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/habits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, description }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not add habit");
      setTitle("");
      setDescription("");
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not add habit");
    } finally {
      setLoading(false);
    }
  }

  async function updateHabit(
    habitId: string,
    updates: {
      title?: string;
      description?: string | null;
      active?: boolean;
    },
  ) {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/habits", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "update", habitId, ...updates }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not update habit");
      setEditingId(null);
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not update habit");
    } finally {
      setLoading(false);
    }
  }

  async function moveHabit(index: number, direction: -1 | 1) {
    const target = index + direction;
    const active = habits.filter((habit) => habit.active);
    if (target < 0 || target >= active.length) return;
    const reorderedActive = [...active];
    [reorderedActive[index], reorderedActive[target]] = [
      reorderedActive[target],
      reorderedActive[index],
    ];
    const reordered = [
      ...reorderedActive,
      ...habits.filter((habit) => !habit.active),
    ];
    setHabits(reordered);
    setError(null);
    try {
      const res = await fetch("/api/habits", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "reorder",
          habitIds: reordered.map((habit) => habit.id),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not reorder habits");
    } catch (e) {
      setHabits(habits);
      setError(e instanceof Error ? e.message : "Could not reorder habits");
    }
  }

  const activeHabits = habits.filter((habit) => habit.active);
  const inactiveHabits = habits.filter((habit) => !habit.active);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-2xl text-stone-900 md:text-3xl">
          Habits
        </h1>
        <p className="mt-1 text-sm text-stone-600 md:text-base">
          Track the daily practices that reinforce who you&apos;re becoming.
        </p>
      </div>

      <Card>
        <CardTitle>Add a habit</CardTitle>
        <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_1.5fr_auto] sm:items-end">
          <div>
            <Label htmlFor="habit-title">Habit</Label>
            <Input
              id="habit-title"
              className="mt-1"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Meditate for 10 minutes"
            />
          </div>
          <div>
            <Label htmlFor="habit-description">Why / cue (optional)</Label>
            <Input
              id="habit-description"
              className="mt-1"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="After I make coffee"
            />
          </div>
          <Button onClick={createHabit} disabled={loading || !title.trim()}>
            <Plus className="mr-1 h-4 w-4" />
            Add habit
          </Button>
        </div>
        {error && <p className="mt-3 text-sm text-red-700">{error}</p>}
      </Card>

      <Card>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Current habits</CardTitle>
            <p className="mt-1 text-xs text-stone-500">
              Check them off from Morning Ritual.
            </p>
          </div>
          <span className="text-xs text-stone-500">
            {activeHabits.length} active
          </span>
        </div>

        <div className="mt-4 space-y-2">
          {activeHabits.map((habit, index) => (
            <div
              key={habit.id}
              className="rounded-lg border border-stone-200 bg-white p-3"
            >
              {editingId === habit.id ? (
                <div className="grid gap-2 sm:grid-cols-[1fr_1.5fr_auto]">
                  <Input
                    aria-label="Habit title"
                    value={editTitle}
                    onChange={(event) => setEditTitle(event.target.value)}
                  />
                  <Input
                    aria-label="Habit description"
                    value={editDescription}
                    onChange={(event) =>
                      setEditDescription(event.target.value)
                    }
                  />
                  <div className="flex gap-1">
                    <Button
                      size="sm"
                      onClick={() =>
                        updateHabit(habit.id, {
                          title: editTitle,
                          description: editDescription,
                        })
                      }
                      disabled={!editTitle.trim() || loading}
                    >
                      <Check className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setEditingId(null)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-stone-900">
                      {habit.title}
                    </p>
                    {habit.description && (
                      <p className="truncate text-xs text-stone-500">
                        {habit.description}
                      </p>
                    )}
                  </div>
                  <span className="flex items-center gap-1 text-xs text-amber-700">
                    <Flame className="h-4 w-4" />
                    {habit.currentStreak} day
                    {habit.currentStreak === 1 ? "" : "s"}
                  </span>
                  <Button
                    size="sm"
                    variant="ghost"
                    aria-label={`Move ${habit.title} up`}
                    disabled={index === 0}
                    onClick={() => moveHabit(index, -1)}
                  >
                    <ArrowUp className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    aria-label={`Move ${habit.title} down`}
                    disabled={index === activeHabits.length - 1}
                    onClick={() => moveHabit(index, 1)}
                  >
                    <ArrowDown className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    aria-label={`Edit ${habit.title}`}
                    onClick={() => {
                      setEditingId(habit.id);
                      setEditTitle(habit.title);
                      setEditDescription(habit.description ?? "");
                    }}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    aria-label={`Archive ${habit.title}`}
                    onClick={() => updateHabit(habit.id, { active: false })}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>
          ))}
          {activeHabits.length === 0 && (
            <p className="rounded-lg border border-dashed border-stone-300 p-6 text-center text-sm text-stone-500">
              Add your first habit above.
            </p>
          )}
        </div>
      </Card>

      {activeHabits.length > 0 && (
        <Card className="overflow-hidden">
          <CardTitle>Last 14 days</CardTitle>
          <p className="mt-1 text-xs text-stone-500">
            Completion history and seven-day consistency.
          </p>
          <div className="mt-4 overflow-x-auto pb-2">
            <div className="min-w-[680px]">
              <div
                className="grid gap-1"
                style={{
                  gridTemplateColumns: `minmax(10rem, 1fr) repeat(${dates.length}, 1.75rem) 4rem`,
                }}
              >
                <span />
                {dates.map((date) => (
                  <span
                    key={date}
                    className="text-center text-[10px] text-stone-500"
                    title={date}
                  >
                    {date.slice(8)}
                  </span>
                ))}
                <span className="text-right text-[10px] text-stone-500">
                  7 day
                </span>

                {activeHabits.map((habit) => {
                  const doneDates = new Set(
                    habit.logs
                      .filter((log) => log.done)
                      .map((log) => log.log_date),
                  );
                  return [
                    <span
                      key={`${habit.id}-title`}
                      className="truncate py-1 text-xs font-medium text-stone-700"
                    >
                      {habit.title}
                    </span>,
                    ...dates.map((date) => (
                      <span
                        key={`${habit.id}-${date}`}
                        title={`${habit.title}: ${date}`}
                        className={cn(
                          "m-auto h-5 w-5 rounded",
                          doneDates.has(date)
                            ? "bg-teal-700"
                            : "border border-stone-200 bg-stone-50",
                        )}
                      />
                    )),
                    <span
                      key={`${habit.id}-rate`}
                      className="py-1 text-right text-xs font-medium text-stone-600"
                    >
                      {habit.completionRate7d}%
                    </span>,
                  ];
                })}
              </div>
            </div>
          </div>
        </Card>
      )}

      {inactiveHabits.length > 0 && (
        <Card>
          <CardTitle>Archived</CardTitle>
          <div className="mt-3 space-y-2">
            {inactiveHabits.map((habit) => (
              <div
                key={habit.id}
                className="flex items-center justify-between gap-3 rounded-md border border-stone-200 px-3 py-2"
              >
                <span className="text-sm text-stone-500">{habit.title}</span>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => updateHabit(habit.id, { active: true })}
                >
                  <RotateCcw className="mr-1 h-4 w-4" />
                  Restore
                </Button>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
