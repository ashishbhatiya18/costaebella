"use client";

import { AdminGuard } from "@/lib/admin/admin-guard";

export default function LedgerlyLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AdminGuard publicPaths={[]} loginPath="/admin/login">
      {children}
    </AdminGuard>
  );
}
