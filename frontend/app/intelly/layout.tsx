"use client";

import { AdminGuard } from "@/lib/admin/admin-guard";
import { LedgerlyGate } from "@/components/admin/ledgerly-gate";

export default function IntellyLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AdminGuard publicPaths={[]} loginPath="/admin/login">
      <LedgerlyGate appName="Intel-ly">{children}</LedgerlyGate>
    </AdminGuard>
  );
}
