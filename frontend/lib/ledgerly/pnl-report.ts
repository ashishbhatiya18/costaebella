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
// complimentary are deductions from sales at menu price down to net sales
// (what was received) — revenue not collected, never an expense.
export function buildPnlReportPdf(summary: PnlSummary, giveaways: Giveaways) {
  const doc = new jsPDF();
  const month = summary.from.slice(0, 7);
  const today = istDateString(new Date());
  const monthToDate = summary.to > today && summary.from <= today;
  const periodLine = `Period: ${formatDate(summary.from)} - ${formatDate(monthToDate ? today : summary.to)}${monthToDate ? " (month to date)" : ""}`;
  let y = drawReportHeader(doc, `Profit & Loss - ${formatMonthLabel(month)}`, periodLine);

  // income is net sales — what was actually received.
  const income = summary.revenue_cents;
  const menuSales = income + giveaways.discountCents + giveaways.complimentaryCents;
  const expenses = summary.expenses_cents;
  const profit = summary.profit_cents;

  autoTable(doc, {
    startY: y,
    head: [["Net sales", "Expenses", profit >= 0 ? "Profit" : "Loss", "Margin"]],
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

  // Sales: menu-price sales less what was given away, down to net sales.
  y = startSection(doc, "Sales", y);
  const salesBody = [
    ["Sales at menu price", formatMoney(menuSales), pctOfIncome(menuSales, menuSales)],
    ["Less: discounts given", `- ${formatMoney(giveaways.discountCents)}`, pctOfIncome(giveaways.discountCents, menuSales)],
    [
      `Less: complimentary (menu value${giveaways.unpriced ? ", some dishes unpriced" : ""})`,
      `- ${formatMoney(giveaways.complimentaryCents)}`,
      pctOfIncome(giveaways.complimentaryCents, menuSales),
    ],
    ["Net sales (received)", formatMoney(income), pctOfIncome(income, menuSales)],
  ];
  autoTable(doc, {
    startY: y,
    head: [["Sales", "Amount", "% of menu price"]],
    body: salesBody,
    styles: { fontSize: 9, font: "helvetica", cellPadding: 2.5 },
    headStyles: { fillColor: GREY, textColor: 255, fontStyle: "bold" },
    columnStyles: { 1: { halign: "right" }, 2: { halign: "right" } },
    didParseCell: totalRowStyle(salesBody.length),
    margin: { left: 14, right: 14 },
    tableWidth: 182,
  });

  // Net sales by payment method.
  y = startSection(doc, "Received by payment method", y);
  const incomeRows: [string, number][] = [
    ["Cash", summary.revenue_cash_cents],
    ["Card", summary.revenue_card_cents],
    ["UPI", summary.revenue_upi_cents],
    ["Other", summary.revenue_other_cents],
  ];
  const incomeBody = incomeRows
    .filter(([, v]) => v !== 0)
    .map(([label, v]) => [label, formatMoney(v), pctOfIncome(v, income)]);
  incomeBody.push(["Net sales", formatMoney(income), income > 0 ? "100%" : "-"]);
  autoTable(doc, {
    startY: y,
    head: [["Payment method", "Amount", "Share"]],
    body: incomeBody,
    styles: { fontSize: 9, font: "helvetica", cellPadding: 2.5 },
    headStyles: { fillColor: GREY, textColor: 255, fontStyle: "bold" },
    columnStyles: { 1: { halign: "right" }, 2: { halign: "right" } },
    didParseCell: totalRowStyle(incomeBody.length),
    margin: { left: 14, right: 14 },
    tableWidth: 182,
  });

  // Expenses: every non-salary payment category, Pantrly deliveries and
  // salary earned — exactly what makes up expenses_cents.
  y = startSection(doc, "Expenses", y);
  const byCategory = summary.payments_by_category ?? {};
  const expenseRows: [string, number][] = (Object.keys(CATEGORY_LABELS) as Category[])
    .filter((c) => c !== "salary" && (byCategory[c] ?? 0) !== 0)
    .map((c) => [CATEGORY_LABELS[c], byCategory[c] ?? 0]);
  expenseRows.push(["Pantrly deliveries (groceries)", summary.purchases_cents]);
  expenseRows.push(["Salary earned (from attendance)", summary.salary_cents]);
  expenseRows.sort((a, b) => b[1] - a[1]);
  const expenseBody = expenseRows.map(([label, v]) => [label, formatMoney(v), pctOfIncome(v, income)]);
  expenseBody.push(["Total expenses", formatMoney(expenses), pctOfIncome(expenses, income)]);
  autoTable(doc, {
    startY: y,
    head: [["Expense", "Amount", "% of net sales"]],
    body: expenseBody,
    styles: { fontSize: 9, font: "helvetica", cellPadding: 2.5 },
    headStyles: { fillColor: GREY, textColor: 255, fontStyle: "bold" },
    columnStyles: { 1: { halign: "right" }, 2: { halign: "right" } },
    didParseCell: totalRowStyle(expenseBody.length),
    margin: { left: 14, right: 14 },
    tableWidth: 182,
  });

  // Giveaways: who got discounts / complimentary and why. Same figures as
  // the "Less:" lines under Sales.
  if (giveaways.bills.length > 0) {
    const givenAway = giveaways.discountCents + giveaways.complimentaryCents;
    type Group = { bills: number; discount: number; complimentary: number; staff: boolean };
    const add = (m: Map<string, Group>, key: string, b: (typeof giveaways.bills)[number]) => {
      const g = m.get(key) ?? { bills: 0, discount: 0, complimentary: 0, staff: b.isStaff };
      g.bills++;
      if (b.kind === "discount") g.discount += b.givenAwayCents;
      else g.complimentary += b.givenAwayCents;
      m.set(key, g);
    };
    const recipient = (b: (typeof giveaways.bills)[number]) =>
      b.givenTo ? `${b.givenTo}${b.isStaff ? " (staff)" : ""}` : "Not recorded";
    const byCategory = new Map<string, Group>();
    const byPerson = new Map<string, Group>();
    const personName = new Map<string, string>();
    for (const b of giveaways.bills) {
      add(byCategory, b.category || "Not recorded", b);
      // Case-insensitive so "Vardha" and "vardha" are one person.
      const key = recipient(b).toLowerCase();
      add(byPerson, key, b);
      if (!personName.has(key)) personName.set(key, recipient(b));
    }
    const groupRows = (m: Map<string, Group>, label: (k: string) => string) => {
      const rows = [...m.entries()]
        .sort((a, b) => b[1].discount + b[1].complimentary - (a[1].discount + a[1].complimentary))
        .map(([k, g]) => [label(k), String(g.bills), formatMoney(g.discount), formatMoney(g.complimentary), formatMoney(g.discount + g.complimentary)]);
      rows.push(["Total", String(giveaways.bills.length), formatMoney(giveaways.discountCents), formatMoney(giveaways.complimentaryCents), formatMoney(givenAway)]);
      return rows;
    };
    const groupTable = (title: string, head: string, rows: string[][]) => {
      y = startSection(doc, title, y);
      autoTable(doc, {
        startY: y,
        head: [[head, "Bills", "Discounts", "Complimentary", "Total"]],
        body: rows,
        styles: { fontSize: 9, font: "helvetica", cellPadding: 2.5 },
        headStyles: { fillColor: GREY, textColor: 255, fontStyle: "bold" },
        columnStyles: { 1: { halign: "right" }, 2: { halign: "right" }, 3: { halign: "right" }, 4: { halign: "right" } },
        didParseCell: totalRowStyle(rows.length),
        margin: { left: 14, right: 14 },
        tableWidth: 182,
      });
    };
    groupTable("Giveaways by category", "Category", groupRows(byCategory, (k) => k));
    groupTable("Giveaways by person", "Given to", groupRows(byPerson, (k) => personName.get(k) ?? k));

    y = startSection(doc, "Giveaway bills", y);
    const billRows = giveaways.bills.map((b) => {
      const counts = new Map<string, number>();
      for (const n of b.itemNames) counts.set(n, (counts.get(n) ?? 0) + 1);
      const dishes = [...counts.entries()].map(([n, q]) => (q > 1 ? `${n} x${q}` : n)).join(", ");
      return [
        formatDate(b.date),
        recipient(b),
        b.category || "-",
        b.kind === "complimentary" ? "Complimentary" : "Discount",
        dishes || "-",
        formatMoney(b.givenAwayCents),
        formatMoney(b.receivedCents),
      ];
    });
    autoTable(doc, {
      startY: y,
      head: [["Date", "Given to", "Category", "Type", "Dishes", "Given away", "Received"]],
      body: billRows,
      styles: { fontSize: 7.5, font: "helvetica", cellPadding: 2, overflow: "linebreak" },
      headStyles: { fillColor: GREY, textColor: 255, fontStyle: "bold" },
      columnStyles: {
        0: { cellWidth: 19 },
        1: { cellWidth: 29 },
        2: { cellWidth: 23 },
        3: { cellWidth: 25 },
        4: { cellWidth: 44 },
        5: { cellWidth: 21, halign: "right" },
        6: { cellWidth: 21, halign: "right" },
      },
      margin: { left: 14, right: 14 },
      tableWidth: 182,
    });
  }

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
      head: [["Item", "Deliveries", "Cost", "% of net sales"]],
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
    `Net sales is what was actually received. Discounts and complimentary bills (at menu price${giveaways.unpriced ? "; dishes with no menu price are left out" : ""}) are sales not collected, so they are deducted from sales at menu price rather than counted as expenses. Their ingredient cost is already in Pantrly deliveries.`,
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
