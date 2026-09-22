"use client";

import { useState } from "react";
import { Employee } from "@/lib/shiftly/api";
import { Button } from "@/components/admin/ui/button";
import { Input, Label } from "@/components/admin/ui/input";

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
  const [weeklyOffDays, setWeeklyOffDays] = useState<number[]>(
    initial?.weekly_off_days ?? [0],
  );
  const [eligibleHoursPerDay, setEligibleHoursPerDay] = useState(
    String(initial?.eligible_hours_per_day ?? 9),
  );
  const [startDate, setStartDate] = useState(
    initial?.start_date ?? new Date().toISOString().slice(0, 10),
  );
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function toggleOffDay(day: number) {
    setWeeklyOffDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort(),
    );
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
    const hoursPerDay = parseFloat(eligibleHoursPerDay || "0");
    if (Number.isNaN(hoursPerDay) || hoursPerDay <= 0 || hoursPerDay > 24) {
      setError("Eligible hours per day must be greater than 0 and at most 24.");
      return;
    }

    setSaving(true);
    try {
      await onSubmit({
        name: name.trim(),
        shift_name: shiftName.trim(),
        monthly_pay_cents: payCents,
        weekly_off_days: weeklyOffDays,
        eligible_hours_per_day: hoursPerDay,
        start_date: startDate,
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
          pay for that month is naturally lower since it&apos;s based on
          hours worked from this date onward.
        </p>
      </div>

      <div>
        <Label>Weekly off day(s)</Label>
        <div className="flex flex-wrap gap-2">
          {DAYS.map((d) => (
            <button
              key={d.value}
              type="button"
              onClick={() => toggleOffDay(d.value)}
              className={
                "rounded-lg px-3 py-1.5 text-sm font-medium transition-colors " +
                (weeklyOffDays.includes(d.value)
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
        <Label htmlFor="eligible_hours_per_day">Eligible hours per day</Label>
        <Input
          id="eligible_hours_per_day"
          type="number"
          min="0"
          max="24"
          step="0.5"
          value={eligibleHoursPerDay}
          onChange={(e) => setEligibleHoursPerDay(e.target.value)}
          className="max-w-[160px]"
        />
      </div>
      <p className="-mt-3 text-xs text-navy/50">
        Used to compute the flat hourly rate: monthly pay ÷ (working days in
        the month × eligible hours per day). Working days = days in the month
        minus the actual number of selected weekly-off day(s) that occur that
        month.
      </p>

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
