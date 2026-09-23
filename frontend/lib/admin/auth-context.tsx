"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from "react";
import { useRouter } from "next/navigation";
import {
  adminApi,
  getToken,
  setToken,
  clearToken,
  getStoredEmail,
  setStoredEmail,
  clearStoredEmail,
  getStoredRole,
  setStoredRole,
  clearStoredRole,
} from "./api";

type AuthContextValue = {
  email: string | null;
  role: string;
  isLoading: boolean;
  loginWithGoogle: (credential: string, redirectTo?: string) => Promise<void>;
  logout: () => void;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

/**
 * Site-wide admin session provider. Mounted once in app/admin/layout.tsx so
 * every app under /admin (shiftly today, more later) shares one Google
 * Sign-In session and token store (see lib/admin/api.ts).
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [email, setEmail] = useState<string | null>(null);
  const [role, setRole] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const token = getToken();
    const storedEmail = getStoredEmail();
    if (token && storedEmail) {
      setEmail(storedEmail);
      setRole(getStoredRole());
    }
    setIsLoading(false);
  }, []);

  const loginWithGoogle = useCallback(
    async (credential: string, redirectTo: string = "/admin") => {
      const res = await adminApi.googleLogin(credential);
      setToken(res.token);
      setStoredEmail(res.email);
      setStoredRole(res.role);
      setEmail(res.email);
      setRole(res.role);
      router.push(redirectTo);
    },
    [router],
  );

  const logout = useCallback(() => {
    clearToken();
    clearStoredEmail();
    clearStoredRole();
    setEmail(null);
    setRole("");
    router.push("/admin/login");
  }, [router]);

  return (
    <AuthContext.Provider value={{ email, role, isLoading, loginWithGoogle, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
