import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { Category, PnlSummary } from "@/lib/ledgerly/api";
import { CATEGORY_LABELS } from "@/lib/ledgerly/categories";
import { Giveaways } from "@/lib/ledgerly/giveaways";
import {
  drawReportHeader,
  formatDate,
  formatMoney as formatMoneyExact,
  formatMonthLabel,
  istDateString,
  lastAutoTableY,
} from "@/lib/admin/pdf";

const NAVY: [number, number, number] = [18, 52, 76];
const GREY: [number, number, number] = [90, 100, 110];
const TOTAL_ROW: [number, number, number] = [236, 240, 244];

// Whole rupees — paisa only add noise to a monthly P&L.
function formatMoney(cents: number) {
  return formatMoneyExact(Math.round(cents / 100) * 100);
}

// Share of income, or "-" when there was no income to compare against.
function pctOfIncome(cents: number, incomeCents: number) {
  return incomeCents > 0 ? `${((cents / incomeCents) * 100).toFixed(1)}%` : "-";
}

// Bold, tinted last row — every breakdown table here ends in its total.
function totalRowStyle(rowCount: number) {
  return (data: { section: string; row: { index: number }; cell: { styles: { fontStyle: string; fillColor: unknown } } }) => {
    if (data.section === "body" && data.row.index === rowCount - 1) {
      data.cell.styles.fontStyle = "bold";
      data.cell.styles.fillColor = TOTAL_ROW;
    }
  };
}

// Starts a section 12mm below the previous table, moving to a new page
// when there's no room for the title plus a few rows — so a title is never
// left alone at the bottom of a page. Returns the table's startY.
function startSection(doc: jsPDF, title: string, prevY: number): number {
  let y = lastAutoTableY(doc, prevY) + 12;
  if (y > 250) {
    doc.addPage();
    y = 24;
  }
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text(title, 14, y - 4);
  doc.setFont("helvetica", "normal");
  return y;
}

// One month of the P&L Summary as a PDF — the same figures as the page
// (GET /api/ledgerly/summary/pnl?range=month plus the month's discounts and
// complimentary), laid out like Shiftly's payout report. Discounts and
// complimentary are added to both sales and expenses, so profit is the
// backend's profit_cents, unchanged.
export function buildPnlReportPdf(summary: PnlSummary, giveaways: Giveaways) {
  const doc = new jsPDF();
  const month = summary.from.slice(0, 7);
  const today = istDateString(new Date());
  const monthToDate = summary.to > today && summary.from <= today;
  const periodLine = `Period: ${formatDate(summary.from)} - ${formatDate(monthToDate ? today : summary.to)}${monthToDate ? " (month to date)" : ""}`;
  let y = drawReportHeader(doc, `Profit & Loss - ${formatMonthLabel(month)}`, periodLine);

  const giveawayCents = giveaways.discountCents + giveaways.complimentaryCents;
  // "income" here is gross sales — received plus what was given away.
  const income = summary.revenue_cents + giveawayCents;
  const expenses = summary.expenses_cents + giveawayCents;
  const profit = summary.profit_cents;

  autoTable(doc, {
    startY: y,
    head: [["Sales", "Expenses", profit >= 0 ? "Profit" : "Loss", "Margin"]],
    body: [[formatMoney(income), formatMoney(expenses), formatMoney(Math.abs(profit)), pctOfIncome(profit, income)]],
    styles: { fontSize: 10, font: "helvetica", cellPadding: 3, halign: "center" },
    headStyles: { fillColor: NAVY, textColor: 255, fontStyle: "bold" },
    bodyStyles: { fontStyle: "bold", textColor: NAVY },
    didParseCell: (data) => {
      if (data.section === "body" && data.column.index === 2) {
        data.cell.styles.textColor = profit >= 0 ? [12, 120, 12] : [190, 50, 50];
      }
    },
    margin: { left: 14, right: 14 },
    tableWidth: 182,
  });

  // Sales: received by payment method, then what was given away.
  y = startSection(doc, "Sales", y);
  const incomeRows: [string, number][] = [
    ["Received - cash", summary.revenue_cash_cents],
    ["Received - card", summary.revenue_card_cents],
    ["Received - UPI", summary.revenue_upi_cents],
    ["Received - other", summary.revenue_other_cents],
    ["Discounts given", giveaways.discountCents],
    ["Complimentary (menu value)", giveaways.complimentaryCents],
  ];
  const incomeBody = incomeRows
    .filter(([, v]) => v !== 0)
    .map(([label, v]) => [label, formatMoney(v), pctOfIncome(v, income)]);
  incomeBody.push(["Total sales", formatMoney(income), income > 0 ? "100%" : "-"]);
  autoTable(doc, {
    startY: y,
    head: [["Sales", "Amount", "Share"]],
    body: incomeBody,
    styles: { fontSize: 9, font: "helvetica", cellPadding: 2.5 },
    headStyles: { fillColor: GREY, textColor: 255, fontStyle: "bold" },
    columnStyles: { 1: { halign: "right" }, 2: { halign: "right" } },
    didParseCell: totalRowStyle(incomeBody.length),
    margin: { left: 14, right: 14 },
    tableWidth: 182,
  });

  // Expenses: every non-salary payment category, Pantrly deliveries and
  // salary earned (what makes up expenses_cents), plus discounts and
  // complimentary.
  y = startSection(doc, "Expenses", y);
  const byCategory = summary.payments_by_category ?? {};
  const expenseRows: [string, number][] = (Object.keys(CATEGORY_LABELS) as Category[])
    .filter((c) => c !== "salary" && (byCategory[c] ?? 0) !== 0)
    .map((c) => [CATEGORY_LABELS[c], byCategory[c] ?? 0]);
  expenseRows.push(["Pantrly deliveries (groceries)", summary.purchases_cents]);
  expenseRows.push(["Salary earned (from attendance)", summary.salary_cents]);
  if (giveaways.discountCents) expenseRows.push(["Discounts given", giveaways.discountCents]);
  if (giveaways.complimentaryCents) expenseRows.push(["Complimentary (menu value)", giveaways.complimentaryCents]);
  expenseRows.sort((a, b) => b[1] - a[1]);
  const expenseBody = expenseRows.map(([label, v]) => [label, formatMoney(v), pctOfIncome(v, income)]);
  expenseBody.push(["Total expenses", formatMoney(expenses), pctOfIncome(expenses, income)]);
  autoTable(doc, {
    startY: y,
    head: [["Expense", "Amount", "% of sales"]],
    body: expenseBody,
    styles: { fontSize: 9, font: "helvetica", cellPadding: 2.5 },
    headStyles: { fillColor: GREY, textColor: 255, fontStyle: "bold" },
    columnStyles: { 1: { halign: "right" }, 2: { halign: "right" } },
    didParseCell: totalRowStyle(expenseBody.length),
    margin: { left: 14, right: 14 },
    tableWidth: 182,
  });

  // Salary paid out — reference only, it settles the salary earned above.
  y = startSection(doc, "Salary paid out (not added to expenses)", y);
  const paidOut = summary.salary_payments_cents + summary.advances_cents;
  autoTable(doc, {
    startY: y,
    head: [["Salary payments", "Advances", "Total paid out", "Salary earned"]],
    body: [[
      formatMoney(summary.salary_payments_cents),
      formatMoney(summary.advances_cents),
      formatMoney(paidOut),
      formatMoney(summary.salary_cents),
    ]],
    styles: { fontSize: 9, font: "helvetica", cellPadding: 2.5, halign: "center" },
    headStyles: { fillColor: GREY, textColor: 255, fontStyle: "bold" },
    margin: { left: 14, right: 14 },
    tableWidth: 182,
  });

  // Pantrly deliveries grouped by item, biggest spend first.
  const byItem = new Map<string, { deliveries: number; cents: number }>();
  for (const p of summary.pantrly_purchases ?? []) {
    if (p.cost_cents == null) continue;
    const row = byItem.get(p.item_name) ?? { deliveries: 0, cents: 0 };
    row.deliveries++;
    row.cents += p.cost_cents;
    byItem.set(p.item_name, row);
  }
  if (byItem.size > 0) {
    y = startSection(doc, "Pantrly deliveries by item", y);
    const itemBody = [...byItem.entries()]
      .sort((a, b) => b[1].cents - a[1].cents)
      .map(([name, r]) => [name, String(r.deliveries), formatMoney(r.cents), pctOfIncome(r.cents, income)]);
    itemBody.push(["Total", String([...byItem.values()].reduce((s, r) => s + r.deliveries, 0)), formatMoney(summary.purchases_cents), pctOfIncome(summary.purchases_cents, income)]);
    autoTable(doc, {
      startY: y,
      head: [["Item", "Deliveries", "Cost", "% of sales"]],
      body: itemBody,
      styles: { fontSize: 8, font: "helvetica", cellPadding: 2 },
      headStyles: { fillColor: GREY, textColor: 255, fontStyle: "bold" },
      columnStyles: { 1: { halign: "right" }, 2: { halign: "right" }, 3: { halign: "right" } },
      didParseCell: totalRowStyle(itemBody.length),
      margin: { left: 14, right: 14 },
      tableWidth: 182,
    });
  }

  // How the figures are worked out, so the PDF reads on its own.
  y = lastAutoTableY(doc, y) + 10;
  if (y > 260) {
    doc.addPage();
    y = 20;
  }
  doc.setFontSize(8);
  doc.setFont("helvetica", "italic");
  doc.setTextColor(90);
  const notes = [
    `Sales are what was received plus discounts given and complimentary bills at menu price${giveaways.unpriced ? " (some complimentary dishes have no menu price and are left out)" : ""}. Discounts and complimentary are added to both sales and expenses, so they don't change profit; their ingredient cost is already in Pantrly deliveries.`,
    "Salary is counted as earned from Shiftly attendance for the days in this period. Salary payments and advances are money paid out against that salary, so they are shown for reference and not added again.",
    "Groceries are Pantrly deliveries with a cost recorded. Supplier purchase payments are listed separately; a delivery recorded in both places is counted twice.",
  ];
  for (const note of notes) {
    const lines = doc.splitTextToSize(note, 182);
    doc.text(lines, 14, y);
    y += lines.length * 3.8 + 1.5;
  }

  doc.save(`PnL_${month}.pdf`);
}
