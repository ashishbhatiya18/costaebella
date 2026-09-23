"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "./auth-context";
import { AppKey, canAccessApp } from "./app-access";

// Redirects back to the launcher if the signed-in user's role can't use
// this app. AdminGuard has already confirmed there's a session by the time
// this runs; this only adds the narrower per-app role check on top,
// mirroring the server-side accessly.RequireRole gate.
export function useAppRoleGuard(app: AppKey) {
  const { role, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;
    if (!canAccessApp(role, app)) {
      router.replace("/admin");
    }
  }, [isLoading, role, app, router]);
}
