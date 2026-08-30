"use client";

// Auth is gated once, site-wide, by app/admin/layout.tsx (AuthProvider +
// redirect-to-/admin/login guard). This layout only needs the current
// session's email/logout for its own chrome — no separate token check here.
// The P&L Summary tab is hidden entirely for admins without Ledgerly
// access (useLedgerlyAccess) — real enforcement is still server-side.

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/admin/auth-context";
import { clsx } from "@/lib/admin/clsx";
import { useLedgerlyAccess } from "@/lib/ledgerly/use-access";

function CoinIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="18" height="18" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" />
      <path d="M9.5 15c0 1 1.1 1.8 2.5 1.8s2.5-.7 2.5-1.7c0-2.4-5-1.3-5-3.7 0-1 1.1-1.7 2.5-1.7s2.5.8 2.5 1.7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M12 7.5v1M12 15.5v1" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function ReceiptIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path d="M6 3h12v18l-2.5-1.5L13 21l-1-1.5L11 21l-2.5-1.5L6 21V3z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      <path d="M9 8h6M9 12h6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function ChartIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path d="M4 20V10M12 20V4M20 20v-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function DownloadIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path d="M12 4v11m0 0l-4-4m4 4l4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M5 18h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

const NAV_ITEMS = [
  { href: "/ledgerly/dashboard/log-revenue", label: "Log Revenue", shortLabel: "Revenue", Icon: CoinIcon, gated: false },
  { href: "/ledgerly/dashboard/payments", label: "Payments", shortLabel: "Payments", Icon: ReceiptIcon, gated: false },
  { href: "/ledgerly/dashboard/summary", label: "P&L Summary", shortLabel: "Summary", Icon: ChartIcon, gated: true },
  { href: "/ledgerly/dashboard/tax-export", label: "Tax Export", shortLabel: "Tax", Icon: DownloadIcon, gated: true },
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { email, isLoading } = useAuth();
  const access = useLedgerlyAccess();
  const navItems = NAV_ITEMS.filter((item) => !item.gated || access === "allowed");

  if (isLoading) return null;

  return (
    <div className="flex min-h-screen w-full flex-col bg-cream text-navy lg:flex-row">
      {/* Mobile top bar */}
      <header className="flex items-center justify-between border-b border-navy/10 bg-white px-4 py-3 lg:hidden">
        <Link href="/admin" className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal font-bold text-sm text-white">
            L
          </div>
          <span className="font-display text-lg tracking-tight text-navy">Ledgerly</span>
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
            L
          </div>
          <span className="font-display text-lg tracking-tight text-navy group-hover:text-teal transition-colors">
            Ledgerly
          </span>
        </Link>
        <Link
          href="/admin"
          className="mt-1 px-2 text-xs font-medium text-navy/40 hover:text-teal transition-colors"
        >
          ← All apps
        </Link>

        <nav className="mt-8 flex flex-1 flex-col gap-1">
          {navItems.map((item) => {
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
        {navItems.map((item) => {
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
