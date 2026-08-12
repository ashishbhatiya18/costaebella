"use client";

import Link from "next/link";
import { useAuth } from "@/lib/admin/auth-context";
import { usePageTitle } from "@/lib/admin/use-page-title";

type LauncherApp = {
  name: string;
  href: string;
  description: string;
};

const APPS: LauncherApp[] = [
  {
    name: "Shiftly",
    href: "/admin/shiftly",
    description: "Restaurant staff attendance and payout tracker.",
  },
];

export default function AdminHomePage() {
  usePageTitle("Apps");
  const { email, logout } = useAuth();

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
        {APPS.map((app) => (
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
