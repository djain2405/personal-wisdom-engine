import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Calendar "today" in the app timezone (Vercel is UTC; UTC date ≠ local day). */
export function appTimeZone() {
  return process.env.APP_TIMEZONE || "America/Los_Angeles";
}

export function todayISO(d = new Date(), timeZone = appTimeZone()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

export function startOfWeekISO(d = new Date(), timeZone = appTimeZone()) {
  const today = todayISO(d, timeZone);
  const [y, m, day] = today.split("-").map(Number);
  const weekday = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
  }).format(d);
  const dayNum =
    { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }[weekday] ?? 1;
  const diff = dayNum === 0 ? -6 : 1 - dayNum;
  const weekStart = new Date(Date.UTC(y, m - 1, day + diff));
  return weekStart.toISOString().slice(0, 10);
}

export function startOfMonthISO(d = new Date(), timeZone = appTimeZone()) {
  return `${todayISO(d, timeZone).slice(0, 7)}-01`;
}

export function extractJson<T>(text: string): T | null {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced?.[1]?.trim() ?? text.trim();
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  try {
    return JSON.parse(candidate.slice(start, end + 1)) as T;
  } catch {
    return null;
  }
}
