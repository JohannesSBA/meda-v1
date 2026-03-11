/**
 * Input -- styled text input with shared base classes.
 */

import type { InputHTMLAttributes } from "react";
import { cn } from "./cn";

export const inputBaseClass =
  "h-[52px] sm:h-11 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)] px-4 text-base sm:text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]";

type InputProps = InputHTMLAttributes<HTMLInputElement>;

export function Input({ className, ...props }: InputProps) {
  return <input className={cn(inputBaseClass, className)} {...props} />;
}
