"use client";

import { useState } from "react";
import { clsx } from "@/lib/admin/clsx";
import {
  PeriodType,
  currentPeriodLabel,
  isCurrentPeriod,
  periodLabel,
  shiftAnchor,
  todayStr,
} from "@/lib/admin/period";

function Chevron({ direction }: { direction: "left" | "right" }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d={direction === "left" ? "M15 6l-6 6 6 6" : "M9 6l6 6-6 6"}
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// ‹ prev | label | next › stepper for any page that shows one
// day/week/month/quarter at a time. `anchor` is any YYYY-MM-DD inside the
// period; stepping returns the new period's start date. Date math (and the
// Monday week start, matching the backend) lives in lib/admin/period.ts.
//
// "Next" stops at the current period by default — every period-scoped view
// in the admin is historical data, so there's nothing to see in the future.
//
// Months get a richer picker: ‹ [Aug 2026] [Sep 2026] [Oct 2026] › — three
// directly clickable months (the current month and the two before it by
// default), with the arrows stepping one month back/forward and the
// three-month window sliding along to keep the selection in view. No
// "This month" shortcut here — the › arrow gets back to it.
export function PeriodNavigator({
  type,
  anchor,
  onChange,
  allowFuture = false,
  label,
  className,
}: {
  type: PeriodType;
  anchor: string;
  onChange: (anchor: string) => void;
  allowFuture?: boolean;
  /** Overrides the computed period label (e.g. for a multi-period window). */
  label?: string;
  className?: string;
}) {
  const isCurrent = isCurrentPeriod(type, anchor);
  const next = shiftAnchor(type, anchor, 1);
  const nextDisabled = !allowFuture && (isCurrent || next > todayStr());

  if (type === "month") {
    return (
      <MonthWindow
        anchor={anchor}
        onChange={onChange}
        nextDisabled={nextDisabled}
        // A custom label (e.g. "Custom range" for free from/to dates) means
        // the range isn't exactly one month, so no month chip is selected.
        hasSelection={label === undefined || label === periodLabel("month", anchor)}
        className={className}
      />
    );
  }

  return (
    <div className={clsx("inline-flex flex-wrap items-center gap-2", className)}>
      <div className="inline-flex items-center rounded-xl border border-navy/10 bg-cream/60 p-1">
        <button
          type="button"
          onClick={() => onChange(shiftAnchor(type, anchor, -1))}
          aria-label={`Previous ${type}`}
          className="rounded-lg p-1.5 text-navy/60 transition-colors hover:bg-white hover:text-navy focus:outline-none focus-visible:ring-2 focus-visible:ring-teal/40"
        >
          <Chevron direction="left" />
        </button>
        <span className="min-w-[8.5rem] px-2 text-center text-sm font-medium tabular-nums text-navy">
          {label ?? periodLabel(type, anchor)}
        </span>
        <button
          type="button"
          onClick={() => onChange(next)}
          disabled={nextDisabled}
          aria-label={`Next ${type}`}
          className="rounded-lg p-1.5 text-navy/60 transition-colors hover:bg-white hover:text-navy focus:outline-none focus-visible:ring-2 focus-visible:ring-teal/40 disabled:pointer-events-none disabled:text-navy/20"
        >
          <Chevron direction="right" />
        </button>
      </div>
      {!isCurrent && (
        <button
          type="button"
          onClick={() => onChange(todayStr())}
          className="rounded-lg px-2 py-1 text-sm font-medium text-teal transition-colors hover:bg-teal/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal/40"
        >
          {currentPeriodLabel(type)}
        </button>
      )}
    </div>
  );
}

const WINDOW_SIZE = 3;

function MonthWindow({
  anchor,
  onChange,
  nextDisabled,
  hasSelection,
  className,
}: {
  anchor: string;
  onChange: (anchor: string) => void;
  nextDisabled: boolean;
  hasSelection: boolean;
  className?: string;
}) {
  const selected = shiftAnchor("month", anchor, 0); // first of the selected month
  const currentMonth = shiftAnchor("month", todayStr(), 0);

  // Start (first of month) of the leftmost of the three visible months.
  // Defaults to ending on the current month (or on the selection, if it's
  // later); only slides when the selection steps outside the window, so
  // clicking a visible chip never makes the chips jump around.
  const [windowStart, setWindowStart] = useState(() =>
    shiftAnchor("month", selected > currentMonth ? selected : currentMonth, -(WINDOW_SIZE - 1)),
  );
  const windowEnd = shiftAnchor("month", windowStart, WINDOW_SIZE - 1);
  if (selected < windowStart) {
    setWindowStart(selected);
  } else if (selected > windowEnd) {
    setWindowStart(shiftAnchor("month", selected, -(WINDOW_SIZE - 1)));
  }

  const months = Array.from({ length: WINDOW_SIZE }, (_, i) => shiftAnchor("month", windowStart, i));

  return (
    <div className={clsx("inline-flex flex-wrap items-center gap-2", className)}>
      <div className="inline-flex items-center gap-0.5 rounded-xl border border-navy/10 bg-cream/60 p-1">
        <button
          type="button"
          onClick={() => onChange(shiftAnchor("month", anchor, -1))}
          aria-label="Previous month"
          className="rounded-lg p-1.5 text-navy/60 transition-colors hover:bg-white hover:text-navy focus:outline-none focus-visible:ring-2 focus-visible:ring-teal/40"
        >
          <Chevron direction="left" />
        </button>
        {months.map((m) => {
          const isSelected = hasSelection && m === selected;
          const isFuture = m > currentMonth;
          return (
            <button
              key={m}
              type="button"
              onClick={() => onChange(m)}
              disabled={isFuture && nextDisabled && !isSelected}
              aria-pressed={isSelected}
              className={clsx(
                "whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium tabular-nums transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-teal/40",
                isSelected ? "bg-teal text-white shadow-sm" : "text-navy/60 hover:bg-white hover:text-navy",
                "disabled:pointer-events-none disabled:text-navy/20",
              )}
            >
              {periodLabel("month", m)}
            </button>
          );
        })}
        <button
          type="button"
          onClick={() => onChange(shiftAnchor("month", anchor, 1))}
          disabled={nextDisabled}
          aria-label="Next month"
          className="rounded-lg p-1.5 text-navy/60 transition-colors hover:bg-white hover:text-navy focus:outline-none focus-visible:ring-2 focus-visible:ring-teal/40 disabled:pointer-events-none disabled:text-navy/20"
        >
          <Chevron direction="right" />
        </button>
      </div>
    </div>
  );
}
