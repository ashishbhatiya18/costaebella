import { Employee } from "@/lib/shiftly/api";

const DEFAULT_START = "09:00";
const DEFAULT_END = "17:00";

export type SessionTimes = { login_time: string; logout_time: string | null };

/**
 * Returns one session (login/logout ISO pair) per shift interval configured
 * for the given date's weekday — correctly covering split shifts, instead
 * of collapsing them into a single min-start/max-end guess. Falls back to a
 * single 09:00-17:00 session when no interval applies.
 */
export function getShiftSessionsForDate(employee: Employee, dateStr: string): SessionTimes[] {
  const date = new Date(dateStr + "T00:00:00");
  const weekday = date.getDay();

  const applicable = employee.shift_intervals.filter(
    (si) => si.day_of_week === null || si.day_of_week === weekday,
  );

  const intervals =
    applicable.length > 0
      ? applicable.map((si) => ({ start: si.start_time, end: si.end_time }))
      : [{ start: DEFAULT_START, end: DEFAULT_END }];

  return intervals.map(({ start, end }) => {
    const [startH, startM] = start.split(":").map(Number);
    const [endH, endM] = end.split(":").map(Number);

    const login = new Date(date);
    login.setHours(startH, startM, 0, 0);

    const logout = new Date(date);
    logout.setHours(endH, endM, 0, 0);
    if (logout <= login) {
      logout.setDate(logout.getDate() + 1);
    }

    return { login_time: login.toISOString(), logout_time: logout.toISOString() };
  });
}
