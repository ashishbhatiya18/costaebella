"use client";

import { useEffect, useRef, useState } from "react";
import { clsx } from "@/lib/admin/clsx";

// A single kebab-menu button collapsing several row-level actions into one
// compact control — keeps action-heavy tables/lists from overflowing or
// wrapping awkwardly on narrow screens.
export function ActionsMenu({
  options,
}: {
  options: { label: string; onClick: () => void; variant?: "default" | "danger" }[];
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  return (
    <div ref={ref} className="relative inline-flex" onClick={(e) => e.stopPropagation()}>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="Actions"
        className="rounded-lg p-1.5 text-navy/40 transition-colors hover:bg-navy/5 hover:text-navy"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
          <circle cx="12" cy="5" r="1.8" />
          <circle cx="12" cy="12" r="1.8" />
          <circle cx="12" cy="19" r="1.8" />
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 top-full z-20 mt-1 min-w-[11rem] overflow-hidden rounded-xl border border-navy/10 bg-white py-1 shadow-lg">
          {options.map((opt) => (
            <button
              key={opt.label}
              onClick={() => {
                setOpen(false);
                opt.onClick();
              }}
              className={clsx(
                "block w-full px-3.5 py-2 text-left text-sm hover:bg-navy/5",
                opt.variant === "danger" ? "text-coral" : "text-navy",
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
