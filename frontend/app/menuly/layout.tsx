"use client";

import { AdminGuard } from "@/lib/admin/admin-guard";
import { LedgerlyGate } from "@/components/admin/ledgerly-gate";

export default function MenulyLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AdminGuard publicPaths={[]} loginPath="/admin/login">
      <LedgerlyGate appName="Menuly">{children}</LedgerlyGate>
    </AdminGuard>
  );
}
