/**
 * Button -- styled button with variants (primary, secondary, ghost, danger) and sizes.
 */

import type { ButtonHTMLAttributes } from "react";
import { cn } from "./cn";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
type ButtonSize = "sm" | "md" | "lg";

export const buttonBaseClass =
  "inline-flex items-center justify-center whitespace-nowrap rounded-[var(--radius-md)] border border-transparent font-semibold tracking-[-0.012em] transition duration-160 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-bg)] disabled:cursor-not-allowed disabled:opacity-45 select-none";

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    "bg-[linear-gradient(140deg,#4ade80_0%,#22c55e_55%,#16a34a_100%)] text-[var(--color-brand-text)] shadow-[0_12px_36px_rgba(34,197,94,0.32),inset_0_1px_0_rgba(255,255,255,0.2)] hover:-translate-y-0.5 hover:shadow-[0_16px_44px_rgba(34,197,94,0.4),inset_0_1px_0_rgba(255,255,255,0.2)] active:translate-y-0 active:shadow-[0_6px_20px_rgba(34,197,94,0.26)]",
  secondary:
    "border-[var(--color-border-strong)] bg-[var(--color-control-bg)] text-[var(--color-text-primary)] shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] hover:border-[rgba(74,222,128,0.38)] hover:bg-[var(--color-control-bg-hover)] hover:text-[var(--color-text-primary)]",
  ghost:
    "text-[var(--color-text-secondary)] hover:bg-[var(--color-control-bg)] hover:text-[var(--color-text-primary)]",
  danger:
    "border-[rgba(251,113,133,0.36)] bg-[rgba(127,29,29,0.16)] text-[#fecdd3] hover:bg-[rgba(153,27,27,0.26)] hover:border-[rgba(251,113,133,0.52)]",
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: "h-8  px-3.5 text-xs gap-1.5",
  md: "h-10 px-4   text-sm gap-2",
  lg: "h-11 px-5   text-sm gap-2",
};

export function buttonVariants(variant: ButtonVariant = "secondary", size: ButtonSize = "md") {
  return cn(buttonBaseClass, variantClasses[variant], sizeClasses[size]);
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
};

export function Button({ className, variant = "secondary", size = "md", ...props }: ButtonProps) {
  return <button className={cn(buttonVariants(variant, size), className)} {...props} />;
}
