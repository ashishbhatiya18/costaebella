"use client";

import { useState } from "react";
import { Button } from "@/components/admin/ui/button";
import { Input, Label } from "@/components/admin/ui/input";
import { Advance } from "@/lib/shiftly/api";

export type AdvanceFormValue = {
  employee_id: string;
  amount_cents: number;
  advance_date: string;
  notes: string;
};

function today() {
  return new Date().toISOString().slice(0, 10);
}

export function AdvanceForm({
  initial,
  employees,
  onSubmit,
  onCancel,
  submitLabel,
}: {
  initial?: Advance;
  employees: { id: string; name: string }[];
  onSubmit: (value: AdvanceFormValue) => Promise<void>;
  onCancel: () => void;
  submitLabel: string;
}) {
  const [employeeId, setEmployeeId] = useState(initial?.employee_id ?? employees[0]?.id ?? "");
  const [amount, setAmount] = useState(initial ? String(initial.amount_cents / 100) : "");
  const [date, setDate] = useState(initial?.advance_date ?? today());
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const amountCents = Math.round(Number(amount) * 100);
    if (!employeeId) {
      setError("Select an employee.");
      return;
    }
    if (!amountCents || amountCents <= 0) {
      setError("Enter a valid amount.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await onSubmit({
        employee_id: employeeId,
        amount_cents: amountCents,
        advance_date: date,
        notes,
      });
    } catch {
      setError("Failed to save advance.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label htmlFor="advance-employee">Employee</Label>
        <select
          id="advance-employee"
          value={employeeId}
          onChange={(e) => setEmployeeId(e.target.value)}
          className="w-full rounded-xl border border-navy/15 bg-cream/40 px-3.5 py-2.5 text-sm text-navy outline-none transition-colors focus:border-teal focus:ring-2 focus:ring-teal/20"
        >
          {employees.map((e) => (
            <option key={e.id} value={e.id}>
              {e.name}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="advance-amount">Amount (₹)</Label>
          <Input
            id="advance-amount"
            type="number"
            step="any"
            min={0}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            required
          />
        </div>
        <div>
          <Label htmlFor="advance-date">Date</Label>
          <Input id="advance-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
        </div>
      </div>

      <div>
        <Label htmlFor="advance-notes">Notes</Label>
        <Input id="advance-notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
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
