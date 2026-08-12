"use client";

import { useEffect, useMemo, useRef, useState, useReducer } from "react";
import { api, ApiError, AttendanceSummaryResponse, DayCategory, Employee } from "@/lib/shiftly/api";
import { Card } from "@/components/shiftly/ui/card";
import { Button } from "@/components/shiftly/ui/button";
import { SegmentedControl } from "@/components/shiftly/ui/segmented-control";
import { AttendanceOverrideModal } from "@/components/shiftly/attendance-override-modal";
import { getShiftSessionsForDate } from "@/lib/shiftly/shift-times";
import { clsx } from "@/lib/shiftly/clsx";
import { usePageTitle } from "@/lib/admin/use-page-title";

type RangeType = "week" | "month" | "quarter";

type Selection = {
  employeeId: string;
  employeeName: string;
  dates: Set<string>;
};

function today() {
  return new Date().toISOString().slice(0, 10);
}

const CATEGORY_STYLE: Record<
  DayCategory,
  { label: string; className: string; letter?: string }
> = {
  before_start: { label: "before joining", className: "bg-navy/5 text-navy/30" },
  weekly_off: { label: "weekly off", className: "bg-navy/10 text-navy/50" },
  weekly_off_worked: {
    label: "worked on weekly off",
    className: "bg-teal/15 text-teal ring-1 ring-teal/40",
  },
  leave: { label: "on leave", className: "bg-sand/40 text-navy ring-1 ring-sand", letter: "L" },
  unpaid_leave: {
    label: "unpaid leave (over allowance)",
    className: "bg-coral/25 text-coral ring-1 ring-coral/50",
    letter: "L",
  },
  absent: { label: "absent (0h worked)", className: "bg-coral/10 text-coral ring-1 ring-coral/30" },
  half_day: {
    label: "half day (5-7h worked)",
    className: "bg-amber-400/20 text-amber-700 ring-1 ring-amber-400/50",
    letter: "½",
  },
  full_day: {
    label: "full day (7-10h worked)",
    className: "bg-teal/20 text-teal ring-1 ring-teal/40",
  },
  full_day_ot: {
    label: "full day + overtime (>10h worked)",
    className: "bg-teal/20 text-teal ring-2 ring-coral/60",
  },
};

const LEGEND_ITEMS: { label: string; swatch: string }[] = [
  { label: "Full day", swatch: "bg-teal/50" },
  { label: "Full day + OT", swatch: "bg-teal/50 ring-2 ring-coral" },
  { label: "Half day", swatch: "bg-amber-400/50" },
  { label: "Absent", swatch: "bg-coral/40" },
  { label: "Weekly off", swatch: "bg-navy/20" },
  { label: "Weekly off (worked)", swatch: "bg-teal/40" },
  { label: "Leave", swatch: "bg-sand" },
  { label: "Unpaid leave", swatch: "bg-coral/60" },
  { label: "Before joining", swatch: "bg-navy/10" },
];

export default function AttendanceSummaryPage() {
  usePageTitle("Attendance Summary");
  const [range, setRange] = useState<RangeType>("week");
  const [data, setData] = useState<AttendanceSummaryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [override, setOverride] = useState<{
    employee: Employee;
    date: string;
  } | null>(null);
  const [bulkSaving, setBulkSaving] = useState(false);
  const [bulkError, setBulkError] = useState<string | null>(null);
  const [, forceRender] = useReducer((x: number) => x + 1, 0);

  const draggingRef = useRef(false);
  const selectionRef = useRef<Selection | null>(null);

  const employeesById = useMemo(() => {
    const map: Record<string, Employee> = {};
    for (const e of employees) map[e.id] = e;
    return map;
  }, [employees]);

  function load() {
    setLoading(true);
    return api
      .attendanceSummary(range, today())
      .then(setData)
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    api.listEmployees().then((data) => setEmployees(data ?? []));
  }, []);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range]);

  // Finalizes a drag gesture. Deliberately does NOT open the modal itself —
  // that's handled by each cell's onClick instead, since the native click
  // event already fires exactly once, exactly on tap/click (and not at all
  // after a real drag), for both mouse and touch. Reimplementing that via
  // mouseup/touchend timing was racing against the browser's own synthetic
  // click on touch devices, closing the modal right after it opened.
  function finishSelection() {
    if (!draggingRef.current) return;
    draggingRef.current = false;

    const sel = selectionRef.current;
    if (sel && sel.dates.size === 1) {
      // Single tap/click — clear the drag selection and let onClick open
      // the modal.
      selectionRef.current = null;
    }
    forceRender();
  }

  useEffect(() => {
    window.addEventListener("mouseup", finishSelection);
    window.addEventListener("touchend", finishSelection);
    window.addEventListener("touchcancel", finishSelection);
    return () => {
      window.removeEventListener("mouseup", finishSelection);
      window.removeEventListener("touchend", finishSelection);
      window.removeEventListener("touchcancel", finishSelection);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [employeesById]);

  // Opens the single-day override modal. Only called by a genuine
  // click/tap (the browser suppresses click entirely after a real drag), but
  // guard against the rare case where a mouse drag starts and ends on the
  // same cell while still having touched others in between.
  function handleDayClick(employeeId: string, date: string) {
    const sel = selectionRef.current;
    if (sel && sel.dates.size > 1) return;
    const employee = employeesById[employeeId];
    if (employee) setOverride({ employee, date });
  }

  function beginSelection(employeeId: string, employeeName: string, date: string) {
    draggingRef.current = true;
    selectionRef.current = { employeeId, employeeName, dates: new Set([date]) };
    forceRender();
  }

  function extendSelection(employeeId: string, date: string) {
    if (!draggingRef.current) return;
    const sel = selectionRef.current;
    if (!sel || sel.employeeId !== employeeId) return;
    sel.dates.add(date);
    forceRender();
  }

  // Touch doesn't fire per-element hover events like mouseenter does, so we
  // hit-test whatever's under the finger on each touchmove instead.
  function handleTouchMove(e: React.TouchEvent) {
    if (!draggingRef.current) return;
    e.preventDefault();
    const touch = e.touches[0];
    const el = document.elementFromPoint(touch.clientX, touch.clientY) as HTMLElement | null;
    const employeeId = el?.dataset.employeeId;
    const date = el?.dataset.date;
    if (employeeId && date) extendSelection(employeeId, date);
  }

  function clearSelection() {
    selectionRef.current = null;
    forceRender();
  }

  async function bulkMark(mode: "present" | "leave") {
    const sel = selectionRef.current;
    const employee = sel ? employeesById[sel.employeeId] : null;
    if (!sel || !employee) return;

    setBulkSaving(true);
    setBulkError(null);
    try {
      await Promise.all(
        Array.from(sel.dates).map((date) => {
          if (mode === "leave") {
            return api.overrideAttendance({
              employee_id: sel.employeeId,
              date,
              is_leave: true,
              sessions: [],
            });
          }
          return api.overrideAttendance({
            employee_id: sel.employeeId,
            date,
            is_leave: false,
            sessions: getShiftSessionsForDate(employee, date),
          });
        }),
      );
      selectionRef.current = null;
      await load();
    } catch (err) {
      setBulkError(err instanceof ApiError ? err.message : "Failed to apply bulk update.");
    } finally {
      setBulkSaving(false);
      forceRender();
    }
  }

  const selection = selectionRef.current;
  const showBulkBar = !!selection && selection.dates.size > 1;

  return (
    <div className="select-none">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl text-navy">Attendance Summary</h1>
          <p className="mt-1 text-sm text-navy/60">
            {data ? `${data.from} → ${data.to}` : "Loading range…"}
          </p>
        </div>
        <SegmentedControl
          value={range}
          onChange={setRange}
          options={[
            { label: "Week", value: "week" },
            { label: "Month", value: "month" },
            { label: "Quarter", value: "quarter" },
          ]}
        />
      </div>

      {loading && <p className="text-sm text-navy/60">Loading…</p>}

      {!loading && data && data.employees.length === 0 && (
        <Card className="p-10 text-center text-navy/50">
          No employees to show yet.
        </Card>
      )}

      <div className="space-y-4 pb-20">
        {data?.employees.map((emp) => (
          <Card key={emp.employee_id} className="p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="font-semibold text-navy">{emp.employee_name}</h3>
                <p className="text-xs text-navy/50">
                  {emp.actual_days}/{emp.expected_days} expected days ·{" "}
                  {emp.actual_hours.toFixed(1)}h / {emp.expected_hours.toFixed(1)}h
                </p>
              </div>
              <span
                className={clsx(
                  "rounded-full px-3 py-1 text-sm font-semibold",
                  emp.attendance_pct >= 90
                    ? "bg-teal/15 text-teal"
                    : emp.attendance_pct >= 70
                      ? "bg-amber-400/20 text-amber-700"
                      : "bg-coral/15 text-coral",
                )}
              >
                {emp.attendance_pct.toFixed(0)}%
              </span>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {emp.days.map((day) => {
                const isSelected =
                  selection?.employeeId === emp.employee_id &&
                  selection.dates.has(day.date);
                const style = CATEGORY_STYLE[day.category];
                return (
                  <button
                    key={day.date}
                    data-employee-id={emp.employee_id}
                    data-date={day.date}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      beginSelection(emp.employee_id, emp.employee_name, day.date);
                    }}
                    onMouseEnter={() => extendSelection(emp.employee_id, day.date)}
                    onTouchStart={() =>
                      beginSelection(emp.employee_id, emp.employee_name, day.date)
                    }
                    onTouchMove={handleTouchMove}
                    onClick={() => handleDayClick(emp.employee_id, day.date)}
                    title={`${day.date} — ${style.label}${
                      day.expected_hours > 0
                        ? ` (${day.hours_worked.toFixed(1)}h / ${day.expected_hours.toFixed(1)}h, ${day.hours_pct.toFixed(0)}%)`
                        : day.hours_worked > 0
                          ? ` (${day.hours_worked.toFixed(1)}h worked)`
                          : ""
                    }${day.auto_logout ? " · auto logged out" : ""} — click, or click-drag to select multiple`}
                    className={clsx(
                      "relative flex h-9 w-9 items-center justify-center rounded-lg text-[11px] font-medium transition-transform hover:scale-105",
                      style.className,
                      day.auto_logout && "ring-2 ring-amber-400/70",
                      isSelected && "ring-2 ring-teal",
                    )}
                  >
                    {style.letter ?? new Date(day.date + "T00:00:00").getDate()}
                    {day.auto_logout && (
                      <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-amber-500" />
                    )}
                  </button>
                );
              })}
            </div>

            <div className="mt-3 flex flex-wrap gap-4 text-xs text-navy/50">
              {LEGEND_ITEMS.map((item) => (
                <span key={item.label} className="flex items-center gap-1.5">
                  <span className={clsx("h-2.5 w-2.5 rounded-sm", item.swatch)} /> {item.label}
                </span>
              ))}
            </div>
            <p className="mt-2 text-xs text-navy/40">
              Click a day to override it, or click-and-drag across days to select multiple.
            </p>
          </Card>
        ))}
      </div>

      {showBulkBar && selection && (
        <div className="fixed inset-x-0 bottom-16 z-40 flex justify-center px-4 pb-2 lg:bottom-0 lg:pb-6">
          <div className="flex flex-wrap items-center justify-center gap-3 rounded-2xl border border-navy/15 bg-white px-5 py-3 shadow-2xl">
            <span className="text-sm text-navy">
              {selection.dates.size} days selected — {selection.employeeName}
            </span>
            {bulkError && <span className="text-sm text-coral">{bulkError}</span>}
            <Button size="sm" variant="ghost" onClick={clearSelection} disabled={bulkSaving}>
              Cancel
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => bulkMark("leave")}
              disabled={bulkSaving}
            >
              Mark as leave
            </Button>
            <Button size="sm" onClick={() => bulkMark("present")} disabled={bulkSaving}>
              {bulkSaving ? "Saving…" : "Mark as present"}
            </Button>
          </div>
        </div>
      )}

      {override && (
        <AttendanceOverrideModal
          employee={override.employee}
          date={override.date}
          onClose={() => setOverride(null)}
          onSaved={() => {
            setOverride(null);
            load();
          }}
        />
      )}
    </div>
  );
}
