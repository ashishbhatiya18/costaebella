"use client";

import { AdminGuard } from "@/lib/admin/admin-guard";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AdminGuard publicPaths={["/admin/login"]} loginPath="/admin/login">
      {children}
    </AdminGuard>
  );
}
