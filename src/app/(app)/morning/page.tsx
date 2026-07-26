import { requireUser } from "@/lib/auth";
import {
  getHabitsWithStreaks,
  getTodayCheckin,
} from "@/lib/coach/morning";
import { MorningClient } from "@/components/morning-client";
import { todayISO } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function MorningPage() {
  const { user } = await requireUser();
  const [checkin, habits] = await Promise.all([
    getTodayCheckin(user.id),
    getHabitsWithStreaks(user.id),
  ]);

  return (
    <MorningClient
      date={todayISO()}
      initialCheckin={checkin}
      initialHabits={habits}
    />
  );
}
