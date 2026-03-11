/**
 * Select -- styled native select with shared base classes.
 */

import type { SelectHTMLAttributes } from "react";
import { cn } from "./cn";

export const selectBaseClass =
  "h-[52px] sm:h-11 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)] px-4 text-base sm:text-sm text-[var(--color-text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]";

type SelectProps = SelectHTMLAttributes<HTMLSelectElement>;

export function Select({ className, ...props }: SelectProps) {
  return <select className={cn(selectBaseClass, className)} {...props} />;
}
