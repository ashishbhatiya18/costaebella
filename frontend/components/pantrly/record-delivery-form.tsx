"use client";

import { useState } from "react";
import { Button } from "@/components/admin/ui/button";
import { Input, Label } from "@/components/admin/ui/input";
import { Supplier } from "@/lib/pantrly/api";
import { OPENING_DATE, todayStr } from "@/lib/admin/period";
import { formatDate } from "@/lib/admin/format";

export type DeliveryFormValue = {
  supplier_id: string | null;
  quantity: number;
  cost_cents: number;
  payment_method: string;
  purchase_date: string;
  notes: string;
};

export function RecordDeliveryForm({
  suppliers,
  unit,
  onSubmit,
  onCancel,
}: {
  suppliers: Supplier[];
  unit: string;
  onSubmit: (value: DeliveryFormValue) => Promise<void>;
  onCancel: () => void;
}) {
  const [supplierId, setSupplierId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [cost, setCost] = useState("");
  const [method, setMethod] = useState("upi");
  const [date, setDate] = useState(todayStr());
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const qty = Number(quantity);
    if (!qty || qty <= 0) {
      setError("Quantity must be greater than 0.");
      return;
    }
    const costValue = Number(cost);
    if (!cost || isNaN(costValue) || costValue <= 0) {
      setError("Cost is required.");
      return;
    }
    // A future or pre-opening date is always a slip (e.g. the month left on
    // the wrong value while typing the day) — catch it before it's saved.
    if (date > todayStr()) {
      setError("Date can't be in the future.");
      return;
    }
    if (date < OPENING_DATE) {
      setError(`Date can't be before the restaurant opened (${formatDate(OPENING_DATE)}).`);
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await onSubmit({
        supplier_id: supplierId || null,
        quantity: qty,
        cost_cents: Math.round(costValue * 100),
        payment_method: method,
        purchase_date: date,
        notes,
      });
    } catch {
      setError("Failed to record delivery.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label htmlFor="delivery-supplier">Supplier</Label>
        <select
          id="delivery-supplier"
          value={supplierId}
          onChange={(e) => setSupplierId(e.target.value)}
          className="w-full rounded-xl border border-navy/15 bg-cream/40 px-3.5 py-2.5 text-sm text-navy outline-none transition-colors focus:border-teal focus:ring-2 focus:ring-teal/20"
        >
          <option value="">— none —</option>
          {suppliers.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="delivery-qty">Quantity received</Label>
          <div className="flex items-center gap-2">
            <Input
              id="delivery-qty"
              type="number"
              step="any"
              min={0}
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              required
              className="flex-1"
            />
            <span className="whitespace-nowrap rounded-lg bg-navy/5 px-2.5 py-2 text-sm text-navy/50">
              {unit}
            </span>
          </div>
        </div>
        <div>
          <Label htmlFor="delivery-date">Date</Label>
          <Input
            id="delivery-date"
            type="date"
            min={OPENING_DATE}
            max={todayStr()}
            value={date}
            onChange={(e) => setDate(e.target.value)}
            required
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="delivery-cost">Cost (₹)</Label>
          <Input
            id="delivery-cost"
            type="number"
            step="any"
            min={0}
            value={cost}
            onChange={(e) => setCost(e.target.value)}
            required
          />
        </div>
        <div>
          <Label htmlFor="delivery-method">Payment method</Label>
          <select
            id="delivery-method"
            value={method}
            onChange={(e) => setMethod(e.target.value)}
            className="w-full rounded-xl border border-navy/15 bg-cream/40 px-3.5 py-2.5 text-sm text-navy outline-none transition-colors focus:border-teal focus:ring-2 focus:ring-teal/20"
          >
            <option value="cash">Cash</option>
            <option value="bank">Bank</option>
            <option value="upi">UPI</option>
            <option value="other">Other</option>
          </select>
        </div>
      </div>
      <div>
        <Label htmlFor="delivery-notes">Notes</Label>
        <Input id="delivery-notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
      </div>

      {error && <p className="text-sm text-coral">{error}</p>}

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={submitting}>
          Record delivery
        </Button>
      </div>
    </form>
  );
}
