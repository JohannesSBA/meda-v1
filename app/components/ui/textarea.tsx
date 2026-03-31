/**
 * Textarea -- styled textarea with shared base classes.
 */

import type { TextareaHTMLAttributes } from "react";
import { cn } from "./cn";

export const textareaBaseClass =
  "w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-control-bg)] px-4 py-3 text-sm text-[var(--color-text-primary)] shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] placeholder:text-[var(--color-text-muted)] focus-visible:border-[rgba(125,211,252,0.46)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]";

type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement>;

export function Textarea({ className, ...props }: TextareaProps) {
  return <textarea className={cn(textareaBaseClass, className)} {...props} />;
}
