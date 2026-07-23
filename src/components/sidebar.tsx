"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/", label: "Coach Mode" },
  { href: "/chat", label: "Chat Coach" },
  { href: "/situation", label: "Situation Coach" },
  { href: "/routine", label: "Daily Routine" },
  { href: "/principles", label: "Principles" },
  { href: "/search", label: "Search" },
  { href: "/reviews/evening", label: "Evening Review" },
  { href: "/reviews/weekly", label: "Weekly Review" },
  { href: "/reviews/monthly", label: "Monthly Report" },
  { href: "/knowledge", label: "Knowledge" },
  { href: "/memory", label: "Life Blueprint" },
  { href: "/settings", label: "Settings" },
] as const;

export function Sidebar({ userEmail }: { userEmail?: string | null }) {
  const pathname = usePathname();

  return (
    <aside className="flex h-full w-56 shrink-0 flex-col border-r border-stone-200 bg-[#f3f1eb]/90 backdrop-blur">
      <div className="border-b border-stone-200 px-4 py-5">
        <p className="font-display text-xl tracking-tight text-teal-950">
          Wisdom Engine
        </p>
        <p className="mt-0.5 text-xs text-stone-500">
          Your daily operating system
        </p>
      </div>
      <nav className="flex-1 overflow-y-auto px-2 py-3">
        <ul className="space-y-0.5">
          {NAV.map((item) => {
            const active =
              item.href === "/"
                ? pathname === "/"
                : pathname.startsWith(item.href);
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={cn(
                    "block rounded-md px-3 py-2 text-sm transition-colors",
                    active
                      ? "bg-teal-100 font-medium text-teal-950"
                      : "text-stone-600 hover:bg-stone-100 hover:text-stone-900",
                  )}
                >
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      {userEmail && (
        <div className="border-t border-stone-200 px-4 py-3">
          <p className="truncate text-xs text-stone-500">{userEmail}</p>
        </div>
      )}
    </aside>
  );
}
