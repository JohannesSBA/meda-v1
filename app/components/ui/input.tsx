/**
 * Input -- styled text input with shared base classes.
 */

import type { InputHTMLAttributes } from "react";
import { cn } from "./cn";

export const inputBaseClass =
  "h-12 w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-control-bg)] px-4 text-sm text-[var(--color-text-primary)] shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] placeholder:text-[var(--color-text-muted)] focus-visible:border-[rgba(125,211,252,0.46)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]";

type InputProps = InputHTMLAttributes<HTMLInputElement>;

export function Input({ className, ...props }: InputProps) {
  return <input className={cn(inputBaseClass, className)} {...props} />;
}
