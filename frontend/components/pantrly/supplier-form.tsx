"use client";

import { useState } from "react";
import { Button } from "@/components/admin/ui/button";
import { Input, Label } from "@/components/admin/ui/input";
import { Supplier } from "@/lib/pantrly/api";

export type SupplierFormValue = {
  name: string;
  phone: string;
  notes: string;
  // Sent on every save: the backend's update replaces the whole supplier,
  // so omitting `active` used to deactivate a supplier on each edit.
  active: boolean;
  is_emergency: boolean;
};

export function SupplierForm({
  initial,
  onSubmit,
  onCancel,
  submitLabel,
}: {
  initial?: Supplier;
  onSubmit: (value: SupplierFormValue) => Promise<void>;
  onCancel: () => void;
  submitLabel: string;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [phone, setPhone] = useState(initial?.phone ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [isEmergency, setIsEmergency] = useState(initial?.is_emergency ?? false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await onSubmit({
        name,
        phone,
        notes,
        active: initial?.active ?? true,
        is_emergency: isEmergency,
      });
    } catch {
      setError("Failed to save supplier.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label htmlFor="supplier-name">Name</Label>
        <Input id="supplier-name" value={name} onChange={(e) => setName(e.target.value)} required />
      </div>
      <div>
        <Label htmlFor="supplier-phone">Phone</Label>
        <Input id="supplier-phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
      </div>
      <div>
        <Label htmlFor="supplier-notes">Notes</Label>
        <Input id="supplier-notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
      </div>
      <label className="flex items-start gap-3 rounded-xl border border-navy/10 bg-cream/40 p-3 text-sm text-navy">
        <input
          type="checkbox"
          checked={isEmergency}
          onChange={(e) => setIsEmergency(e.target.checked)}
          className="mt-0.5 h-4 w-4 accent-teal"
        />
        <span>
          <span className="font-medium">Emergency / quick-commerce source</span>
          <span className="mt-0.5 block text-xs text-navy/60">
            Bought from only when stock runs out (e.g. Blinkit). The Rate Card keeps these deliveries out of regular
            rates and shows them as emergency buys with the premium paid.
          </span>
        </span>
      </label>

      {error && <p className="text-sm text-coral">{error}</p>}

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={submitting}>
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
