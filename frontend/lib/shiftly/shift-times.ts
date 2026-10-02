import { Employee } from "@/lib/shiftly/api";
import { istInstant } from "@/lib/admin/format";

const DEFAULT_START = "09:00";

export type SessionTimes = { login_time: string; logout_time: string | null };

/**
 * Returns a single default session (login/logout ISO pair) for the given
 * date, starting at 09:00 IST and running for the employee's configured
 * eligible_hours_per_day — used to prefill "mark as present" overrides.
 */
export function getShiftSessionsForDate(employee: Employee, dateStr: string): SessionTimes[] {
  const login = new Date(istInstant(dateStr, DEFAULT_START));

  const logout = new Date(login);
  logout.setTime(logout.getTime() + employee.eligible_hours_per_day * 60 * 60 * 1000);

  return [{ login_time: login.toISOString(), logout_time: logout.toISOString() }];
}
