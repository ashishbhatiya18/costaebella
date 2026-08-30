"use client";

import { useEffect, useState } from "react";
import { api, ApiError, DailyLog, Sale } from "@/lib/ledgerly/api";
import { Card } from "@/components/admin/ui/card";
import { Button } from "@/components/admin/ui/button";
import { Input, Label } from "@/components/admin/ui/input";
import { SegmentedControl } from "@/components/admin/ui/segmented-control";
import { formatINR } from "@/lib/admin/format";
import { usePageTitle } from "@/lib/admin/use-page-title";

function today() {
  return new Date().toISOString().slice(0, 10);
}

function toCents(value: string) {
  const n = Number(value);
  return isNaN(n) ? 0 : Math.round(n * 100);
}

export default function LogRevenuePage() {
  usePageTitle("Log Revenue");
  // Daily Total tab is temporarily disabled (a day logged both ways silently
  // drops the daily total in favor of per-sale entries — see RangeRevenue).
  const [mode] = useState<"daily" | "sale">("sale");
  const [date, setDate] = useState(today());

  // Daily total mode
  const [cash, setCash] = useState("");
  const [card, setCard] = useState("");
  const [upi, setUpi] = useState("");
  const [dailyNotes, setDailyNotes] = useState("");
  const [existingDaily, setExistingDaily] = useState<DailyLog | null>(null);

  // Per-sale mode
  const [saleAmount, setSaleAmount] = useState("");
  const [salePaymentMethod, setSalePaymentMethod] = useState("cash");
  const [saleNotes, setSaleNotes] = useState("");
  const [todaysSales, setTodaysSales] = useState<Sale[]>([]);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    try {
      const [logs, sales] = await Promise.all([
        api.listDailyRevenue({ from: date, to: date }),
        api.listSales({ from: date, to: date }),
      ]);
      const log = logs?.[0] ?? null;
      setExistingDaily(log);
      setCash(log ? String(log.cash_cents / 100) : "");
      setCard(log ? String(log.card_cents / 100) : "");
      setUpi(log ? String(log.upi_cents / 100) : "");
      setDailyNotes(log?.notes ?? "");
      setTodaysSales(sales ?? []);
    } catch {
      setExistingDaily(null);
      setTodaysSales([]);
    }
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date]);

  async function submitDaily(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await api.logDailyRevenue({
        date,
        cash_cents: toCents(cash),
        card_cents: toCents(card),
        upi_cents: toCents(upi),
        notes: dailyNotes,
      });
      await refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to log revenue.");
    } finally {
      setSubmitting(false);
    }
  }

  async function submitSale(e: React.FormEvent) {
    e.preventDefault();
    const amountCents = toCents(saleAmount);
    if (amountCents <= 0) {
      setError("Enter a valid amount.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await api.logSale({
        sale_date: date,
        amount_cents: amountCents,
        payment_method: salePaymentMethod,
        notes: saleNotes,
      });
      setSaleAmount("");
      setSaleNotes("");
      await refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to log sale.");
    } finally {
      setSubmitting(false);
    }
  }

  const salesTotal = todaysSales.reduce((sum, s) => sum + s.amount_cents, 0);

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl text-navy">Log Revenue</h1>
          <p className="mt-1 text-sm text-navy/60">
            A quick end-of-day total, or log each sale as it happens — whichever fits your day.
          </p>
        </div>
        <Input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="w-auto"
        />
      </div>

      <SegmentedControl
        options={[
          { label: "Daily Total", value: "daily", disabled: true },
          { label: "Per Sale", value: "sale" },
        ]}
        value={mode}
        onChange={() => {}}
      />

      {mode === "daily" ? (
        <Card className="mt-4 p-5">
          {todaysSales.length > 0 && (
            <p className="mb-4 rounded-lg bg-sand/20 px-3 py-2 text-xs text-navy/60">
              Heads up: {todaysSales.length} per-sale {todaysSales.length === 1 ? "entry" : "entries"} already
              logged for this date ({formatINR(salesTotal)}) — those will be used as this day&apos;s revenue
              instead of the total below.
            </p>
          )}
          <form onSubmit={submitDaily} className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label htmlFor="cash">Cash (₹)</Label>
                <Input id="cash" type="number" step="any" min={0} value={cash} onChange={(e) => setCash(e.target.value)} />
              </div>
              <div>
                <Label htmlFor="card">Card (₹)</Label>
                <Input id="card" type="number" step="any" min={0} value={card} onChange={(e) => setCard(e.target.value)} />
              </div>
              <div>
                <Label htmlFor="upi">UPI (₹)</Label>
                <Input id="upi" type="number" step="any" min={0} value={upi} onChange={(e) => setUpi(e.target.value)} />
              </div>
            </div>
            <div>
              <Label htmlFor="daily-notes">Notes</Label>
              <Input id="daily-notes" value={dailyNotes} onChange={(e) => setDailyNotes(e.target.value)} />
            </div>
            {error && <p className="text-sm text-coral">{error}</p>}
            <div className="flex items-center justify-between pt-2">
              <p className="text-sm text-navy/60">
                Total: {formatINR(toCents(cash) + toCents(card) + toCents(upi))}
              </p>
              <Button type="submit" disabled={submitting}>
                {existingDaily ? "Update total" : "Save total"}
              </Button>
            </div>
          </form>
        </Card>
      ) : (
        <div className="mt-4 space-y-4">
          <Card className="p-5">
            <form onSubmit={submitSale} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="sale-amount">Amount (₹)</Label>
                  <Input
                    id="sale-amount"
                    type="number"
                    step="any"
                    min={0}
                    value={saleAmount}
                    onChange={(e) => setSaleAmount(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="sale-method">Payment method</Label>
                  <select
                    id="sale-method"
                    value={salePaymentMethod}
                    onChange={(e) => setSalePaymentMethod(e.target.value)}
                    className="w-full rounded-xl border border-navy/15 bg-cream/40 px-3.5 py-2.5 text-sm text-navy outline-none transition-colors focus:border-teal focus:ring-2 focus:ring-teal/20"
                  >
                    <option value="cash">Cash</option>
                    <option value="card">Card</option>
                    <option value="upi">UPI</option>
                    <option value="other">Other</option>
                  </select>
                </div>
              </div>
              <div>
                <Label htmlFor="sale-notes">Notes</Label>
                <Input id="sale-notes" value={saleNotes} onChange={(e) => setSaleNotes(e.target.value)} />
              </div>
              {error && <p className="text-sm text-coral">{error}</p>}
              <div className="flex justify-end">
                <Button type="submit" disabled={submitting}>
                  Log sale
                </Button>
              </div>
            </form>
          </Card>

          <Card className="p-5">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-semibold text-navy">Today&apos;s sales</h3>
              <span className="text-sm text-navy/60">{formatINR(salesTotal)} total</span>
            </div>
            {todaysSales.length === 0 ? (
              <p className="text-sm text-navy/50">No sales logged yet for this date.</p>
            ) : (
              <ul className="divide-y divide-navy/5">
                {todaysSales.map((s) => (
                  <li key={s.id} className="flex items-center justify-between py-2 text-sm">
                    <span className="text-navy/70">
                      {s.payment_method} {s.notes && `— ${s.notes}`}
                    </span>
                    <span className="font-medium text-navy">{formatINR(s.amount_cents)}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}
