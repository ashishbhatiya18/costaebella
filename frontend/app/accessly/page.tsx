"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/admin/auth-context";
import { usePageTitle } from "@/lib/admin/use-page-title";
import { useAppRoleGuard } from "@/lib/admin/use-app-role-guard";
import { api, User } from "@/lib/accessly/api";
import { UsersTab } from "@/components/accessly/users-tab";

export default function AccesslyPage() {
  usePageTitle("Accessly");
  useAppRoleGuard("accessly");
  const { email, logout } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const data = await api.listUsers();
      setUsers(data ?? []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="mx-auto max-w-3xl px-5 py-16">
      <header className="mb-12 flex items-center justify-between">
        <div>
          <p className="uppercase tracking-[0.3em] text-teal text-xs mb-3">Admin</p>
          <h1 className="font-display text-4xl text-navy">Accessly</h1>
          <Link href="/admin" className="mt-2 inline-block text-xs font-medium text-navy/40 hover:text-teal transition-colors">
            ← All apps
          </Link>
        </div>
        <div className="text-right">
          {email && <p className="mb-2 text-xs text-navy/50">Signed in as {email}</p>}
          <button onClick={logout} className="text-sm font-medium text-teal hover:underline">
            Log out
          </button>
        </div>
      </header>

      <UsersTab users={users} loading={loading} onChange={load} />
    </div>
  );
}
