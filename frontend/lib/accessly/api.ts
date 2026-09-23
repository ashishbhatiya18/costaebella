// Accessly-specific endpoints. Auth (Google Sign-In), token storage, and
// the underlying fetch helper live in lib/admin/api.ts and are shared with
// the rest of /admin.
import { apiRequest } from "@/lib/admin/api";

export { ApiError } from "@/lib/admin/api";

function request<T>(
  path: string,
  options: RequestInit = {},
  redirectOnForbidden: boolean = true,
): Promise<T> {
  return apiRequest<T>(path, options, "/admin/login", redirectOnForbidden);
}

export type Role = "owner" | "operations" | "accounting";

export const ROLE_OPTIONS: { label: string; value: Role }[] = [
  { label: "Owner", value: "owner" },
  { label: "Operations", value: "operations" },
  { label: "Accounting", value: "accounting" },
];

export const ROLE_LABELS: Record<Role, string> = {
  owner: "Owner",
  operations: "Operations",
  accounting: "Accounting",
};

export type User = {
  id: string;
  email: string;
  role: Role | null;
  created_at: string;
};

export const api = {
  // A 403 here is an expected "not this role" outcome (used to hide the
  // Accessly tile/nav for non-owners), not a session problem — don't let
  // it redirect.
  checkAccess: () => request<void>("/api/accessly/access", {}, false),

  listUsers: () => request<User[]>("/api/accessly/users"),

  createUser: (body: { email: string; role: Role }) =>
    request<User>("/api/accessly/users", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  updateUserRole: (id: string, role: Role) =>
    request<User>(`/api/accessly/users/${id}/role`, {
      method: "PUT",
      body: JSON.stringify({ role }),
    }),

  deleteUser: (id: string) =>
    request<void>(`/api/accessly/users/${id}`, { method: "DELETE" }),
};
