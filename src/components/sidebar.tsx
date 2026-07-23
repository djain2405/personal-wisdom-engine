"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
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

function NavLinks({
  pathname,
  onNavigate,
}: {
  pathname: string;
  onNavigate?: () => void;
}) {
  return (
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
              onClick={onNavigate}
              className={cn(
                "block min-h-11 rounded-md px-3 py-2.5 text-sm transition-colors md:min-h-0 md:py-2",
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
  );
}

function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <div className={compact ? "" : "border-b border-stone-200 px-4 py-5"}>
      <p className="font-display text-xl tracking-tight text-teal-950">
        Wisdom Engine
      </p>
      {!compact && (
        <p className="mt-0.5 text-xs text-stone-500">
          Your daily operating system
        </p>
      )}
    </div>
  );
}

export function Sidebar({ userEmail }: { userEmail?: string | null }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  return (
    <>
      {/* Mobile top bar */}
      <header
        className="sticky top-0 z-40 flex items-center gap-3 border-b border-stone-200 bg-[#f3f1eb]/95 px-4 py-3 backdrop-blur md:hidden"
        style={{ paddingTop: "max(0.75rem, env(safe-area-inset-top))" }}
      >
        <button
          type="button"
          aria-label="Open menu"
          className="inline-flex h-11 w-11 items-center justify-center rounded-md text-stone-800 hover:bg-stone-200/70"
          onClick={() => setOpen(true)}
        >
          <Menu className="h-5 w-5" />
        </button>
        <Brand compact />
      </header>

      {/* Desktop sidebar */}
      <aside className="hidden h-full w-56 shrink-0 flex-col border-r border-stone-200 bg-[#f3f1eb]/90 backdrop-blur md:flex">
        <Brand />
        <nav className="flex-1 overflow-y-auto px-2 py-3">
          <NavLinks pathname={pathname} />
        </nav>
        {userEmail && (
          <div className="border-t border-stone-200 px-4 py-3">
            <p className="truncate text-xs text-stone-500">{userEmail}</p>
          </div>
        )}
      </aside>

      {/* Mobile drawer */}
      {open && (
        <div className="fixed inset-0 z-50 md:hidden" role="dialog" aria-modal="true">
          <button
            type="button"
            aria-label="Close menu"
            className="absolute inset-0 bg-stone-900/40"
            onClick={() => setOpen(false)}
          />
          <aside
            className="absolute inset-y-0 left-0 flex w-[min(18rem,88vw)] flex-col bg-[#f3f1eb] shadow-xl"
            style={{ paddingTop: "env(safe-area-inset-top)" }}
          >
            <div className="flex items-center justify-between border-b border-stone-200 px-4 py-3">
              <Brand compact />
              <button
                type="button"
                aria-label="Close menu"
                className="inline-flex h-11 w-11 items-center justify-center rounded-md text-stone-800 hover:bg-stone-200/70"
                onClick={() => setOpen(false)}
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <nav className="flex-1 overflow-y-auto px-2 py-3">
              <NavLinks pathname={pathname} onNavigate={() => setOpen(false)} />
            </nav>
            {userEmail && (
              <div
                className="border-t border-stone-200 px-4 py-3"
                style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
              >
                <p className="truncate text-xs text-stone-500">{userEmail}</p>
              </div>
            )}
          </aside>
        </div>
      )}
    </>
  );
}
