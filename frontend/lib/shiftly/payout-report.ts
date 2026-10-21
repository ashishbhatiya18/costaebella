import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { EmployeePayout } from "@/lib/shiftly/api";
import {
  drawReportHeader,
  formatDate,
  formatMoney,
  formatMonthLabel,
  formatTime,
  istDateString,
  lastAutoTableY,
} from "@/lib/admin/pdf";

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function formatWeeklyOffDays(days: number[]) {
  if (days.length === 0) return "None";
  return days.map((d) => DAY_NAMES[d]).join(", ");
}

function formatSessions(sessions: { login: string; logout: string | null }[] | undefined) {
  if (!sessions || sessions.length === 0) return "-";
  return sessions
    .map((s) => `${formatTime(s.login)}-${s.logout ? formatTime(s.logout) : "open"}`)
    .join(", ");
}

// Signed so overtime and undertime read apart at a glance: "+2", "-1".
function formatOvertime(hours: number) {
  if (!hours) return "-";
  return hours > 0 ? `+${hours}` : String(hours);
}

export function buildPayoutReportPdf(employeeName: string, month: string, payout: EmployeePayout) {
  const doc = new jsPDF();
  drawReportHeader(doc, `Payout report - ${employeeName}`, `Month: ${formatMonthLabel(month)}`);

  // Don't count/list days beyond today when the report is pulled mid-month
  // — the backend still returns a zeroed-out row for every day through
  // month end, but those future dates can't have a real entry yet. "Today"
  // is IST's today, not the viewer's local calendar day.
  const today = istDateString(new Date());
  const breakdownSoFar = payout.daily_breakdown.filter((d) => d.date <= today);
  const presentDays = breakdownSoFar.filter((d) => d.category === "present").length;
  // Leave and absent are the same thing for payout purposes (both unpaid,
  // non-weekly-off days), so count them together.
  const absentDays = breakdownSoFar.filter((d) => d.category === "absent" || d.category === "leave").length;
  const expectedHours = payout.working_days_in_month * payout.eligible_hours_per_day;

  autoTable(doc, {
    startY: 46,
    head: [["Hourly rate", "Weekly off", "Eligible hrs/day", "Weekly off pay", "Gross pay", "Advance", "Net payout"]],
    body: [[
      `${formatMoney(payout.hourly_rate_cents)}/hr`,
      formatWeeklyOffDays(payout.weekly_off_days),
      String(payout.eligible_hours_per_day),
      formatMoney(payout.paid_off_pay_cents),
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
    head: [["Present days", "Absent days", "Expected hours/month", "Hours worked", "Weekly off hrs paid"]],
    body: [[
      String(presentDays),
      String(absentDays),
      expectedHours.toFixed(0),
      String(payout.total_hours_worked),
      String(payout.paid_off_hours),
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

  const rateText = `Hourly rate = monthly pay / (${payout.rate_basis_days} days x eligible hrs/day) = ${formatMoney(payout.monthly_pay_cents)} / (${payout.rate_basis_days} x ${payout.eligible_hours_per_day}) = ${formatMoney(payout.hourly_rate_cents)}/hr`;
  const rateTextLines = doc.splitTextToSize(rateText, 182);
  doc.text(rateTextLines, 14, formulaY);
  formulaY += rateTextLines.length * 4.5 + 4;

  const offText = `Weekly off (${formatWeeklyOffDays(payout.weekly_off_days)}) is paid as ${payout.eligible_hours_per_day} eligible hrs/day. A weekly off that is worked counts as a swapped day: only hours worked are paid.`;
  const offLines = doc.splitTextToSize(offText, 182);
  doc.text(offLines, 14, formulaY);
  doc.setFont("helvetica", "normal");

  const dailyStartY = formulaY + offLines.length * 4.5 + 6;
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
    head: [["Date", "Check-in / out", "Category", "Raw hrs", "Rounded hrs", "OT / UT hrs", "Pay"]],
    body: breakdownSoFar.map((d) => [
      formatDate(d.date),
      formatSessions(d.sessions),
      d.category,
      // An unworked weekly off is paid as eligible hrs/day, so show those
      // hours rather than 0 (paid_off_hours is 0 on every other day).
      (d.raw_hours + d.paid_off_hours).toFixed(2),
      (d.rounded_hours + d.paid_off_hours).toFixed(0),
      formatOvertime(d.overtime_hours),
      formatMoney(d.day_pay_cents),
    ]),
    styles: { fontSize: 8, font: "helvetica", cellPadding: 2, overflow: "linebreak" },
    headStyles: { fillColor: [18, 52, 76], textColor: 255, fontStyle: "bold" },
    columnStyles: {
      0: { cellWidth: 22 },
      1: { cellWidth: 58 },
      2: { cellWidth: 20 },
      3: { cellWidth: 16, halign: "right" },
      4: { cellWidth: 20, halign: "right" },
      5: { cellWidth: 20, halign: "right" },
      6: { cellWidth: 26, halign: "right" },
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
