"use client";

// Costa È Bella is not currently GST-registered, so this page does not
// compute any tax breakdown (rate, CGST/SGST split, ITC) — that depends on
// the scheme chosen at registration, which only a CA/registration process
// can determine. Instead it packages the raw revenue and expense data
// already logged in Ledgerly into CA-friendly CSVs, so whoever handles
// registration/filing has the source numbers to work from. Revisit this
// once a GSTIN and scheme are confirmed — see CLAUDE.md for the dual-mode
// revenue model these exports draw from.

import { useEffect, useState } from "react";
import { api, DailyLog, Payment, Sale } from "@/lib/ledgerly/api";
import { useLedgerlyAccess } from "@/lib/ledgerly/use-access";
import { Card } from "@/components/admin/ui/card";
import { Button } from "@/components/admin/ui/button";
import { Input } from "@/components/admin/ui/input";
import { formatINR } from "@/lib/admin/format";
import { usePageTitle } from "@/lib/admin/use-page-title";

function firstOfMonth() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function toRupees(cents: number) {
  return (cents / 100).toFixed(2);
}

function csvEscape(value: string) {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

function downloadCsv(filename: string, rows: string[][]) {
  const csv = rows.map((row) => row.map((cell) => csvEscape(cell)).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function TaxExportPage() {
  usePageTitle("Tax Export");
  const access = useLedgerlyAccess();
  const [from, setFrom] = useState(firstOfMonth());
  const [to, setTo] = useState(today());
  const [dailyLogs, setDailyLogs] = useState<DailyLog[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (access !== "allowed") return;
    setLoading(true);
    Promise.all([
      api.listDailyRevenue({ from, to }),
      api.listSales({ from, to }),
      api.listPayments({ from, to }),
    ])
      .then(([logs, s, p]) => {
        setDailyLogs(logs ?? []);
        setSales(s ?? []);
        setPayments(p ?? []);
      })
      .finally(() => setLoading(false));
  }, [access, from, to]);

  const revenueTotalCents =
    dailyLogs.reduce((sum, l) => sum + l.cash_cents + l.card_cents + l.upi_cents, 0) +
    sales.reduce((sum, s) => sum + s.amount_cents, 0);
  const expenseTotalCents = payments.reduce((sum, p) => sum + p.amount_cents, 0);

  function exportRevenue() {
    const header = ["date", "source", "payment_method", "amount_inr", "notes"];
    const body: string[][] = [];
    for (const l of dailyLogs) {
      if (l.cash_cents) body.push([l.log_date, "daily_total", "cash", toRupees(l.cash_cents), l.notes ?? ""]);
      if (l.card_cents) body.push([l.log_date, "daily_total", "card", toRupees(l.card_cents), l.notes ?? ""]);
      if (l.upi_cents) body.push([l.log_date, "daily_total", "upi", toRupees(l.upi_cents), l.notes ?? ""]);
    }
    for (const s of sales) {
      body.push([s.sale_date, "per_sale", s.payment_method, toRupees(s.amount_cents), s.notes ?? ""]);
    }
    body.sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
    downloadCsv(`ledgerly-revenue_${from}_to_${to}.csv`, [header, ...body]);
  }

  function exportExpenses() {
    const rows: string[][] = [
      ["date", "category", "payee", "payment_method", "amount_inr", "notes"],
    ];
    for (const p of payments) {
      rows.push([p.payment_date, p.category, p.payee ?? "", p.payment_method, toRupees(p.amount_cents), p.notes ?? ""]);
    }
    rows.sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
    downloadCsv(`ledgerly-expenses_${from}_to_${to}.csv`, rows);
  }

  function exportMonthlySummary() {
    const months = new Map<string, { revenue: number; expenses: number }>();
    function bucket(date: string) {
      const key = date.slice(0, 7);
      if (!months.has(key)) months.set(key, { revenue: 0, expenses: 0 });
      return months.get(key)!;
    }
    for (const l of dailyLogs) bucket(l.log_date).revenue += l.cash_cents + l.card_cents + l.upi_cents;
    for (const s of sales) bucket(s.sale_date).revenue += s.amount_cents;
    for (const p of payments) bucket(p.payment_date).expenses += p.amount_cents;

    const rows: string[][] = [["month", "revenue_inr", "expenses_inr", "net_inr"]];
    for (const [month, totals] of [...months.entries()].sort()) {
      rows.push([
        month,
        toRupees(totals.revenue),
        toRupees(totals.expenses),
        toRupees(totals.revenue - totals.expenses),
      ]);
    }
    downloadCsv(`ledgerly-monthly-summary_${from}_to_${to}.csv`, rows);
  }

  if (access === "checking") return null;

  if (access === "denied") {
    return (
      <div>
        <h1 className="font-display text-2xl text-navy">Tax Export</h1>
        <Card className="mt-6 p-10 text-center">
          <p className="font-medium text-navy">You don&apos;t have access to Tax Export.</p>
          <p className="mt-1 text-sm text-navy/60">
            This view is restricted to a small set of emails. Log Revenue and Payments are still available to you.
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl text-navy">Tax Export</h1>
          <p className="mt-1 text-sm text-navy/60">
            Download the logged revenue and expenses for your CA to use during GST registration/filing.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-auto" />
          <span className="text-navy/40">to</span>
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-auto" />
        </div>
      </div>

      <Card className="mb-4 p-4">
        <p className="text-xs text-navy/60">
          Costa È Bella isn&apos;t currently GST-registered, so these exports don&apos;t compute a tax breakdown
          (rate, CGST/SGST split, ITC eligibility) — that depends on the scheme chosen at registration. Amounts
          here are the bill totals exactly as logged in Ledgerly (GST-inclusive where applicable), meant as raw
          source data for your CA to work from, not a filing-ready return.
        </p>
      </Card>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card className="p-5">
          <p className="text-xs uppercase tracking-wide text-navy/50">Revenue in range</p>
          <p className="mt-2 font-display text-2xl text-navy">{loading ? "…" : formatINR(revenueTotalCents)}</p>
        </Card>
        <Card className="p-5">
          <p className="text-xs uppercase tracking-wide text-navy/50">Expenses in range</p>
          <p className="mt-2 font-display text-2xl text-navy">{loading ? "…" : formatINR(expenseTotalCents)}</p>
        </Card>
        <Card className="p-5">
          <p className="text-xs uppercase tracking-wide text-navy/50">Net</p>
          <p className="mt-2 font-display text-2xl text-navy">
            {loading ? "…" : formatINR(revenueTotalCents - expenseTotalCents)}
          </p>
        </Card>
      </div>

      <Card className="mt-4 p-5">
        <h3 className="mb-3 font-semibold text-navy">Downloads</h3>
        <div className="flex flex-wrap gap-3">
          <Button onClick={exportRevenue} disabled={loading}>
            Revenue CSV
          </Button>
          <Button onClick={exportExpenses} disabled={loading}>
            Expenses CSV
          </Button>
          <Button onClick={exportMonthlySummary} disabled={loading}>
            Monthly Summary CSV
          </Button>
        </div>
      </Card>
    </div>
  );
}
