/**
 * Button -- styled button with variants (primary, secondary, ghost, danger) and sizes.
 */

import type { ButtonHTMLAttributes } from "react";
import { cn } from "./cn";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
type ButtonSize = "sm" | "md" | "lg";

export const buttonBaseClass =
  "inline-flex items-center justify-center whitespace-nowrap rounded-[var(--radius-md)] border border-transparent font-semibold tracking-[-0.01em] transition duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-bg)] disabled:cursor-not-allowed disabled:opacity-50";

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    "bg-[linear-gradient(135deg,var(--color-brand)_0%,var(--color-brand-strong)_58%,#dff7ff_100%)] text-[var(--color-brand-text)] shadow-[0_18px_44px_rgba(56,189,248,0.24)] hover:-translate-y-0.5 hover:shadow-[0_22px_48px_rgba(56,189,248,0.28)]",
  secondary:
    "border-[var(--color-border-strong)] bg-[var(--color-control-bg)] text-[var(--color-text-primary)] shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] hover:border-[rgba(125,211,252,0.46)] hover:bg-[var(--color-control-bg-hover)]",
  ghost:
    "text-[var(--color-text-secondary)] hover:bg-[var(--color-control-bg)] hover:text-[var(--color-text-primary)]",
  danger:
    "border-[rgba(251,113,133,0.4)] bg-[rgba(127,29,29,0.18)] text-[#fecdd3] hover:bg-[rgba(153,27,27,0.28)] hover:border-[rgba(251,113,133,0.55)]",
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: "h-10 px-4 text-sm",
  md: "h-11 px-5 text-sm",
  lg: "h-12 px-6 text-sm sm:text-base",
};

export function buttonVariants(
  variant: ButtonVariant = "secondary",
  size: ButtonSize = "md",
) {
  return cn(buttonBaseClass, variantClasses[variant], sizeClasses[size]);
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
};

export function Button({
  className,
  variant = "secondary",
  size = "md",
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(buttonVariants(variant, size), className)}
      {...props}
    />
  );
}
