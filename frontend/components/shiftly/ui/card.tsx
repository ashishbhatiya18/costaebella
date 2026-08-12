import { HTMLAttributes } from "react";
import { clsx } from "@/lib/shiftly/clsx";

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={clsx(
        "rounded-2xl border border-navy/10 bg-white shadow-sm shadow-navy/5",
        className,
      )}
      {...props}
    />
  );
}
