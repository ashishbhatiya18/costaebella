// Shared period (day/week/month/quarter) date math for every admin page
// that lets you step back/forward through time.
//
// Boundaries mirror the backend's `rangeBounds` helpers exactly
// (internal/shiftly/payout, internal/ledgerly/pnl, internal/pantrly/stock):
// weeks start on Monday, months are calendar months, quarters are calendar
// quarters (Jan–Mar, Apr–Jun, …). Keep them in sync if the backend changes.
//
// All dates are plain "YYYY-MM-DD" calendar strings. "Today" is India's
// date (IST) via `todayStr()`; date math is done on local-midnight Dates
// built from those strings and read back with local components — never
// `toISOString()`, which converts to UTC and lands on the previous day for
// anything before 05:30 IST (and for every local-midnight Date).

export type PeriodType = "day" | "week" | "month" | "quarter";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function pad(n: number) {
  return String(n).padStart(2, "0");
}

/** Formats a Date as YYYY-MM-DD using its local (not UTC) components. */
export function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Parses YYYY-MM-DD as a local-midnight Date. */
export function parseDateStr(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

// The restaurant operates in India, so "today" is always India's calendar
// date (Asia/Kolkata, UTC+5:30, no DST), whatever timezone the viewer's
// browser/OS is set to. en-CA formats as YYYY-MM-DD.
const IST_DATE = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Kolkata",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/**
 * The day Costa È Bella opened — the earliest date any business record
 * (delivery, expense, …) can carry. Keep in sync with `openingDate` in
 * backend/internal/pantrly/stock/models.go.
 */
export const OPENING_DATE = "2026-08-01";

/** India's (IST) calendar date for an instant, as YYYY-MM-DD. */
export function istDateStr(d: Date): string {
  return IST_DATE.format(d);
}

/** Today's date in India (IST) as YYYY-MM-DD. */
export function todayStr(): string {
  return istDateStr(new Date());
}

/** The IST date `n` days before today, as YYYY-MM-DD. */
export function daysAgoStr(n: number): string {
  const d = parseDateStr(todayStr());
  return toDateStr(new Date(d.getFullYear(), d.getMonth(), d.getDate() - n));
}

function periodStart(type: PeriodType, anchor: Date): Date {
  const y = anchor.getFullYear();
  const m = anchor.getMonth();
  switch (type) {
    case "day":
      return new Date(y, m, anchor.getDate());
    case "week": {
      // Monday-start, same as Go's (Weekday()+6)%7 offset.
      const offset = (anchor.getDay() + 6) % 7;
      return new Date(y, m, anchor.getDate() - offset);
    }
    case "month":
      return new Date(y, m, 1);
    case "quarter":
      return new Date(y, Math.floor(m / 3) * 3, 1);
  }
}

function periodEnd(type: PeriodType, start: Date): Date {
  const y = start.getFullYear();
  const m = start.getMonth();
  switch (type) {
    case "day":
      return start;
    case "week":
      return new Date(y, m, start.getDate() + 6);
    case "month":
      return new Date(y, m + 1, 0);
    case "quarter":
      return new Date(y, m + 3, 0);
  }
}

/** Inclusive [from, to] bounds of the period containing `anchor`. */
export function periodBounds(type: PeriodType, anchor: string): { from: string; to: string } {
  const start = periodStart(type, parseDateStr(anchor));
  return { from: toDateStr(start), to: toDateStr(periodEnd(type, start)) };
}

/**
 * Moves `anchor` by `delta` whole periods and returns the new period's
 * start date. Always steps from the period start, so month/quarter math
 * can't overflow (e.g. 31 Oct − 1 month never lands on "31 Sep" → 1 Oct).
 */
export function shiftAnchor(type: PeriodType, anchor: string, delta: number): string {
  const start = periodStart(type, parseDateStr(anchor));
  const y = start.getFullYear();
  const m = start.getMonth();
  switch (type) {
    case "day":
      return toDateStr(new Date(y, m, start.getDate() + delta));
    case "week":
      return toDateStr(new Date(y, m, start.getDate() + 7 * delta));
    case "month":
      return toDateStr(new Date(y, m + delta, 1));
    case "quarter":
      return toDateStr(new Date(y, m + 3 * delta, 1));
  }
}

/** Human label: "2 Oct 2026", "28 Sep – 4 Oct 2026", "Sep 2026", "Jul–Sep 2026". */
export function periodLabel(type: PeriodType, anchor: string): string {
  const start = periodStart(type, parseDateStr(anchor));
  const end = periodEnd(type, start);
  switch (type) {
    case "day":
      return `${start.getDate()} ${MONTHS[start.getMonth()]} ${start.getFullYear()}`;
    case "week": {
      const sameYear = start.getFullYear() === end.getFullYear();
      const sameMonth = sameYear && start.getMonth() === end.getMonth();
      if (sameMonth) {
        return `${start.getDate()}–${end.getDate()} ${MONTHS[end.getMonth()]} ${end.getFullYear()}`;
      }
      const startStr = `${start.getDate()} ${MONTHS[start.getMonth()]}${sameYear ? "" : ` ${start.getFullYear()}`}`;
      return `${startStr} – ${end.getDate()} ${MONTHS[end.getMonth()]} ${end.getFullYear()}`;
    }
    case "month":
      return `${MONTHS[start.getMonth()]} ${start.getFullYear()}`;
    case "quarter":
      return `${MONTHS[start.getMonth()]}–${MONTHS[end.getMonth()]} ${end.getFullYear()}`;
  }
}

/** True if `anchor` falls in the same period as today. */
export function isCurrentPeriod(type: PeriodType, anchor: string): boolean {
  return periodBounds(type, anchor).from === periodBounds(type, todayStr()).from;
}

/** True if the period containing `anchor` starts after today's period. */
export function isFuturePeriod(type: PeriodType, anchor: string): boolean {
  return periodBounds(type, anchor).from > periodBounds(type, todayStr()).from;
}

/** "Today" / "This week" / "This month" / "This quarter". */
export function currentPeriodLabel(type: PeriodType): string {
  return type === "day" ? "Today" : `This ${type}`;
}

/**
 * Month-to-date-style range for pages with free from/to date inputs: the
 * whole month containing `anchor`, clamped so the current month ends today.
 */
export function monthRange(anchor: string): { from: string; to: string } {
  const { from, to } = periodBounds("month", anchor);
  const today = todayStr();
  return { from, to: to > today ? today : to };
}

/**
 * Label for a free from/to range driven by a month navigator: the month
 * name when the range is exactly what `monthRange` would produce (or the
 * full month), otherwise "Custom range".
 */
export function monthRangeLabel(from: string, to: string): string {
  const snapped = monthRange(from);
  const full = periodBounds("month", from);
  if (from === snapped.from && (to === snapped.to || to === full.to)) {
    return periodLabel("month", from);
  }
  return "Custom range";
}
