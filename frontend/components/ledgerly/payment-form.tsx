"use client";

import { useState } from "react";
import { Button } from "@/components/admin/ui/button";
import { Input, Label } from "@/components/admin/ui/input";
import { Category, Payment } from "@/lib/ledgerly/api";

export type PaymentFormValue = {
  category: Category;
  amount_cents: number;
  payment_date: string;
  payment_method: string;
  payee: string;
  employee_id: string | null;
  supplier_id: string | null;
  notes: string;
};

const CATEGORY_OPTIONS: { label: string; value: Category }[] = [
  { label: "Rent", value: "rent" },
  { label: "Utilities", value: "utilities" },
  { label: "Supplier purchase", value: "supplier_purchase" },
  { label: "Salary", value: "salary" },
  { label: "Maintenance", value: "maintenance" },
  { label: "Marketing", value: "marketing" },
  { label: "Licenses & fees", value: "licenses_fees" },
  { label: "Transport", value: "transport" },
  { label: "Equipment", value: "equipment" },
  { label: "Other", value: "other" },
];

function today() {
  return new Date().toISOString().slice(0, 10);
}

export function PaymentForm({
  initial,
  employees,
  suppliers,
  onSubmit,
  onCancel,
  submitLabel,
}: {
  initial?: Payment;
  employees: { id: string; name: string }[];
  suppliers: { id: string; name: string }[];
  onSubmit: (value: PaymentFormValue) => Promise<void>;
  onCancel: () => void;
  submitLabel: string;
}) {
  const [category, setCategory] = useState<Category>(initial?.category ?? "other");
  const [amount, setAmount] = useState(initial ? String(initial.amount_cents / 100) : "");
  const [date, setDate] = useState(initial?.payment_date ?? today());
  const [method, setMethod] = useState(initial?.payment_method ?? "cash");
  const [payee, setPayee] = useState(initial?.payee ?? "");
  const [employeeId, setEmployeeId] = useState(initial?.employee_id ?? "");
  const [supplierId, setSupplierId] = useState(initial?.supplier_id ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const amountCents = Math.round(Number(amount) * 100);
    if (!amountCents || amountCents <= 0) {
      setError("Enter a valid amount.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await onSubmit({
        category,
        amount_cents: amountCents,
        payment_date: date,
        payment_method: method,
        payee,
        employee_id: category === "salary" ? employeeId || null : null,
        supplier_id: category === "supplier_purchase" ? supplierId || null : null,
        notes,
      });
    } catch {
      setError("Failed to save expense.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label htmlFor="payment-category">Category</Label>
        <select
          id="payment-category"
          value={category}
          onChange={(e) => setCategory(e.target.value as Category)}
          className="w-full rounded-xl border border-navy/15 bg-cream/40 px-3.5 py-2.5 text-sm text-navy outline-none transition-colors focus:border-teal focus:ring-2 focus:ring-teal/20"
        >
          {CATEGORY_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>

      {category === "salary" && (
        <div>
          <Label htmlFor="payment-employee">Employee (optional)</Label>
          <select
            id="payment-employee"
            value={employeeId}
            onChange={(e) => setEmployeeId(e.target.value)}
            className="w-full rounded-xl border border-navy/15 bg-cream/40 px-3.5 py-2.5 text-sm text-navy outline-none transition-colors focus:border-teal focus:ring-2 focus:ring-teal/20"
          >
            <option value="">— none —</option>
            {employees.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {category === "supplier_purchase" && (
        <div>
          <Label htmlFor="payment-supplier">Supplier (optional)</Label>
          <select
            id="payment-supplier"
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
      )}

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="payment-amount">Amount (₹)</Label>
          <Input
            id="payment-amount"
            type="number"
            step="any"
            min={0}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            required
          />
        </div>
        <div>
          <Label htmlFor="payment-date">Date</Label>
          <Input id="payment-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="payment-payee">Payee / purpose</Label>
          <Input id="payment-payee" value={payee} onChange={(e) => setPayee(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="payment-method">Payment method</Label>
          <select
            id="payment-method"
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
        <Label htmlFor="payment-notes">Notes</Label>
        <Input id="payment-notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
      </div>

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
