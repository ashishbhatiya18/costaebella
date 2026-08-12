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

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

/**
 * Fetch helper shared by every admin app. Attaches the bearer token,
 * and on 401 clears the session and redirects to the site-level login page.
 */
export async function apiRequest<T>(
  path: string,
  options: RequestInit = {},
  unauthorizedRedirect: string = "/admin/login",
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

  if (!res.ok) {
    const text = await res.text();
    throw new ApiError(res.status, text || res.statusText);
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export const adminApi = {
  googleLogin: (credential: string) =>
    apiRequest<{ token: string; email: string }>("/api/auth/google", {
      method: "POST",
      body: JSON.stringify({ credential }),
    }),
};
