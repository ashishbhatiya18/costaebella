"use client";

import { useEffect, useRef, useState } from "react";
import { clsx } from "@/lib/admin/clsx";

// A primary action button with a caret that reveals secondary actions —
// used where two related actions (e.g. "Add X" / "View X") would otherwise
// need two separate buttons on a crowded card.
export function SplitButton({
  label,
  onClick,
  options,
  size = "sm",
}: {
  label: string;
  onClick: () => void;
  options: { label: string; onClick: () => void }[];
  size?: "sm" | "md";
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

  const sizeClasses = size === "sm" ? "px-3 py-1.5 text-sm" : "px-4 py-2.5 text-sm";

  return (
    <div ref={ref} className="relative inline-flex">
      <div className="inline-flex overflow-hidden rounded-xl border border-navy/15 bg-white">
        <button
          onClick={onClick}
          className={clsx("font-medium text-navy transition-colors hover:bg-sand/20", sizeClasses)}
        >
          {label}
        </button>
        <button
          onClick={() => setOpen((v) => !v)}
          aria-label="More actions"
          className="flex items-center border-l border-navy/15 px-2 text-navy/50 transition-colors hover:bg-sand/20 hover:text-navy"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
            <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>

      {open && (
        <div className="absolute right-0 top-full z-20 mt-1 min-w-[10rem] overflow-hidden rounded-xl border border-navy/10 bg-white py-1 shadow-lg">
          {options.map((opt) => (
            <button
              key={opt.label}
              onClick={() => {
                setOpen(false);
                opt.onClick();
              }}
              className="block w-full px-3.5 py-2 text-left text-sm text-navy hover:bg-navy/5"
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
