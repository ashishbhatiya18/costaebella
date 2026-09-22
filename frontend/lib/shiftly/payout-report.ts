import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { EmployeePayout } from "@/lib/shiftly/api";

// jsPDF's built-in fonts (helvetica/times/courier) don't include the ₹
// glyph, so toLocaleString(..., { style: "currency", currency: "INR" })
// renders as a garbled/missing character in the PDF. Use a plain "Rs."
// prefix instead, which every standard PDF font supports.
function formatMoney(cents: number) {
  return `Rs. ${(cents / 100).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
}

// The restaurant operates in India, so every timestamp in this report is
// shown in IST regardless of the viewer's own browser/OS timezone — shift
// the UTC instant by the fixed +5:30 offset (India has no DST) and read it
// back with the UTC accessors, which sidesteps the browser's local timezone
// entirely.
const IST_OFFSET_MS = (5 * 60 + 30) * 60 * 1000;
function toIST(d: Date) {
  return new Date(d.getTime() + IST_OFFSET_MS);
}

// Avoids toLocaleTimeString: some locales inject a narrow no-break space
// before AM/PM, which standard PDF fonts render as a garbled/missing glyph
// — build the 12-hour label manually with a plain ASCII space instead.
function formatTime(iso: string) {
  const ist = toIST(new Date(iso));
  const hours24 = ist.getUTCHours();
  const period = hours24 >= 12 ? "PM" : "AM";
  const hours12 = hours24 % 12 === 0 ? 12 : hours24 % 12;
  const minutes = String(ist.getUTCMinutes()).padStart(2, "0");
  return `${hours12}:${minutes} ${period}`;
}

function istDateString(d: Date) {
  const ist = toIST(d);
  const year = ist.getUTCFullYear();
  const month = String(ist.getUTCMonth() + 1).padStart(2, "0");
  const day = String(ist.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function formatWeeklyOffDays(days: number[]) {
  if (days.length === 0) return "None";
  return days.map((d) => DAY_NAMES[d]).join(", ");
}

// month is a plain "YYYY-MM" string (no timestamp/timezone involved) — parse
// it directly rather than through a Date object, which would risk shifting
// across a month boundary if interpreted in the wrong timezone.
function formatMonthLabel(month: string) {
  const [year, monthNum] = month.split("-").map(Number);
  if (!year || !monthNum) return month;
  return `${MONTH_NAMES[monthNum - 1]} ${year}`;
}

function formatGeneratedAt(d: Date) {
  return `${istDateString(d)} ${formatTime(d.toISOString())} IST`;
}

function formatSessions(sessions: { login: string; logout: string | null }[] | undefined) {
  if (!sessions || sessions.length === 0) return "-";
  return sessions
    .map((s) => `${formatTime(s.login)}-${s.logout ? formatTime(s.logout) : "open"}`)
    .join(", ");
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function lastAutoTableY(doc: jsPDF, fallback: number): number {
  return (doc as any).lastAutoTable?.finalY ?? fallback;
}

// Mirrors frontend/data/business.yaml's name field — this file runs
// entirely client-side (no YAML access at build time), so it's hardcoded
// here the same way the admin login page already does.
const RESTAURANT_NAME = "Costa E Bella";

export function buildPayoutReportPdf(employeeName: string, month: string, payout: EmployeePayout) {
  const doc = new jsPDF();
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
  doc.text(`Payout report - ${employeeName}`, 14, 27);
  doc.setFontSize(10);
  doc.text(`Month: ${formatMonthLabel(month)}`, 14, 35);
  doc.setFontSize(8);
  doc.setTextColor(120);
  doc.text(`Generated: ${formatGeneratedAt(new Date())}`, 14, 40);
  doc.setTextColor(0);

  // Don't count/list days beyond today when the report is pulled mid-month
  // — the backend still returns a zeroed-out row for every day through
  // month end, but those future dates can't have a real entry yet. "Today"
  // is IST's today, not the viewer's local calendar day.
  const today = istDateString(new Date());
  const breakdownSoFar = payout.daily_breakdown.filter((d) => d.date <= today);
  const presentDays = breakdownSoFar.filter((d) => d.category === "present").length;
  const absentDays = breakdownSoFar.filter((d) => d.category === "absent").length;
  const expectedHours = payout.working_days_in_month * payout.eligible_hours_per_day;

  autoTable(doc, {
    startY: 46,
    head: [["Hourly rate", "Weekly off", "Eligible hrs/day", "Working days", "Gross pay", "Advance", "Net payout"]],
    body: [[
      `${formatMoney(payout.hourly_rate_cents)}/hr`,
      formatWeeklyOffDays(payout.weekly_off_days),
      String(payout.eligible_hours_per_day),
      String(payout.working_days_in_month),
      formatMoney(payout.gross_pay_cents),
      formatMoney(payout.advance_cents),
      formatMoney(payout.net_payout_cents),
    ]],
    styles: { fontSize: 8, font: "helvetica", cellPadding: 3, halign: "center" },
    headStyles: { fillColor: [18, 52, 76], textColor: 255, fontStyle: "bold" },
    bodyStyles: { fontStyle: "bold", textColor: [18, 52, 76] },
    margin: { left: 14, right: 14 },
    tableWidth: 182,
  });

  const attendanceY = lastAutoTableY(doc, 40) + 4;
  autoTable(doc, {
    startY: attendanceY,
    head: [["Present days", "Absent days", "Expected hours/month", "Hours worked"]],
    body: [[
      String(presentDays),
      String(absentDays),
      expectedHours.toFixed(0),
      String(payout.total_hours_worked),
    ]],
    styles: { fontSize: 8, font: "helvetica", cellPadding: 3, halign: "center" },
    headStyles: { fillColor: [90, 100, 110], textColor: 255, fontStyle: "bold" },
    bodyStyles: { fontStyle: "bold", textColor: [18, 52, 76] },
    margin: { left: 14, right: 14 },
    tableWidth: 182,
  });

  let formulaY = lastAutoTableY(doc, 40) + 8;
  doc.setFontSize(9);
  doc.setFont("helvetica", "italic");

  const workingDaysText = `Working days = total days - weekly off days occurring this month = ${payout.total_days} - ${payout.weekly_off_count} (${formatWeeklyOffDays(payout.weekly_off_days)}) = ${payout.working_days_in_month}`;
  const workingDaysLines = doc.splitTextToSize(workingDaysText, 182);
  doc.text(workingDaysLines, 14, formulaY);
  formulaY += workingDaysLines.length * 4.5 + 4;

  const rateText = `Hourly rate = monthly pay / (working days x eligible hrs/day) = ${formatMoney(payout.monthly_pay_cents)} / (${payout.working_days_in_month} x ${payout.eligible_hours_per_day}) = ${formatMoney(payout.hourly_rate_cents)}/hr`;
  const rateLines = doc.splitTextToSize(rateText, 182);
  doc.text(rateLines, 14, formulaY);
  doc.setFont("helvetica", "normal");

  const dailyStartY = formulaY + rateLines.length * 4.5 + 6;
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text("Daily breakdown", 14, dailyStartY - 4);
  doc.setFont("helvetica", "normal");

  // Light row-tint per category so present/absent/leave/weekly-off days are
  // visually distinguishable at a glance.
  const ROW_COLORS: Record<string, [number, number, number]> = {
    present: [222, 245, 234],
    absent: [252, 224, 224],
    leave: [255, 243, 205],
    weekly_off: [232, 232, 236],
  };

  autoTable(doc, {
    startY: dailyStartY,
    head: [["Date", "Check-in / out", "Category", "Raw hrs", "Rounded hrs", "Pay"]],
    body: breakdownSoFar.map((d) => [
      d.date,
      formatSessions(d.sessions),
      d.category,
      d.raw_hours.toFixed(2),
      d.rounded_hours.toFixed(0),
      // A weekly-off day's pay is already folded into the higher hourly
      // rate paid on working days, not deducted — show "Paid off" rather
      // than "Rs. 0.00" so it doesn't read as a pay cut.
      d.category === "weekly_off" ? "Paid off" : formatMoney(d.day_pay_cents),
    ]),
    styles: { fontSize: 8, font: "helvetica", cellPadding: 2, overflow: "linebreak" },
    headStyles: { fillColor: [18, 52, 76], textColor: 255, fontStyle: "bold" },
    columnStyles: {
      0: { cellWidth: 22 },
      1: { cellWidth: 73 },
      2: { cellWidth: 22 },
      3: { cellWidth: 18, halign: "right" },
      4: { cellWidth: 22, halign: "right" },
      5: { cellWidth: 25, halign: "right" },
    },
    margin: { left: 14, right: 14 },
    tableWidth: 182,
    didParseCell: (data) => {
      if (data.section !== "body") return;
      const category = breakdownSoFar[data.row.index]?.category;
      const color = category ? ROW_COLORS[category] : undefined;
      if (color) data.cell.styles.fillColor = color;
    },
  });

  doc.save(`${employeeName.replace(/\s+/g, "_")}_payout_${month}.pdf`);
}
