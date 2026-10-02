// Shared money formatting for admin apps that store amounts as integer
// paisa (cents) — e.g. Ledgerly, Pantrly's purchase cost. All costs in
// this codebase are INR.
export function formatINR(cents: number) {
  return (cents / 100).toLocaleString("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  });
}

// Dates and times are always shown the Indian way (en-IN: day before month)
// and in India's timezone (IST), regardless of the viewer's browser locale
// or timezone — the restaurant, its staff and its books are all in India.
const IST_TIME_ZONE = "Asia/Kolkata";

const DATE_FMT = new Intl.DateTimeFormat("en-IN", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});
const TIME_FMT = new Intl.DateTimeFormat("en-IN", {
  hour: "2-digit",
  minute: "2-digit",
  hour12: true,
  timeZone: IST_TIME_ZONE,
});
const DATE_TIME_FMT = new Intl.DateTimeFormat("en-IN", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: true,
  timeZone: IST_TIME_ZONE,
});

/**
 * Formats a calendar date ("YYYY-MM-DD", as every API date field is) as
 * e.g. "02 Oct 2026". Parsed as a UTC date and formatted in UTC, so no
 * timezone can shift it onto a neighbouring day.
 */
export function formatDate(ymd: string | null | undefined): string {
  if (!ymd) return "—";
  const [y, m, d] = ymd.slice(0, 10).split("-").map(Number);
  if (!y || !m || !d) return ymd;
  return DATE_FMT.format(new Date(Date.UTC(y, m - 1, d)));
}

/** "02 Oct 2026 – 08 Oct 2026" for an inclusive from/to pair. */
export function formatDateRange(from: string, to: string): string {
  return `${formatDate(from)} – ${formatDate(to)}`;
}

/** An instant (ISO timestamp) as IST wall-clock time, e.g. "09:30 am". */
export function formatTime(iso: string): string {
  return TIME_FMT.format(new Date(iso));
}

/** An instant (ISO timestamp) as IST date + time, e.g. "02 Oct 2026, 09:30 am". */
export function formatDateTime(iso: string): string {
  return DATE_TIME_FMT.format(new Date(iso));
}

const IST_OFFSET_MS = (5 * 60 + 30) * 60 * 1000;

/**
 * An instant as the "YYYY-MM-DDTHH:mm" value of an <input type="datetime-local">,
 * in IST wall-clock time (India has no DST, so a fixed +5:30 shift is exact).
 */
export function toISTDateTimeInput(iso: string): string {
  return new Date(new Date(iso).getTime() + IST_OFFSET_MS).toISOString().slice(0, 16);
}

/** Inverse of toISTDateTimeInput: an IST "YYYY-MM-DDTHH:mm" value as an ISO instant. */
export function fromISTDateTimeInput(value: string): string {
  return new Date(`${value}:00+05:30`).toISOString();
}

/** An IST date ("YYYY-MM-DD") and wall-clock time ("HH:mm") as an ISO instant. */
export function istInstant(ymd: string, hhmm: string): string {
  return new Date(`${ymd}T${hhmm}:00+05:30`).toISOString();
}
