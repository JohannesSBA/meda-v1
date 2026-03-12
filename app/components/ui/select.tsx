/**
 * Select -- styled native select with shared base classes.
 */

import type { SelectHTMLAttributes } from "react";
import { cn } from "./cn";

export const selectBaseClass =
  "h-12 w-full appearance-none rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-control-bg)] px-4 text-sm text-[var(--color-text-primary)] shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] focus-visible:border-[rgba(125,211,252,0.46)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]";

type SelectProps = SelectHTMLAttributes<HTMLSelectElement>;

export function Select({ className, ...props }: SelectProps) {
  return <select className={cn(selectBaseClass, className)} {...props} />;
}
