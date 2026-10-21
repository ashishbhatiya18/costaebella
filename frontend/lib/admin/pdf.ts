import jsPDF from "jspdf";

// Shared building blocks for the admin's client-side PDF reports (Shiftly
// payout, Ledgerly P&L), so every report formats money/dates the same way
// and carries the same header.

// jsPDF's built-in fonts (helvetica/times/courier) don't include the ₹
// glyph, so toLocaleString(..., { style: "currency", currency: "INR" })
// renders as a garbled/missing character in the PDF. Use a plain "Rs."
// prefix instead, which every standard PDF font supports.
export function formatMoney(cents: number) {
  return `Rs. ${(cents / 100).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
}

// The restaurant operates in India, so every timestamp in this report is
// shown in IST regardless of the viewer's own browser/OS timezone — shift
// the UTC instant by the fixed +5:30 offset (India has no DST) and read it
// back with the UTC accessors, which sidesteps the browser's local timezone
// entirely.
const IST_OFFSET_MS = (5 * 60 + 30) * 60 * 1000;
export function toIST(d: Date) {
  return new Date(d.getTime() + IST_OFFSET_MS);
}

// Avoids toLocaleTimeString: some locales inject a narrow no-break space
// before AM/PM, which standard PDF fonts render as a garbled/missing glyph
// — build the 12-hour label manually with a plain ASCII space instead.
export function formatTime(iso: string) {
  const ist = toIST(new Date(iso));
  const hours24 = ist.getUTCHours();
  const period = hours24 >= 12 ? "PM" : "AM";
  const hours12 = hours24 % 12 === 0 ? 12 : hours24 % 12;
  const minutes = String(ist.getUTCMinutes()).padStart(2, "0");
  return `${hours12}:${minutes} ${period}`;
}

export function istDateString(d: Date) {
  const ist = toIST(d);
  const year = ist.getUTCFullYear();
  const month = String(ist.getUTCMonth() + 1).padStart(2, "0");
  const day = String(ist.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

// month is a plain "YYYY-MM" string (no timestamp/timezone involved) — parse
// it directly rather than through a Date object, which would risk shifting
// across a month boundary if interpreted in the wrong timezone.
export function formatMonthLabel(month: string) {
  const [year, monthNum] = month.split("-").map(Number);
  if (!year || !monthNum) return month;
  return `${MONTH_NAMES[monthNum - 1]} ${year}`;
}

// "YYYY-MM-DD" as "02 Oct 2026" — the same Indian day-month-year format
// the admin UI uses (lib/admin/format.ts formatDate), built by hand so the
// output is plain ASCII the PDF's standard fonts can render.
export function formatDate(ymd: string) {
  const [year, monthNum, day] = ymd.split("-").map(Number);
  if (!year || !monthNum || !day) return ymd;
  return `${String(day).padStart(2, "0")} ${MONTH_NAMES[monthNum - 1].slice(0, 3)} ${year}`;
}

export function formatGeneratedAt(d: Date) {
  return `${formatDate(istDateString(d))}, ${formatTime(d.toISOString())} IST`;
}

// jspdf-autotable stores the last table's position on the doc but doesn't
// add it to jsPDF's type.
export function lastAutoTableY(doc: jsPDF, fallback: number): number {
  return (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? fallback;
}

// Mirrors frontend/data/business.yaml's name field — this file runs
// entirely client-side (no YAML access at build time), so it's hardcoded
// here the same way the admin login page already does.
export const RESTAURANT_NAME = "Costa E Bella";

// Restaurant name rule, report title, and the month / generated-at lines
// every report starts with. Returns the y position below it.
export function drawReportHeader(doc: jsPDF, title: string, subtitle: string): number {
  doc.setFont("helvetica", "normal");
  doc.setFontSize(13);
  doc.setTextColor(18, 52, 76);
  doc.setFont("helvetica", "bold");
  doc.text(RESTAURANT_NAME, 14, 16);
  doc.setDrawColor(18, 52, 76);
  doc.setLineWidth(0.4);
  doc.line(14, 19, 196, 19);
  doc.setTextColor(0);

  doc.setFontSize(16);
  doc.setFont("helvetica", "normal");
  doc.text(title, 14, 27);
  doc.setFontSize(10);
  doc.text(subtitle, 14, 35);
  doc.setFontSize(8);
  doc.setTextColor(120);
  doc.text(`Generated: ${formatGeneratedAt(new Date())}`, 14, 40);
  doc.setTextColor(0);
  return 46;
}
