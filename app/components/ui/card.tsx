/**
 * Card -- semantic surface wrapper for content blocks.
 */

import type { ComponentPropsWithoutRef, ElementType } from "react";
import { cn } from "./cn";

type CardProps<T extends ElementType> = {
  as?: T;
} & ComponentPropsWithoutRef<T>;

export function Card<T extends ElementType = "div">({
  as,
  className,
  ...props
}: CardProps<T>) {
  const Component = as ?? "div";

  return (
    <Component
      className={cn(
        "surface-card rounded-[var(--radius-lg)]",
        className,
      )}
      {...props}
    />
  );
}
