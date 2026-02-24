import type { HTMLAttributes } from "react";
import { cn } from "./cn";

type BadgeVariant = "default" | "accent" | "success";

const badgeVariantClasses: Record<BadgeVariant, string> = {
  default: "bg-[var(--color-surface-2)] text-[var(--color-text-secondary)]",
  accent: "bg-[var(--color-brand)]/20 text-[var(--color-brand)]",
  success: "bg-[var(--color-brand-alt)]/20 text-[var(--color-brand-alt)]",
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
        "inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold",
        badgeVariantClasses[variant],
        className,
      )}
      {...props}
    />
  );
}
