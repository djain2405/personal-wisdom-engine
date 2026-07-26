import { NextResponse } from "next/server";
import { z } from "zod";
import { getAppUser } from "@/lib/auth";
import { getHabitsWithStreaks } from "@/lib/coach/morning";
import { todayISO } from "@/lib/utils";

const CreateHabitSchema = z.object({
  title: z.string().trim().min(1).max(160),
  description: z.string().trim().max(2000).nullable().optional(),
});

const PatchHabitSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("toggle"),
    habitId: z.string().uuid(),
    date: z.string().date().optional(),
    done: z.boolean().optional(),
  }),
  z.object({
    action: z.literal("update"),
    habitId: z.string().uuid(),
    title: z.string().trim().min(1).max(160).optional(),
    description: z.string().trim().max(2000).nullable().optional(),
    active: z.boolean().optional(),
    sortOrder: z.number().int().min(0).optional(),
  }),
  z.object({
    action: z.literal("reorder"),
    habitIds: z.array(z.string().uuid()).max(100),
  }),
]);

export async function GET(request: Request) {
  const { user } = await getAppUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const includeInactive = url.searchParams.get("includeInactive") === "1";
  const requestedDays = Number(url.searchParams.get("days") ?? 14);
  const historyDays = Math.min(90, Math.max(7, requestedDays || 14));

  try {
    const habits = await getHabitsWithStreaks(user.id, {
      includeInactive,
      historyDays,
    });
    return NextResponse.json({ habits, today: todayISO() });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Could not load habits" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  const { supabase, user } = await getAppUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = CreateHabitSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid habit" },
      { status: 400 },
    );
  }

  const { count } = await supabase
    .from("tracked_habits")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id);
  const { data, error } = await supabase
    .from("tracked_habits")
    .insert({
      user_id: user.id,
      title: parsed.data.title,
      description: parsed.data.description || null,
      sort_order: count ?? 0,
    })
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ habit: data });
}

export async function PATCH(request: Request) {
  const { supabase, user } = await getAppUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = PatchHabitSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid habit update" },
      { status: 400 },
    );
  }

  if (parsed.data.action === "reorder") {
    const results = await Promise.all(
      parsed.data.habitIds.map((id, sortOrder) =>
        supabase
          .from("tracked_habits")
          .update({ sort_order: sortOrder })
          .eq("id", id)
          .eq("user_id", user.id),
      ),
    );
    const failed = results.find((result) => result.error);
    if (failed?.error) {
      return NextResponse.json(
        { error: failed.error.message },
        { status: 500 },
      );
    }
    return NextResponse.json({ ok: true });
  }

  const { data: ownedHabit } = await supabase
    .from("tracked_habits")
    .select("id")
    .eq("id", parsed.data.habitId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!ownedHabit) {
    return NextResponse.json({ error: "Habit not found" }, { status: 404 });
  }

  if (parsed.data.action === "update") {
    const updates: Record<string, string | number | boolean | null> = {};
    if (parsed.data.title !== undefined) updates.title = parsed.data.title;
    if (parsed.data.description !== undefined) {
      updates.description = parsed.data.description || null;
    }
    if (parsed.data.active !== undefined) updates.active = parsed.data.active;
    if (parsed.data.sortOrder !== undefined) {
      updates.sort_order = parsed.data.sortOrder;
    }

    const { data, error } = await supabase
      .from("tracked_habits")
      .update(updates)
      .eq("id", parsed.data.habitId)
      .eq("user_id", user.id)
      .select("*")
      .single();
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ habit: data });
  }

  const logDate = parsed.data.date ?? todayISO();
  const { data: existing } = await supabase
    .from("habit_logs")
    .select("done")
    .eq("user_id", user.id)
    .eq("tracked_habit_id", parsed.data.habitId)
    .eq("log_date", logDate)
    .maybeSingle();
  const done =
    parsed.data.done ?? !(existing as { done?: boolean } | null)?.done;

  const { data, error } = await supabase
    .from("habit_logs")
    .upsert(
      {
        user_id: user.id,
        tracked_habit_id: parsed.data.habitId,
        log_date: logDate,
        done,
      },
      { onConflict: "user_id,tracked_habit_id,log_date" },
    )
    .select("*")
    .single();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ log: data });
}
