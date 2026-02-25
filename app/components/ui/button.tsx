import type { ButtonHTMLAttributes } from "react";
import { cn } from "./cn";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
type ButtonSize = "sm" | "md" | "lg";

export const buttonBaseClass =
  "inline-flex items-center justify-center whitespace-nowrap rounded-xl font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-bg)]";

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    "bg-gradient-to-r from-[var(--color-brand)] to-[var(--color-brand-alt)] text-[var(--color-brand-text)] shadow-[0_8px_30px_rgba(0,229,255,0.24)] hover:brightness-110",
  secondary:
    "border border-[var(--color-border-strong)] bg-[var(--color-surface-2)] text-[var(--color-text-primary)] hover:border-[var(--color-brand-alt)] hover:text-[var(--color-brand-alt)]",
  ghost:
    "text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-2)] hover:text-[var(--color-text-primary)]",
  danger:
    "border border-red-300/40 bg-red-500/10 text-red-100 hover:border-red-300/80",
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: "h-9 px-3 text-xs",
  md: "h-10 px-4 text-sm",
  lg: "h-11 px-5 text-sm",
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
