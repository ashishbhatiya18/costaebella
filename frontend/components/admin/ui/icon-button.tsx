import { ButtonHTMLAttributes, forwardRef } from "react";
import { clsx } from "@/lib/admin/clsx";

// Small icon-only action button — used for row-level delete/edit actions
// (trash/pencil) across every admin app, distinct from the labeled Button.
type Variant = "default" | "danger";

const variantClasses: Record<Variant, string> = {
  default: "text-navy/40 hover:bg-navy/5 hover:text-navy",
  danger: "text-navy/40 hover:bg-coral/10 hover:text-coral",
};

export const IconButton = forwardRef<
  HTMLButtonElement,
  ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }
>(({ className, variant = "default", ...props }, ref) => {
  return (
    <button
      ref={ref}
      className={clsx(
        "rounded-lg p-1.5 transition-colors disabled:opacity-50 disabled:pointer-events-none focus:outline-none focus-visible:ring-2 focus-visible:ring-teal/40",
        variantClasses[variant],
        className,
      )}
      {...props}
    />
  );
});
IconButton.displayName = "IconButton";
