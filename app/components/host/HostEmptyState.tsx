import { Card } from "@/app/components/ui/card";
import { cn } from "@/app/components/ui/cn";
import type { ReactNode } from "react";

type HostEmptyStateProps = {
  message: ReactNode;
  className?: string;
  /**
   * `inset` — dashed frame inside a larger card (lists, detail panes).
   * `panel` — full-width card for standalone empty tables/lists.
   */
  variant?: "inset" | "panel";
};

export function HostEmptyState({ message, className, variant = "inset" }: HostEmptyStateProps) {
  if (variant === "panel") {
    return (
      <Card
        className={cn(
          "p-8 text-center text-sm leading-6 text-[var(--color-text-secondary)]",
          className,
        )}
      >
        {message}
      </Card>
    );
  }

  return (
    <div
      className={cn(
        "rounded-[var(--radius-md)] border border-dashed border-[var(--color-border)] px-4 py-8 text-sm leading-6 text-[var(--color-text-secondary)]",
        className,
      )}
    >
      {message}
    </div>
  );
}
