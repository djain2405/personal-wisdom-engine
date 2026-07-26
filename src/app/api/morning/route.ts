import { NextResponse } from "next/server";
import { z } from "zod";
import { getAppUser } from "@/lib/auth";
import { getTodayCheckin } from "@/lib/coach/morning";
import { todayISO } from "@/lib/utils";

const CheckinSchema = z.object({
  intention: z.string().trim().max(4000).nullable().optional(),
  becomingIdentity: z.string().trim().max(4000).nullable().optional(),
  gratitude: z.array(z.string().trim().max(1000)).max(10).optional(),
  reflection: z.string().trim().max(12000).nullable().optional(),
  mood: z.number().int().min(1).max(5).nullable().optional(),
  energy: z.number().int().min(1).max(5).nullable().optional(),
});

export async function GET() {
  const { user } = await getAppUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const checkin = await getTodayCheckin(user.id);
    return NextResponse.json({ checkin, date: todayISO() });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Could not load check-in" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  const { supabase, user } = await getAppUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = CheckinSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid check-in" },
      { status: 400 },
    );
  }

  const gratitude = (parsed.data.gratitude ?? []).filter(Boolean);
  const { data, error } = await supabase
    .from("morning_checkins")
    .upsert(
      {
        user_id: user.id,
        checkin_date: todayISO(),
        intention: parsed.data.intention || null,
        becoming_identity: parsed.data.becomingIdentity || null,
        gratitude,
        reflection: parsed.data.reflection || null,
        mood: parsed.data.mood ?? null,
        energy: parsed.data.energy ?? null,
      },
      { onConflict: "user_id,checkin_date" },
    )
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ checkin: data });
}
