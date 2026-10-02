"use client";

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
