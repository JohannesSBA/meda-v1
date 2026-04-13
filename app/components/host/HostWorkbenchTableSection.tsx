import type { ReactNode } from "react";
import { Card } from "@/app/components/ui/card";
import { cn } from "@/app/components/ui/cn";
import { HostEmptyState } from "@/app/components/host/HostEmptyState";

type HostWorkbenchTableSectionProps = {
  /** When true, renders a panel empty state instead of the table card. */
  empty: boolean;
  emptyMessage: ReactNode;
  /** Table + responsive cards (typically `ResponsiveTableCard`). */
  children: ReactNode;
  /** Optional note below the table (shown for both empty and non-empty when provided). */
  footer?: ReactNode;
};

/**
 * Wraps owner workbench tabular content in a padded card, or a standardized empty panel.
 */
export function HostWorkbenchTableSection({
  empty,
  emptyMessage,
  children,
  footer,
}: HostWorkbenchTableSectionProps) {
  const footerBlock =
    footer != null ? (
      <div className={cn(!empty && "mt-4")}>{footer}</div>
    ) : null;

  if (empty) {
    return (
      <div className="space-y-4">
        <HostEmptyState variant="panel" message={emptyMessage} />
        {footerBlock}
      </div>
    );
  }

  return (
    <Card className="p-5 sm:p-6">
      {children}
      {footerBlock}
    </Card>
  );
}
