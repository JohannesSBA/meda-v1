"use client";

import { Button } from "@/app/components/ui/button";
import { Card } from "@/app/components/ui/card";
import { HostSectionHeader } from "@/app/components/host/HostSectionHeader";

export type OwnerDashboardExportLinks = {
  bookings: string;
  payments: string;
  attendees: string;
};

type OwnerDashboardCsvExportCardProps = {
  exportLinks: OwnerDashboardExportLinks;
};

export function OwnerDashboardCsvExportCard({ exportLinks }: OwnerDashboardCsvExportCardProps) {
  return (
    <Card className="space-y-4 p-5 sm:p-6">
      <HostSectionHeader kicker="Exports" title="Download ERP CSV snapshots." />
      <div className="grid gap-3 sm:grid-cols-3">
        <Button
          type="button"
          variant="secondary"
          onClick={() => window.open(exportLinks.bookings, "_blank", "noopener,noreferrer")}
        >
          Export bookings
        </Button>
        <Button
          type="button"
          variant="secondary"
          onClick={() => window.open(exportLinks.payments, "_blank", "noopener,noreferrer")}
        >
          Export payments
        </Button>
        <Button
          type="button"
          variant="secondary"
          onClick={() => window.open(exportLinks.attendees, "_blank", "noopener,noreferrer")}
        >
          Export attendees
        </Button>
      </div>
      <p className="text-sm text-[var(--color-text-secondary)]">
        These exports are filtered by the date range and pitch selector above.
      </p>
    </Card>
  );
}
