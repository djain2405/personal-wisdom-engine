import { createClient } from "@/lib/supabase/server";
import { todayISO } from "@/lib/utils";
import type {
  HabitLog,
  HabitWithProgress,
  MorningCheckin,
  TrackedHabit,
} from "@/lib/types";

function shiftISODate(date: string, days: number) {
  const [year, month, day] = date.split("-").map(Number);
  const shifted = new Date(Date.UTC(year, month - 1, day + days));
  return shifted.toISOString().slice(0, 10);
}

export function recentDateRange(days: number, end = todayISO()) {
  return Array.from({ length: days }, (_, index) =>
    shiftISODate(end, index - days + 1),
  );
}

export async function getTodayCheckin(userId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("morning_checkins")
    .select("*")
    .eq("user_id", userId)
    .eq("checkin_date", todayISO())
    .maybeSingle();

  if (error) throw error;
  return (data as MorningCheckin | null) ?? null;
}

export async function getRecentCheckins(userId: string, limit = 7) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("morning_checkins")
    .select("*")
    .eq("user_id", userId)
    .order("checkin_date", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return (data as MorningCheckin[]) ?? [];
}

export async function getHabitsWithStreaks(
  userId: string,
  options?: { includeInactive?: boolean; historyDays?: number },
): Promise<HabitWithProgress[]> {
  const supabase = await createClient();
  const today = todayISO();
  const historyDays = Math.max(options?.historyDays ?? 14, 14);
  const historyStart = shiftISODate(today, -Math.max(historyDays, 90) + 1);

  let habitsQuery = supabase
    .from("tracked_habits")
    .select("*")
    .eq("user_id", userId)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });
  if (!options?.includeInactive) habitsQuery = habitsQuery.eq("active", true);

  const [{ data: habits, error: habitsError }, { data: logs, error: logsError }] =
    await Promise.all([
      habitsQuery,
      supabase
        .from("habit_logs")
        .select("id, user_id, tracked_habit_id, log_date, done, created_at")
        .eq("user_id", userId)
        .gte("log_date", historyStart)
        .lte("log_date", today)
        .order("log_date", { ascending: false }),
    ]);

  if (habitsError) throw habitsError;
  if (logsError) throw logsError;

  const allLogs = (logs as HabitLog[]) ?? [];
  const last7 = new Set(recentDateRange(7, today));

  return ((habits as TrackedHabit[]) ?? []).map((habit) => {
    const habitLogs = allLogs.filter(
      (log) => log.tracked_habit_id === habit.id,
    );
    const completedDates = new Set(
      habitLogs.filter((log) => log.done).map((log) => log.log_date),
    );

    let currentStreak = 0;
    let cursor = today;
    while (completedDates.has(cursor)) {
      currentStreak += 1;
      cursor = shiftISODate(cursor, -1);
    }

    const completed7d = [...last7].filter((date) =>
      completedDates.has(date),
    ).length;

    return {
      ...habit,
      completedToday: completedDates.has(today),
      currentStreak,
      completionRate7d: Math.round((completed7d / 7) * 100),
      logs: habitLogs
        .filter((log) => recentDateRange(historyDays, today).includes(log.log_date))
        .map(({ log_date, done }) => ({ log_date, done })),
    };
  });
}

export async function getMorningContext(userId: string) {
  const [checkins, habits] = await Promise.all([
    getRecentCheckins(userId, 7),
    getHabitsWithStreaks(userId, { historyDays: 7 }),
  ]);
  const today = todayISO();
  const todayCheckin =
    checkins.find((checkin) => checkin.checkin_date === today) ?? null;

  const moodValues = checkins
    .map((checkin) => checkin.mood)
    .filter((value): value is number => value != null);
  const energyValues = checkins
    .map((checkin) => checkin.energy)
    .filter((value): value is number => value != null);
  const average = (values: number[]) =>
    values.length
      ? Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 10) /
        10
      : null;

  return {
    today: todayCheckin
      ? {
          intention: todayCheckin.intention,
          becoming_identity: todayCheckin.becoming_identity,
          gratitude: todayCheckin.gratitude,
          reflection: todayCheckin.reflection,
          mood: todayCheckin.mood,
          energy: todayCheckin.energy,
        }
      : null,
    recent: checkins.map((checkin) => ({
      date: checkin.checkin_date,
      intention: checkin.intention,
      mood: checkin.mood,
      energy: checkin.energy,
    })),
    trends: {
      averageMood7d: average(moodValues),
      averageEnergy7d: average(energyValues),
    },
    habits: habits.map((habit) => ({
      title: habit.title,
      completedToday: habit.completedToday,
      currentStreak: habit.currentStreak,
      completionRate7d: habit.completionRate7d,
    })),
    habitConsistency:
      habits.length > 0
        ? Math.round(
            habits.reduce((sum, habit) => sum + habit.completionRate7d, 0) /
              habits.length,
          )
        : null,
  };
}
