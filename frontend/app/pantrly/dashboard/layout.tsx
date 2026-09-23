"use client";

// Auth is gated once, site-wide, by app/admin/layout.tsx (AuthProvider +
// redirect-to-/admin/login guard). This layout only needs the current
// session's email/logout for its own chrome — no separate token check here.

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/admin/auth-context";
import { clsx } from "@/lib/admin/clsx";
import { useAppRoleGuard } from "@/lib/admin/use-app-role-guard";

function ListIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path d="M8 6h12M8 12h12M8 18h12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <circle cx="4" cy="6" r="1.5" fill="currentColor" />
      <circle cx="4" cy="12" r="1.5" fill="currentColor" />
      <circle cx="4" cy="18" r="1.5" fill="currentColor" />
    </svg>
  );
}

function TruckIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="18" height="18" viewBox="0 0 24 24" fill="none">
      <rect x="2.5" y="7" width="12" height="9" rx="1.5" stroke="currentColor" strokeWidth="2" />
      <path d="M14.5 10h3.5l3 3v3h-6.5z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      <circle cx="7" cy="18" r="1.8" stroke="currentColor" strokeWidth="2" />
      <circle cx="17" cy="18" r="1.8" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}

function BoxIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path d="M4 8l8-4 8 4-8 4-8-4z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      <path d="M4 8v8l8 4 8-4V8" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      <path d="M12 12v8" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}

const NAV_ITEMS = [
  { href: "/pantrly/dashboard/items", label: "Items", shortLabel: "Items", Icon: ListIcon },
  { href: "/pantrly/dashboard/suppliers", label: "Suppliers", shortLabel: "Suppliers", Icon: TruckIcon },
  { href: "/pantrly/dashboard/deliveries", label: "Past Deliveries", shortLabel: "Deliveries", Icon: BoxIcon },
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { email, isLoading } = useAuth();
  useAppRoleGuard("pantrly");

  if (isLoading) return null;

  return (
    <div className="flex min-h-screen w-full flex-col bg-cream text-navy lg:flex-row">
      {/* Mobile top bar */}
      <header className="flex items-center justify-between border-b border-navy/10 bg-white px-4 py-3 lg:hidden">
        <Link href="/admin" className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal font-bold text-sm text-white">
            P
          </div>
          <span className="font-display text-lg tracking-tight text-navy">Pantrly</span>
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
            P
          </div>
          <span className="font-display text-lg tracking-tight text-navy group-hover:text-teal transition-colors">
            Pantrly
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
