import { NextResponse } from "next/server";
import { getAppUser } from "@/lib/auth";
import { getOrCreateDailyBrief } from "@/lib/coach/daily-brief";

export async function GET(request: Request) {
  const { supabase, user } = await getAppUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const regenerate = searchParams.get("regenerate") === "1";

  const { data: profile } = await supabase
    .from("profiles")
    .select("ai_provider")
    .eq("id", user.id)
    .maybeSingle();

  try {
    const brief = await getOrCreateDailyBrief(user.id, {
      regenerate,
      provider: (profile as { ai_provider?: string } | null)?.ai_provider,
    });
    return NextResponse.json({ brief });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to generate brief" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  const { supabase, user } = await getAppUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const { data: profile } = await supabase
    .from("profiles")
    .select("ai_provider")
    .eq("id", user.id)
    .maybeSingle();

  try {
    const brief = await getOrCreateDailyBrief(user.id, {
      regenerate: Boolean(body.regenerate),
      provider: (profile as { ai_provider?: string } | null)?.ai_provider,
    });
    return NextResponse.json({ brief });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to generate brief" },
      { status: 500 },
    );
  }
}
