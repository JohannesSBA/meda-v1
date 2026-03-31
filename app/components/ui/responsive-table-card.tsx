import type { ReactNode } from "react";
import { cn } from "./cn";

type ResponsiveTableCardProps = {
  table: ReactNode;
  mobileCards: ReactNode;
  className?: string;
};

export function ResponsiveTableCard({
  table,
  mobileCards,
  className,
}: ResponsiveTableCardProps) {
  return (
    <div className={cn("space-y-4", className)}>
      <div className="grid gap-3 md:hidden">{mobileCards}</div>
      <div className="hidden overflow-x-auto md:block">{table}</div>
    </div>
  );
}
