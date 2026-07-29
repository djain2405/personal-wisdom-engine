import { requireUser } from "@/lib/auth";
import { getHabitsWithStreaks } from "@/lib/coach/morning";
import { getOrCreateMorningPrompt } from "@/lib/coach/morning-prompt";
import { MorningClient } from "@/components/morning-client";
import { todayISO } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function MorningPage() {
  const { user } = await requireUser();
  const [{ prompt, checkin }, habits] = await Promise.all([
    getOrCreateMorningPrompt(user.id),
    getHabitsWithStreaks(user.id),
  ]);

  return (
    <MorningClient
      date={todayISO()}
      initialCheckin={checkin}
      initialHabits={habits}
      reflectionPrompt={prompt}
    />
  );
}
