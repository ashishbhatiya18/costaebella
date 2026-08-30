"use client";

import { clsx } from "@/lib/admin/clsx";

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { label: string; value: T; disabled?: boolean }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="inline-flex rounded-xl border border-navy/10 bg-cream/60 p-1">
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => !opt.disabled && onChange(opt.value)}
          disabled={opt.disabled}
          className={clsx(
            "rounded-lg px-3.5 py-1.5 text-sm font-medium transition-colors",
            opt.disabled
              ? "cursor-not-allowed text-navy/30"
              : value === opt.value
                ? "bg-teal text-white shadow-sm"
                : "text-navy/60 hover:text-navy",
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
