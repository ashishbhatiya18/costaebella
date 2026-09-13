"use client";

import { useEffect, useMemo, useState } from "react";
import { api, ApiError, Sale } from "@/lib/ledgerly/api";
import { Card } from "@/components/admin/ui/card";
import { Button } from "@/components/admin/ui/button";
import { Input, Label } from "@/components/admin/ui/input";
import { clsx } from "@/lib/admin/clsx";
import { formatINR } from "@/lib/admin/format";
import { usePageTitle } from "@/lib/admin/use-page-title";

function today() {
  return new Date().toISOString().slice(0, 10);
}

function toCents(value: string) {
  const n = Number(value);
  return isNaN(n) ? 0 : Math.round(n * 100);
}

export function LogRevenueClient({ menuItems }: { menuItems: string[] }) {
  usePageTitle("Log Income");
  const [date, setDate] = useState(today());

  const [saleAmount, setSaleAmount] = useState("");
  const [salePaymentMethod, setSalePaymentMethod] = useState("cash");
  const [saleNotes, setSaleNotes] = useState("");
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [itemSearch, setItemSearch] = useState("");
  const [todaysSales, setTodaysSales] = useState<Sale[]>([]);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    try {
      const sales = await api.listSales({ from: date, to: date });
      setTodaysSales(sales ?? []);
    } catch {
      setTodaysSales([]);
    }
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date]);

  const filteredItems = useMemo(() => {
    if (!itemSearch.trim()) return menuItems;
    const q = itemSearch.toLowerCase();
    return menuItems.filter((name) => name.toLowerCase().includes(q));
  }, [menuItems, itemSearch]);

  function toggleItem(name: string) {
    setSelectedItems((prev) =>
      prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name],
    );
  }

  async function submitSale(e: React.FormEvent) {
    e.preventDefault();
    const amountCents = toCents(saleAmount);
    if (amountCents <= 0) {
      setError("Enter a valid amount.");
      return;
    }
    if (selectedItems.length === 0) {
      setError("Select at least one dish.");
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
        item_names: selectedItems,
      });
      setSaleAmount("");
      setSaleNotes("");
      setSelectedItems([]);
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
          <h1 className="font-display text-2xl text-navy">Log Income</h1>
          <p className="mt-1 text-sm text-navy/60">Log each sale as it happens.</p>
        </div>
        <Input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="w-auto"
        />
      </div>

      <div className="space-y-4">
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
              <Label htmlFor="sale-item-search">Dish(es) sold</Label>
              {selectedItems.length > 0 && (
                <div className="mb-2 flex flex-wrap gap-1.5">
                  {selectedItems.map((name) => (
                    <button
                      key={name}
                      type="button"
                      onClick={() => toggleItem(name)}
                      className="flex items-center gap-1 rounded-full bg-teal/15 px-2.5 py-1 text-xs font-medium text-teal hover:bg-teal/25"
                    >
                      {name}
                      <span aria-hidden>×</span>
                    </button>
                  ))}
                </div>
              )}
              <Input
                id="sale-item-search"
                value={itemSearch}
                onChange={(e) => setItemSearch(e.target.value)}
                placeholder="Search menu items…"
              />
              {itemSearch.trim() && (
                <div className="mt-2 flex max-h-32 flex-wrap gap-1.5 overflow-y-auto">
                  {filteredItems.slice(0, 30).map((name) => {
                    const active = selectedItems.includes(name);
                    return (
                      <button
                        key={name}
                        type="button"
                        onClick={() => {
                          toggleItem(name);
                          setItemSearch("");
                        }}
                        className={clsx(
                          "rounded-full px-2.5 py-1 text-xs font-medium transition-colors",
                          active ? "bg-teal/15 text-teal" : "bg-navy/5 text-navy/60 hover:bg-navy/10",
                        )}
                      >
                        {name}
                      </button>
                    );
                  })}
                  {filteredItems.length === 0 && (
                    <span className="text-xs text-navy/40">No matching items.</span>
                  )}
                </div>
              )}
            </div>

            <div>
              <Label htmlFor="sale-notes">Notes</Label>
              <Input id="sale-notes" value={saleNotes} onChange={(e) => setSaleNotes(e.target.value)} />
            </div>
            {error && <p className="text-sm text-coral">{error}</p>}
            <div className="flex justify-end">
              <Button type="submit" disabled={submitting || selectedItems.length === 0}>
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
                <li key={s.id} className="py-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-navy/70">
                      {s.payment_method} {s.notes && `— ${s.notes}`}
                    </span>
                    <span className="font-medium text-navy">{formatINR(s.amount_cents)}</span>
                  </div>
                  {s.item_names?.length > 0 && (
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {s.item_names.map((name) => (
                        <span
                          key={name}
                          className="rounded-full bg-teal/10 px-2 py-0.5 text-xs font-medium text-teal"
                        >
                          {name}
                        </span>
                      ))}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
