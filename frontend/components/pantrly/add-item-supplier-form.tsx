"use client";

import { useState } from "react";
import { Button } from "@/components/admin/ui/button";
import { Label } from "@/components/admin/ui/input";
import { Supplier } from "@/lib/pantrly/api";

export function AddItemSupplierForm({
  suppliers,
  linkedSupplierIds,
  onSubmit,
  onCancel,
}: {
  suppliers: Supplier[];
  linkedSupplierIds: string[];
  onSubmit: (supplierId: string) => Promise<void>;
  onCancel: () => void;
}) {
  const available = suppliers.filter((s) => !linkedSupplierIds.includes(s.id));
  const [supplierId, setSupplierId] = useState(available[0]?.id ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!supplierId) {
      setError("Select a supplier.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await onSubmit(supplierId);
    } catch {
      setError("Failed to add supplier.");
    } finally {
      setSubmitting(false);
    }
  }

  if (available.length === 0) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-navy/60">
          {suppliers.length === 0
            ? "No suppliers yet — add one on the Suppliers page first."
            : "All suppliers are already linked to this item."}
        </p>
        <div className="flex justify-end">
          <Button variant="secondary" onClick={onCancel}>
            Close
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label htmlFor="item-supplier">Supplier</Label>
        <select
          id="item-supplier"
          value={supplierId}
          onChange={(e) => setSupplierId(e.target.value)}
          className="w-full rounded-xl border border-navy/15 bg-cream/40 px-3.5 py-2.5 text-sm text-navy outline-none transition-colors focus:border-teal focus:ring-2 focus:ring-teal/20"
        >
          {available.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </div>

      {error && <p className="text-sm text-coral">{error}</p>}

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={submitting}>
          Add supplier
        </Button>
      </div>
    </form>
  );
}
