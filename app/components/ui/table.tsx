import type { TableHTMLAttributes } from "react";
import { cn } from "./cn";

type TableProps = TableHTMLAttributes<HTMLTableElement>;

export function Table({ className, ...props }: TableProps) {
  return (
    <table
      className={cn(
        "min-w-full text-left text-sm text-[var(--color-text-secondary)]",
        className,
      )}
      {...props}
    />
  );
}
