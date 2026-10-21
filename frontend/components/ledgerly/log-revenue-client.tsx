"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { api, ApiError, Sale } from "@/lib/ledgerly/api";
import { api as shiftlyApi, Employee } from "@/lib/shiftly/api";
import {
  COMPLIMENTARY_CATEGORIES,
  DISCOUNT_CATEGORIES,
  OTHER_CATEGORY,
  RecipientType,
  STAFF_CATEGORIES,
} from "@/lib/ledgerly/giveaways";
import { Card } from "@/components/admin/ui/card";
import { Button } from "@/components/admin/ui/button";
import { SplitButton } from "@/components/admin/ui/split-button";
import { IconButton } from "@/components/admin/ui/icon-button";
import { TrashIcon } from "@/components/admin/ui/icons";
import { Input, Label } from "@/components/admin/ui/input";
import { clsx } from "@/lib/admin/clsx";
import { formatINR } from "@/lib/admin/format";
import { usePageTitle } from "@/lib/admin/use-page-title";
import { parseBillText } from "@/lib/ledgerly/bill-ocr";
import { todayStr } from "@/lib/admin/period";

function toCents(value: string) {
  const n = Number(value);
  return isNaN(n) ? 0 : Math.round(n * 100);
}

// One row per item name in `item_names` records one unit sold — so a
// quantity of N is submitted as N repeated entries of the same name.
function expandItemNames(items: Record<string, number>): string[] {
  return Object.entries(items).flatMap(([name, qty]) => Array(qty).fill(name));
}

function itemsSummaryText(items: Record<string, number>): string {
  return Object.entries(items)
    .map(([name, qty]) => `${name} x${qty}`)
    .join(", ");
}

function groupItemNames(names: string[]): { name: string; quantity: number }[] {
  const counts = new Map<string, number>();
  for (const name of names) counts.set(name, (counts.get(name) ?? 0) + 1);
  return [...counts.entries()].map(([name, quantity]) => ({ name, quantity }));
}

export function LogRevenueClient({ menuItems }: { menuItems: string[] }) {
  usePageTitle("Log Income");
  const [date, setDate] = useState(todayStr());

  // saleAmount is the bill total before any discount; what gets logged as
  // income is the total minus the discount.
  const [saleAmount, setSaleAmount] = useState("");
  const [saleDiscount, setSaleDiscount] = useState("");
  const [reasonChoice, setReasonChoice] = useState("");
  const [saleReason, setSaleReason] = useState("");
  const [complimentary, setComplimentary] = useState(false);
  const [recipientType, setRecipientType] = useState<RecipientType>("other");
  const [recipientEmployeeId, setRecipientEmployeeId] = useState("");
  const [recipientName, setRecipientName] = useState("");
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [pastRecipients, setPastRecipients] = useState<string[]>([]);
  const [salePaymentMethod, setSalePaymentMethod] = useState("cash");
  const [saleNotes, setSaleNotes] = useState("");
  const [selectedItems, setSelectedItems] = useState<Record<string, number>>({});
  const [itemSearch, setItemSearch] = useState("");
  const [todaysSales, setTodaysSales] = useState<Sale[]>([]);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [scanning, setScanning] = useState(false);
  const [scanNotice, setScanNotice] = useState<string | null>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  async function handleBillUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    setScanning(true);
    setScanNotice(null);
    setError(null);
    try {
      const { createWorker } = await import("tesseract.js");
      const worker = await createWorker("eng");
      try {
        const {
          data: { text },
        } = await worker.recognize(file);
        const { amountCents, items } = parseBillText(text, menuItems);

        if (amountCents) {
          setSaleAmount((amountCents / 100).toString());
        }
        if (items.length > 0) {
          setSelectedItems(Object.fromEntries(items.map((it) => [it.name, it.quantity])));
        }
        if (!amountCents && items.length === 0) {
          setScanNotice("Couldn't read the amount or any dishes off that photo — fill the form in manually.");
        } else {
          setScanNotice("Scanned from photo — please check the fields below before submitting.");
        }
      } finally {
        await worker.terminate();
      }
    } catch {
      setScanNotice("Couldn't scan that photo — fill the form in manually.");
    } finally {
      setScanning(false);
    }
  }

  async function refresh() {
    try {
      const sales = await api.listSales({ from: date, to: date });
      setTodaysSales(sales ?? []);
    } catch {
      setTodaysSales([]);
    }
  }

  useEffect(() => {
    shiftlyApi
      .listEmployees()
      .then((data) => setEmployees((data ?? []).filter((e) => e.active)))
      .catch(() => setEmployees([]));
    api
      .listRecipientNames()
      .then((data) => setPastRecipients(data ?? []))
      .catch(() => setPastRecipients([]));
  }, []);

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date]);

  const filteredItems = useMemo(() => {
    if (!itemSearch.trim()) return menuItems;
    const q = itemSearch.toLowerCase();
    return menuItems.filter((name) => name.toLowerCase().includes(q));
  }, [menuItems, itemSearch]);

  function addItem(name: string) {
    setSelectedItems((prev) => ({ ...prev, [name]: (prev[name] ?? 0) + 1 }));
  }

  function changeItemQty(name: string, delta: number) {
    setSelectedItems((prev) => {
      const nextQty = (prev[name] ?? 0) + delta;
      if (nextQty <= 0) {
        const { [name]: _removed, ...rest } = prev;
        return rest;
      }
      return { ...prev, [name]: nextQty };
    });
  }

  function removeItem(name: string) {
    setSelectedItems((prev) => {
      const { [name]: _removed, ...rest } = prev;
      return rest;
    });
  }

  async function submitSale(e: React.FormEvent) {
    e.preventDefault();
    const totalCents = complimentary ? 0 : toCents(saleAmount);
    const discountCents = complimentary ? 0 : toCents(saleDiscount);
    if (!complimentary) {
      if (totalCents <= 0) {
        setError("Enter a valid amount.");
        return;
      }
      if (discountCents < 0) {
        setError("Discount can't be negative.");
        return;
      }
      if (discountCents >= totalCents) {
        setError("Discount must be less than the total — for a fully free bill, tick Complimentary instead.");
        return;
      }
    }
    const isGiveaway = complimentary || discountCents > 0;
    const reason = reasonChoice === OTHER_CATEGORY ? saleReason.trim() : reasonChoice;
    if (isGiveaway && !reason) {
      setError(complimentary ? "Choose a category for the complimentary." : "Choose a category for the discount.");
      return;
    }
    const givenToEmployeeId = recipientType === "staff" ? recipientEmployeeId : "";
    const givenTo = recipientType === "other" ? recipientName.trim() : "";
    if (isGiveaway && !givenToEmployeeId && !givenTo) {
      setError(recipientType === "staff" ? "Choose which staff member it was given to." : "Enter who it was given to.");
      return;
    }
    const itemNames = expandItemNames(selectedItems);
    if (itemNames.length === 0) {
      setError("Select at least one dish.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const summary = itemsSummaryText(selectedItems);
      const notes = saleNotes.trim() ? `${summary} — ${saleNotes.trim()}` : summary;
      await api.logSale({
        sale_date: date,
        amount_cents: totalCents - discountCents,
        payment_method: complimentary ? "" : salePaymentMethod,
        notes,
        item_names: itemNames,
        discount_cents: discountCents,
        discount_reason: isGiveaway ? reason : "",
        is_complimentary: complimentary,
        given_to: isGiveaway ? givenTo : "",
        given_to_employee_id: isGiveaway && givenToEmployeeId ? givenToEmployeeId : null,
      });
      if (givenTo && !pastRecipients.includes(givenTo)) setPastRecipients([givenTo, ...pastRecipients]);
      setSaleAmount("");
      setSaleDiscount("");
      setReasonChoice("");
      setSaleReason("");
      setComplimentary(false);
      setRecipientType("other");
      setRecipientEmployeeId("");
      setRecipientName("");
      setSaleNotes("");
      setSelectedItems({});
      await refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to log sale.");
    } finally {
      setSubmitting(false);
    }
  }

  const salesTotal = todaysSales.reduce((sum, s) => sum + s.amount_cents, 0);
  const discountTotal = todaysSales.reduce((sum, s) => sum + (s.discount_cents ?? 0), 0);
  const complimentaryCount = todaysSales.filter((s) => s.is_complimentary).length;
  const formDiscountCents = complimentary ? 0 : toCents(saleDiscount);
  const needsReason = complimentary || formDiscountCents > 0;

  async function handleDeleteSale(id: string) {
    if (!confirm("Delete this sale? This cannot be undone.")) return;
    try {
      await api.deleteSale(id);
      await refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to delete sale.");
    }
  }

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
            <div className="relative">
              <input
                ref={cameraInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={handleBillUpload}
              />
              <input
                ref={galleryInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleBillUpload}
              />
              <SplitButton
                label={scanning ? "Scanning bill…" : "Take bill photo"}
                onClick={() => cameraInputRef.current?.click()}
                options={[
                  { label: "Choose from gallery", onClick: () => galleryInputRef.current?.click() },
                ]}
              />
              {scanNotice && <p className="mt-1.5 text-xs text-navy/60">{scanNotice}</p>}
            </div>

            <label className="flex items-center gap-2 text-sm font-medium text-navy/70">
              <input
                type="checkbox"
                checked={complimentary}
                onChange={(e) => {
                  setComplimentary(e.target.checked);
                  // The two category lists differ, so a pick from one may not exist in the other.
                  if (reasonChoice !== OTHER_CATEGORY) setReasonChoice("");
                }}
                className="h-4 w-4 accent-teal"
              />
              Complimentary (given free — no payment)
            </label>

            {!complimentary && (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <div>
                <Label htmlFor="sale-amount">Total amount (₹)</Label>
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
                <Label htmlFor="sale-discount">Discount (₹)</Label>
                <Input
                  id="sale-discount"
                  type="number"
                  step="any"
                  min={0}
                  value={saleDiscount}
                  onChange={(e) => setSaleDiscount(e.target.value)}
                  placeholder="0"
                />
              </div>
              <div className="col-span-2 sm:col-span-1">
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
            )}

            {!complimentary && formDiscountCents > 0 && (
              <p className="text-xs text-navy/60">
                Customer pays {formatINR(Math.max(toCents(saleAmount) - formDiscountCents, 0))} — this is what gets
                logged as income.
              </p>
            )}

            {needsReason && (
              <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label htmlFor="sale-reason">
                  {complimentary ? "Complimentary category" : "Discount category"}
                </Label>
                <select
                  id="sale-reason"
                  value={reasonChoice}
                  onChange={(e) => {
                    setReasonChoice(e.target.value);
                    if (STAFF_CATEGORIES.includes(e.target.value)) setRecipientType("staff");
                  }}
                  required
                  className="w-full rounded-xl border border-navy/15 bg-cream/40 px-3.5 py-2.5 text-sm text-navy outline-none transition-colors focus:border-teal focus:ring-2 focus:ring-teal/20"
                >
                  <option value="">Select a category…</option>
                  {(complimentary ? COMPLIMENTARY_CATEGORIES : DISCOUNT_CATEGORIES).map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                  <option value={OTHER_CATEGORY}>Other (type it)</option>
                </select>
                {reasonChoice === OTHER_CATEGORY && (
                  <Input
                    className="mt-2"
                    value={saleReason}
                    onChange={(e) => setSaleReason(e.target.value)}
                    placeholder="Type the category"
                    aria-label="Category"
                    required
                  />
                )}
              </div>
              <div>
                <div className="mb-1.5 flex items-center justify-between gap-2">
                  <label htmlFor="sale-given-to" className="text-sm font-medium text-navy/70">
                    Given to
                  </label>
                  <div className="inline-flex rounded-lg border border-navy/10 bg-cream/60 p-0.5 text-xs">
                    {(["staff", "other"] as const).map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setRecipientType(t)}
                        className={clsx(
                          "rounded-md px-2.5 py-1 font-medium transition-colors",
                          recipientType === t ? "bg-teal text-white shadow-sm" : "text-navy/60 hover:text-navy",
                        )}
                      >
                        {t === "staff" ? "Staff" : "Other"}
                      </button>
                    ))}
                  </div>
                </div>
                {recipientType === "staff" ? (
                  <select
                    id="sale-given-to"
                    value={recipientEmployeeId}
                    onChange={(e) => setRecipientEmployeeId(e.target.value)}
                    required
                    className="w-full rounded-xl border border-navy/15 bg-cream/40 px-3.5 py-2.5 text-sm text-navy outline-none transition-colors focus:border-teal focus:ring-2 focus:ring-teal/20"
                  >
                    <option value="">Select a staff member…</option>
                    {employees.map((e) => (
                      <option key={e.id} value={e.id}>
                        {e.name}
                      </option>
                    ))}
                  </select>
                ) : (
                  <>
                    <Input
                      id="sale-given-to"
                      list="sale-given-to-names"
                      value={recipientName}
                      onChange={(e) => setRecipientName(e.target.value)}
                      placeholder="Name of the person or group"
                      required
                    />
                    <datalist id="sale-given-to-names">
                      {pastRecipients.map((n) => (
                        <option key={n} value={n} />
                      ))}
                    </datalist>
                  </>
                )}
              </div>
              </div>
            )}

            <div>
              <Label htmlFor="sale-item-search">{complimentary ? "Dish(es) given" : "Dish(es) sold"}</Label>
              {Object.keys(selectedItems).length > 0 && (
                <div className="mb-2 flex flex-wrap gap-1.5">
                  {Object.entries(selectedItems).map(([name, qty]) => (
                    <div
                      key={name}
                      className="flex items-center gap-1.5 rounded-full bg-teal/15 py-1 pl-2.5 pr-1.5 text-xs font-medium text-teal"
                    >
                      <button
                        type="button"
                        title="Left-click to add one, right-click to remove one, or scroll"
                        onClick={() => changeItemQty(name, 1)}
                        onContextMenu={(e) => {
                          e.preventDefault();
                          changeItemQty(name, -1);
                        }}
                        onWheel={(e) => {
                          e.preventDefault();
                          changeItemQty(name, e.deltaY < 0 ? 1 : -1);
                        }}
                        className="select-none"
                      >
                        {name} × {qty}
                      </button>
                      <button
                        type="button"
                        onClick={() => removeItem(name)}
                        aria-label={`Remove ${name}`}
                        className="text-teal/70 hover:text-teal"
                      >
                        ×
                      </button>
                    </div>
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
                    const active = name in selectedItems;
                    return (
                      <button
                        key={name}
                        type="button"
                        onClick={() => {
                          addItem(name);
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
              <Button type="submit" disabled={submitting || Object.keys(selectedItems).length === 0}>
                {complimentary ? "Log complimentary" : "Log sale"}
              </Button>
            </div>
          </form>
        </Card>

        <Card className="p-5">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-semibold text-navy">Today&apos;s sales</h3>
            <span className="text-right text-sm text-navy/60">
              {formatINR(salesTotal)} total
              {discountTotal > 0 && ` · ${formatINR(discountTotal)} discount`}
              {complimentaryCount > 0 && ` · ${complimentaryCount} complimentary`}
            </span>
          </div>
          {todaysSales.length === 0 ? (
            <p className="text-sm text-navy/50">No sales logged yet for this date.</p>
          ) : (
            <ul className="divide-y divide-navy/5">
              {todaysSales.map((s) => (
                <li key={s.id} className="py-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-navy/70">
                      {s.is_complimentary ? (
                        <span className="mr-1 rounded-full bg-coral/15 px-2 py-0.5 text-xs font-medium text-coral">
                          Complimentary
                        </span>
                      ) : (
                        s.payment_method
                      )}{" "}
                      {s.notes && `— ${s.notes}`}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-navy">{formatINR(s.amount_cents)}</span>
                      <IconButton
                        variant="danger"
                        onClick={() => handleDeleteSale(s.id)}
                        aria-label="Delete sale"
                      >
                        <TrashIcon />
                      </IconButton>
                    </div>
                  </div>
                  {(s.is_complimentary || s.discount_cents > 0) && (
                    <p className="mt-1 text-xs text-navy/60">
                      {s.discount_cents > 0 &&
                        `Total ${formatINR(s.amount_cents + s.discount_cents)}, discount ${formatINR(s.discount_cents)} · `}
                      {s.discount_reason || "No category"}
                      {" · to "}
                      {s.given_to || "unknown"}
                      {s.given_to_employee_id && " (staff)"}
                    </p>
                  )}
                  {s.item_names?.length > 0 && (
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {groupItemNames(s.item_names).map(({ name, quantity }) => (
                        <span
                          key={name}
                          className="rounded-full bg-teal/10 px-2 py-0.5 text-xs font-medium text-teal"
                        >
                          {name}
                          {quantity > 1 && ` ×${quantity}`}
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
