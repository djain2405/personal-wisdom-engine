import { requireUser } from "@/lib/auth";
import {
  getHabitsWithStreaks,
  recentDateRange,
} from "@/lib/coach/morning";
import { HabitsClient } from "@/components/habits-client";

export const dynamic = "force-dynamic";

export default async function HabitsPage() {
  const { user } = await requireUser();
  const habits = await getHabitsWithStreaks(user.id, {
    includeInactive: true,
    historyDays: 14,
  });

  return <HabitsClient initialHabits={habits} dates={recentDateRange(14)} />;
}
