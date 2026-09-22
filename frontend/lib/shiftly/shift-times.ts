import { Employee } from "@/lib/shiftly/api";

const DEFAULT_START = "09:00";

export type SessionTimes = { login_time: string; logout_time: string | null };

/**
 * Returns a single default session (login/logout ISO pair) for the given
 * date, starting at 09:00 and running for the employee's configured
 * eligible_hours_per_day — used to prefill "mark as present" overrides.
 */
export function getShiftSessionsForDate(employee: Employee, dateStr: string): SessionTimes[] {
  const date = new Date(dateStr + "T00:00:00");
  const [startH, startM] = DEFAULT_START.split(":").map(Number);

  const login = new Date(date);
  login.setHours(startH, startM, 0, 0);

  const logout = new Date(login);
  logout.setTime(logout.getTime() + employee.eligible_hours_per_day * 60 * 60 * 1000);

  return [{ login_time: login.toISOString(), logout_time: logout.toISOString() }];
}
