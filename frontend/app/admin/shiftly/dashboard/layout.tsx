"use client";

// Auth is gated once, site-wide, by app/admin/layout.tsx (AuthProvider +
// redirect-to-/admin/login guard). This layout only needs the current
// session's email/logout for its own chrome — no separate token check here.

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/admin/auth-context";
import { clsx } from "@/lib/shiftly/clsx";

function ClockIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="18" height="18" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" />
      <path d="M12 7v5l3.5 2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function UsersIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="18" height="18" viewBox="0 0 24 24" fill="none">
      <circle cx="9" cy="8" r="3" stroke="currentColor" strokeWidth="2" />
      <path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M16 4.5c1.7.4 3 2 3 3.9 0 1.9-1.3 3.5-3 3.9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M18.5 14.3c2 .6 3.5 2.6 3.5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function CalendarIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="18" height="18" viewBox="0 0 24 24" fill="none">
      <rect x="3.5" y="5" width="17" height="16" rx="2" stroke="currentColor" strokeWidth="2" />
      <path d="M3.5 10h17M8 3v4M16 3v4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function PayoutIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="18" height="18" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" />
      <path d="M9.5 15.5c0 1.1 1.1 2 2.5 2s2.5-.7 2.5-1.8c0-2.6-5-1.4-5-4C9.5 10.7 10.6 10 12 10s2.5.9 2.5 2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M12 8.5v1.2M12 15.5v1.3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

const NAV_ITEMS = [
  { href: "/admin/shiftly/dashboard/log-attendance", label: "Log Attendance", shortLabel: "Log", Icon: ClockIcon },
  { href: "/admin/shiftly/dashboard/employees", label: "Manage Employees", shortLabel: "Team", Icon: UsersIcon },
  { href: "/admin/shiftly/dashboard/attendance-summary", label: "Attendance Summary", shortLabel: "Attendance", Icon: CalendarIcon },
  { href: "/admin/shiftly/dashboard/payout-summary", label: "Payout Summary", shortLabel: "Payout", Icon: PayoutIcon },
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { email, isLoading } = useAuth();

  if (isLoading) return null;

  return (
    <div className="flex min-h-screen w-full flex-col bg-cream text-navy lg:flex-row">
      {/* Mobile top bar */}
      <header className="flex items-center justify-between border-b border-navy/10 bg-white px-4 py-3 lg:hidden">
        <Link href="/admin" className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal font-bold text-sm text-white">
            S
          </div>
          <span className="font-display text-lg tracking-tight text-navy">Shiftly</span>
        </Link>
        <Link
          href="/admin"
          className="text-xs font-medium text-navy/50 hover:text-teal transition-colors"
        >
          All apps
        </Link>
      </header>

      {/* Desktop sidebar */}
      <aside className="hidden w-64 shrink-0 flex-col border-r border-navy/10 bg-white px-4 py-6 lg:flex">
        <Link href="/admin" className="flex items-center gap-2 px-2 group">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal font-bold text-sm text-white">
            S
          </div>
          <span className="font-display text-lg tracking-tight text-navy group-hover:text-teal transition-colors">
            Shiftly
          </span>
        </Link>
        <Link
          href="/admin"
          className="mt-1 px-2 text-xs font-medium text-navy/40 hover:text-teal transition-colors"
        >
          ← All apps
        </Link>

        <nav className="mt-8 flex flex-1 flex-col gap-1">
          {NAV_ITEMS.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={clsx(
                  "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                  active
                    ? "bg-teal/10 text-teal ring-1 ring-inset ring-teal/20"
                    : "text-navy/80 hover:bg-navy/5 hover:text-teal",
                )}
              >
                <item.Icon />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto space-y-1 border-t border-navy/10 pt-4">
          <div className="px-2 text-xs text-navy/40">Signed in as</div>
          <div className="truncate px-2 text-sm text-navy/70">{email}</div>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto p-4 pb-24 sm:p-6 lg:p-8 lg:pb-8">
        {children}
      </main>

      {/* Mobile bottom nav */}
      <nav
        className="fixed inset-x-0 bottom-0 z-30 flex border-t border-navy/10 bg-white/95 backdrop-blur lg:hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        {NAV_ITEMS.map((item) => {
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={clsx(
                "flex flex-1 flex-col items-center gap-0.5 py-2.5 text-[11px] font-medium transition-colors",
                active ? "text-teal" : "text-navy/50",
              )}
            >
              <item.Icon />
              {item.shortLabel}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
