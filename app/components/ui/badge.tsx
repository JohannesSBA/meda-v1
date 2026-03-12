/**
 * Badge -- small status label with variants (default, accent, success).
 */

import type { HTMLAttributes } from "react";
import { cn } from "./cn";

type BadgeVariant = "default" | "accent" | "success";

const badgeVariantClasses: Record<BadgeVariant, string> = {
  default:
    "border border-[var(--color-border)] bg-[var(--color-control-bg)] text-[var(--color-text-secondary)]",
  accent:
    "border border-[rgba(125,211,252,0.28)] bg-[var(--color-accent-soft)] text-[var(--color-text-primary)]",
  success:
    "border border-[rgba(52,211,153,0.24)] bg-[var(--color-success-soft)] text-[var(--color-text-primary)]",
};

type BadgeProps = HTMLAttributes<HTMLSpanElement> & {
  variant?: BadgeVariant;
};

export function Badge({
  className,
  variant = "default",
  ...props
}: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold tracking-[0.01em]",
        badgeVariantClasses[variant],
        className,
      )}
      {...props}
    />
  );
}
