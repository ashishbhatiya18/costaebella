"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { AuthProvider, useAuth } from "@/lib/admin/auth-context";

function Guard({
  children,
  publicPaths,
  loginPath,
}: {
  children: React.ReactNode;
  publicPaths: string[];
  loginPath: string;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { isLoading, email } = useAuth();
  const isPublic = publicPaths.includes(pathname);

  useEffect(() => {
    if (isLoading) return;
    if (!email && !isPublic) {
      router.replace(loginPath);
    }
  }, [isLoading, email, isPublic, router, loginPath]);

  if (!isPublic && (isLoading || !email)) return null;

  return <>{children}</>;
}

export function AdminGuard({
  children,
  publicPaths,
  loginPath = "/admin/login",
}: {
  children: React.ReactNode;
  publicPaths: string[];
  loginPath?: string;
}) {
  return (
    <AuthProvider>
      <Guard publicPaths={publicPaths} loginPath={loginPath}>
        {children}
      </Guard>
    </AuthProvider>
  );
}
