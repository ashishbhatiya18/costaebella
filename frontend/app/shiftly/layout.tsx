"use client";

import { AdminGuard } from "@/lib/admin/admin-guard";

export default function ShiftlyLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AdminGuard publicPaths={["/shiftly/login"]} loginPath="/admin/login">
      {children}
    </AdminGuard>
  );
}
