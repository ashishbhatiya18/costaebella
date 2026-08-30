"use client";

import { useState } from "react";
import { Button } from "@/components/admin/ui/button";
import { Input, Label } from "@/components/admin/ui/input";
import { Supplier } from "@/lib/pantrly/api";

export type DeliveryFormValue = {
  supplier_id: string | null;
  quantity: number;
  cost_cents: number | null;
  purchase_date: string;
  notes: string;
};

function today() {
  return new Date().toISOString().slice(0, 10);
}

export function RecordDeliveryForm({
  suppliers,
  onSubmit,
  onCancel,
}: {
  suppliers: Supplier[];
  onSubmit: (value: DeliveryFormValue) => Promise<void>;
  onCancel: () => void;
}) {
  const [supplierId, setSupplierId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [cost, setCost] = useState("");
  const [date, setDate] = useState(today());
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
    setSubmitting(true);
    setError(null);
    try {
      await onSubmit({
        supplier_id: supplierId || null,
        quantity: qty,
        cost_cents: cost ? Math.round(Number(cost) * 100) : null,
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
          <Input
            id="delivery-qty"
            type="number"
            step="any"
            min={0}
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            required
          />
        </div>
        <div>
          <Label htmlFor="delivery-date">Date</Label>
          <Input
            id="delivery-date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            required
          />
        </div>
      </div>
      <div>
        <Label htmlFor="delivery-cost">Cost (₹, optional)</Label>
        <Input
          id="delivery-cost"
          type="number"
          step="any"
          min={0}
          value={cost}
          onChange={(e) => setCost(e.target.value)}
          placeholder="Leave blank if unknown"
        />
        <p className="mt-1 text-xs text-navy/40">
          Only costed deliveries show up in Ledgerly&apos;s expense summary.
        </p>
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
