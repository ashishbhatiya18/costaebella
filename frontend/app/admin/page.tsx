"use client";

import Link from "next/link";
import { useAuth } from "@/lib/admin/auth-context";
import { usePageTitle } from "@/lib/admin/use-page-title";
import { useLedgerlyAccess } from "@/lib/ledgerly/use-access";
import { AppKey, canAccessApp } from "@/lib/admin/app-access";

type LauncherApp = {
  name: string;
  href: string;
  description: string;
  app: AppKey | "menuly" | "intelly"; // Menuly/Intel-ly aren't role-gated — see ledgerlyAccess below.
  gated?: boolean;
};

const APPS: LauncherApp[] = [
  {
    name: "Shiftly",
    href: "/shiftly",
    description: "Restaurant staff attendance and payout tracker.",
    app: "shiftly",
  },
  {
    name: "Pantrly",
    href: "/pantrly",
    description: "Restaurant inventory tracker — stock counts, par-level alerts, and deliveries.",
    app: "pantrly",
  },
  {
    name: "Ledgerly",
    href: "/ledgerly",
    description: "Restaurant income and expenditure tracker — daily sales, expenses, and P&L.",
    app: "ledgerly",
  },
  {
    name: "Menuly",
    href: "/menuly",
    description: "Menu item visibility and dish-level sales analytics.",
    app: "menuly",
    gated: true,
  },
  {
    name: "Intel-ly",
    href: "/intelly",
    description: "Cross-app restaurant health — margins, staffing, and trends.",
    app: "intelly",
    gated: true,
  },
  {
    name: "Accessly",
    href: "/accessly",
    description: "Manage who can sign in to /admin and which apps they can use.",
    app: "accessly",
  },
];

export default function AdminHomePage() {
  usePageTitle("Apps");
  const { email, role, isLoading, logout } = useAuth();
  const ledgerlyAccess = useLedgerlyAccess();
  const apps = APPS.filter((app) => {
    if (app.app === "menuly" || app.app === "intelly") {
      return !app.gated || ledgerlyAccess === "allowed";
    }
    return canAccessApp(role, app.app);
  });

  // Wait for both the stored session and the Ledgerly access probe to
  // settle before rendering tiles — otherwise the grid briefly renders
  // with gated/role-restricted tiles missing, then re-renders once the
  // checks resolve, which looks like apps are randomly disappearing.
  if (isLoading || ledgerlyAccess === "checking") {
    return (
      <div className="mx-auto max-w-3xl px-5 py-16">
        <p className="text-sm text-navy/50">Loading…</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-5 py-16">
      <header className="mb-12 flex items-center justify-between">
        <div>
          <p className="uppercase tracking-[0.3em] text-teal text-xs mb-3">
            Admin
          </p>
          <h1 className="font-display text-4xl text-navy">Apps</h1>
        </div>
        <div className="text-right">
          {email && (
            <p className="mb-2 text-xs text-navy/50">Signed in as {email}</p>
          )}
          <button
            onClick={logout}
            className="text-sm font-medium text-teal hover:underline"
          >
            Log out
          </button>
        </div>
      </header>

      <div className="grid gap-6 sm:grid-cols-2">
        {apps.map((app) => (
          <Link
            key={app.href}
            href={app.href}
            className="block rounded-2xl border border-navy/5 bg-teal/5 p-6 transition-colors hover:bg-teal/10"
          >
            <h3 className="font-display text-lg text-navy mb-2">
              {app.name}
            </h3>
            <p className="text-navy/70 text-sm">{app.description}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
