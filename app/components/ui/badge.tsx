/**
 * Badge -- small status label with variants (default, accent, success, warning, danger).
 */

import type { HTMLAttributes } from "react";
import { cn } from "./cn";

type BadgeVariant = "default" | "accent" | "success" | "warning" | "danger";

const badgeVariantClasses: Record<BadgeVariant, string> = {
  default:
    "border border-[var(--color-border)] bg-[var(--color-control-bg)] text-[var(--color-text-secondary)]",
  accent:
    "border border-[rgba(74,222,128,0.3)] bg-[var(--color-accent-soft)] text-[var(--color-text-primary)]",
  success:
    "border border-[rgba(74,222,128,0.3)] bg-[var(--color-success-soft)] text-[var(--color-brand)]",
  warning:
    "border border-[rgba(251,191,36,0.3)] bg-[rgba(251,191,36,0.1)] text-[var(--color-warning)]",
  danger:
    "border border-[rgba(251,113,133,0.3)] bg-[rgba(127,29,29,0.16)] text-[#fecdd3]",
};

type BadgeProps = HTMLAttributes<HTMLSpanElement> & {
  variant?: BadgeVariant;
};

export function Badge({ className, variant = "default", ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold tracking-[0.01em]",
        badgeVariantClasses[variant],
        className,
      )}
      {...props}
    />
  );
}
