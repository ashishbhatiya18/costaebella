"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { AuthProvider, useAuth } from "@/lib/admin/auth-context";

// Routes under /admin that don't require a session (just the login page).
const PUBLIC_ADMIN_PATHS = ["/admin/login", "/admin/shiftly/login"];

function AdminGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { isLoading, email } = useAuth();
  const isPublic = PUBLIC_ADMIN_PATHS.includes(pathname);

  useEffect(() => {
    if (isLoading) return;
    if (!email && !isPublic) {
      router.replace("/admin/login");
    }
  }, [isLoading, email, isPublic, router]);

  if (!isPublic && (isLoading || !email)) return null;

  return <>{children}</>;
}

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthProvider>
      <AdminGuard>{children}</AdminGuard>
    </AuthProvider>
  );
}
