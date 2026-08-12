import { InputHTMLAttributes, forwardRef } from "react";
import { clsx } from "@/lib/shiftly/clsx";

export const Input = forwardRef<
  HTMLInputElement,
  InputHTMLAttributes<HTMLInputElement>
>(({ className, ...props }, ref) => {
  return (
    <input
      ref={ref}
      className={clsx(
        "w-full rounded-xl border border-navy/15 bg-cream/40 px-3.5 py-2.5 text-sm text-navy placeholder:text-navy/40 outline-none transition-colors focus:border-teal focus:ring-2 focus:ring-teal/20",
        className,
      )}
      {...props}
    />
  );
});
Input.displayName = "Input";

export function Label({
  className,
  ...props
}: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      className={clsx("mb-1.5 block text-sm font-medium text-navy/70", className)}
      {...props}
    />
  );
}
