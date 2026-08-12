"use client";

import { useState } from "react";
import { Employee, ShiftInterval } from "@/lib/shiftly/api";
import { Button } from "@/components/shiftly/ui/button";
import { Input, Label } from "@/components/shiftly/ui/input";

const DAYS = [
  { value: 0, label: "Sun" },
  { value: 1, label: "Mon" },
  { value: 2, label: "Tue" },
  { value: 3, label: "Wed" },
  { value: 4, label: "Thu" },
  { value: 5, label: "Fri" },
  { value: 6, label: "Sat" },
];

export type EmployeeFormValue = Omit<Employee, "id" | "active" | "created_at" | "updated_at">;

export function EmployeeForm({
  initial,
  onSubmit,
  onCancel,
  submitLabel = "Save",
}: {
  initial?: EmployeeFormValue;
  onSubmit: (value: EmployeeFormValue) => Promise<void>;
  onCancel: () => void;
  submitLabel?: string;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [shiftName, setShiftName] = useState(initial?.shift_name ?? "");
  const [monthlyPay, setMonthlyPay] = useState(
    initial ? String(initial.monthly_pay_cents / 100) : "",
  );
  const [committedDays, setCommittedDays] = useState<number[]>(
    initial?.committed_working_days ?? [1, 2, 3, 4, 5],
  );
  const [permittedLeaves, setPermittedLeaves] = useState(
    String(initial?.permitted_leaves_per_month ?? 2),
  );
  const [startDate, setStartDate] = useState(
    initial?.start_date ?? new Date().toISOString().slice(0, 10),
  );
  const [intervals, setIntervals] = useState<ShiftInterval[]>(
    initial?.shift_intervals?.length
      ? initial.shift_intervals
      : [{ day_of_week: null, start_time: "09:00", end_time: "17:00" }],
  );
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function toggleDay(day: number) {
    setCommittedDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort(),
    );
  }

  function updateInterval(idx: number, patch: Partial<ShiftInterval>) {
    setIntervals((prev) =>
      prev.map((iv, i) => (i === idx ? { ...iv, ...patch } : iv)),
    );
  }

  function addInterval() {
    setIntervals((prev) => [
      ...prev,
      { day_of_week: null, start_time: "09:00", end_time: "17:00" },
    ]);
  }

  function removeInterval(idx: number) {
    setIntervals((prev) => prev.filter((_, i) => i !== idx));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError("Name is required.");
      return;
    }
    const payCents = Math.round(parseFloat(monthlyPay || "0") * 100);
    if (Number.isNaN(payCents) || payCents < 0) {
      setError("Monthly pay must be a valid amount.");
      return;
    }

    setSaving(true);
    try {
      await onSubmit({
        name: name.trim(),
        shift_name: shiftName.trim(),
        monthly_pay_cents: payCents,
        committed_working_days: committedDays,
        permitted_leaves_per_month: parseInt(permittedLeaves || "0", 10),
        start_date: startDate,
        shift_intervals: intervals,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save employee.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <Label htmlFor="name">Name</Label>
        <Input
          id="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Priya Nair"
          required
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="shift_name">Shift name</Label>
          <Input
            id="shift_name"
            value={shiftName}
            onChange={(e) => setShiftName(e.target.value)}
            placeholder="e.g. Morning"
          />
        </div>
        <div>
          <Label htmlFor="monthly_pay">Monthly pay (₹)</Label>
          <Input
            id="monthly_pay"
            type="number"
            min="0"
            step="0.01"
            value={monthlyPay}
            onChange={(e) => setMonthlyPay(e.target.value)}
            placeholder="25000"
          />
        </div>
      </div>

      <div>
        <Label htmlFor="start_date">Start date</Label>
        <Input
          id="start_date"
          type="date"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
          className="max-w-[200px]"
          required
        />
        <p className="mt-1.5 text-xs text-navy/50">
          Attendance is only tracked from this date. If it falls mid-month,
          salary and permitted leaves are prorated automatically.
        </p>
      </div>

      <div>
        <Label>Committed working days</Label>
        <div className="flex flex-wrap gap-2">
          {DAYS.map((d) => (
            <button
              key={d.value}
              type="button"
              onClick={() => toggleDay(d.value)}
              className={
                "rounded-lg px-3 py-1.5 text-sm font-medium transition-colors " +
                (committedDays.includes(d.value)
                  ? "bg-teal text-white"
                  : "bg-navy/5 text-navy/50 hover:bg-navy/10")
              }
            >
              {d.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <Label htmlFor="permitted_leaves">Permitted leaves / month</Label>
        <Input
          id="permitted_leaves"
          type="number"
          min="0"
          value={permittedLeaves}
          onChange={(e) => setPermittedLeaves(e.target.value)}
          className="max-w-[160px]"
        />
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <Label className="mb-0">Working hour intervals</Label>
          <button
            type="button"
            onClick={addInterval}
            className="text-xs font-medium text-teal hover:text-teal/80"
          >
            + Add interval
          </button>
        </div>
        <div className="space-y-2">
          {intervals.map((iv, idx) => (
            <div
              key={idx}
              className="flex flex-wrap items-center gap-2 rounded-xl border border-navy/10 bg-cream/30 p-2.5"
            >
              <select
                value={iv.day_of_week ?? "all"}
                onChange={(e) =>
                  updateInterval(idx, {
                    day_of_week:
                      e.target.value === "all" ? null : parseInt(e.target.value, 10),
                  })
                }
                className="rounded-lg border border-navy/15 bg-white px-2 py-1.5 text-sm text-navy"
              >
                <option value="all">Every day</option>
                {DAYS.map((d) => (
                  <option key={d.value} value={d.value}>
                    {d.label}
                  </option>
                ))}
              </select>
              <input
                type="time"
                value={iv.start_time}
                onChange={(e) => updateInterval(idx, { start_time: e.target.value })}
                className="rounded-lg border border-navy/15 bg-white px-2 py-1.5 text-sm text-navy"
              />
              <span className="text-navy/50">to</span>
              <input
                type="time"
                value={iv.end_time}
                onChange={(e) => updateInterval(idx, { end_time: e.target.value })}
                className="rounded-lg border border-navy/15 bg-white px-2 py-1.5 text-sm text-navy"
              />
              {intervals.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeInterval(idx)}
                  className="ml-auto text-navy/40 hover:text-coral"
                >
                  ✕
                </button>
              )}
            </div>
          ))}
        </div>
        <p className="mt-1.5 text-xs text-navy/50">
          Add multiple intervals for split shifts. Intervals must not overlap,
          and total hours for any single day cannot exceed 9h.
        </p>
      </div>

      {error && (
        <p className="rounded-lg bg-coral/10 px-3 py-2 text-sm text-coral">
          {error}
        </p>
      )}

      <div className="flex justify-end gap-3 pt-2">
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={saving}>
          {saving ? "Saving…" : submitLabel}
        </Button>
      </div>
    </form>
  );
}
