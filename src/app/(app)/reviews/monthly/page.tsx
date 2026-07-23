import { requireUser } from "@/lib/auth";
import { MonthlyReportClient } from "@/components/monthly-report-client";
import type { MonthlyReport } from "@/lib/types";

export default async function MonthlyReportPage() {
  const { supabase, user } = await requireUser();
  const { data } = await supabase
    .from("monthly_reports")
    .select("*")
    .eq("user_id", user.id)
    .order("month_start", { ascending: false })
    .limit(12);

  return <MonthlyReportClient reports={(data as MonthlyReport[]) ?? []} />;
}
