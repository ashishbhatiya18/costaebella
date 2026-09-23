// Which Accessly roles can use which app. Mirrors the accessly.RequireRole
// groups wired into backend/cmd/api/main.go — keep both in sync if this
// matrix changes. Real enforcement is server-side either way; this is only
// used to hide launcher tiles and redirect out of apps a role can't use.
export type AppKey = "shiftly" | "pantrly" | "ledgerly" | "accessly";

const APP_ROLES: Record<AppKey, string[]> = {
  shiftly: ["owner", "operations"],
  pantrly: ["owner", "operations"],
  ledgerly: ["owner", "accounting"],
  accessly: ["owner"],
};

export function canAccessApp(role: string, app: AppKey): boolean {
  return APP_ROLES[app].includes(role);
}
