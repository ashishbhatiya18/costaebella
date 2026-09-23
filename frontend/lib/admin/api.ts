// Shared, app-agnostic client for the costaebella-backend admin API
// (Google Sign-In auth + token storage + fetch helper). Individual admin
// apps (e.g. lib/shiftly/api.ts) build their own endpoint wrappers on top
// of `apiRequest` / `apiRequestWithBase` rather than duplicating this.

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8080";
const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH || "";

// Key names are kept from the original shiftly-only implementation so
// existing sessions (and any already-issued tokens) keep working now that
// this storage is shared across all of /admin.
const TOKEN_KEY = "attendance_app_token";
const EMAIL_KEY = "attendance_app_email";
const ROLE_KEY = "attendance_app_role";

export const AUTH_CHANGE_EVENT = "admin-auth-change";

function notifyAuthChange() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(AUTH_CHANGE_EVENT));
  }
}

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token);
  notifyAuthChange();
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
  notifyAuthChange();
}

export function getStoredEmail(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(EMAIL_KEY);
}

export function setStoredEmail(email: string) {
  localStorage.setItem(EMAIL_KEY, email);
}

export function clearStoredEmail() {
  localStorage.removeItem(EMAIL_KEY);
}

// Accessly role (owner/operations/accounting/""), set at login alongside
// email — see auth.Claims.Role in the backend for why this is stored
// rather than fetched, and its "changes take effect on next login"
// trade-off.
export function getStoredRole(): string {
  if (typeof window === "undefined") return "";
  return localStorage.getItem(ROLE_KEY) ?? "";
}

export function setStoredRole(role: string) {
  localStorage.setItem(ROLE_KEY, role);
}

export function clearStoredRole() {
  localStorage.removeItem(ROLE_KEY);
}

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

/**
 * Fetch helper shared by every admin app. Attaches the bearer token; on 401
 * (missing/invalid/expired token) clears the session and redirects to the
 * site-level login page; on 403 (a valid session that's simply not
 * permitted for this route — an app/role gate, not a bad token) redirects
 * to the launcher instead, since the user is still logged in.
 *
 * Pass `redirectOnForbidden: false` for calls that intentionally probe a
 * 403 as a normal outcome (e.g. useLedgerlyAccess/useAccesslyAccess hiding
 * a nav tab for a role that lacks access) — those must not bounce the user
 * anywhere, they just want the status to inspect.
 */
export async function apiRequest<T>(
  path: string,
  options: RequestInit = {},
  unauthorizedRedirect: string = "/admin/login",
  redirectOnForbidden: boolean = true,
): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE_URL}${path}`, { ...options, headers });

  if (res.status === 401) {
    clearToken();
    clearStoredEmail();
    if (typeof window !== "undefined") {
      window.location.href = `${BASE_PATH}${unauthorizedRedirect}`;
    }
    throw new ApiError(401, "Unauthorized");
  }

  if (res.status === 403 && redirectOnForbidden) {
    if (typeof window !== "undefined") {
      window.location.href = `${BASE_PATH}/admin`;
    }
    throw new ApiError(403, "Forbidden");
  }

  if (!res.ok) {
    const text = await res.text();
    throw new ApiError(res.status, text || res.statusText);
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export const adminApi = {
  googleLogin: (credential: string) =>
    apiRequest<{ token: string; email: string; role: string }>("/api/auth/google", {
      method: "POST",
      body: JSON.stringify({ credential }),
    }),
};
