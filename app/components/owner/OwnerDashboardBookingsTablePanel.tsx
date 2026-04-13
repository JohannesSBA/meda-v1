"use client";

import { Badge } from "@/app/components/ui/badge";
import { cn } from "@/app/components/ui/cn";
import { ResponsiveTableCard } from "@/app/components/ui/responsive-table-card";
import { Table } from "@/app/components/ui/table";
import { HostWorkbenchTableSection } from "@/app/components/host/HostWorkbenchTableSection";
import {
  HOST_TABLE_CELL_CLASS,
  HOST_TABLE_HEAD_CLASS,
  HOST_TABLE_ROW_DIVIDER_CLASS,
} from "@/app/components/host/hostWorkbenchChrome";
import { BookingRowCard } from "@/app/components/owner/OwnerDashboardMobileRowCards";
import type { BookingRow } from "@/app/components/owner/ownerDashboardWorkspaceTypes";
import { formatOwnerDashboardCurrency } from "@/lib/ownerDashboardQuery";

const formatCurrency = formatOwnerDashboardCurrency;

type OwnerDashboardBookingsTablePanelProps = {
  bookings: BookingRow[];
};

/**
 * Bookings tab: desktop table + mobile row cards for the owner ERP dashboard.
 * Data comes from the parent; no fetching here.
 */
export function OwnerDashboardBookingsTablePanel({
  bookings,
}: OwnerDashboardBookingsTablePanelProps) {
  return (
    <HostWorkbenchTableSection
      empty={bookings.length === 0}
      emptyMessage="No bookings in this date range."
    >
      <ResponsiveTableCard
        table={
          <Table>
            <thead>
              <tr>
                <th className={HOST_TABLE_HEAD_CLASS}>Pitch</th>
                <th className={HOST_TABLE_HEAD_CLASS}>When</th>
                <th className={HOST_TABLE_HEAD_CLASS}>Customer</th>
                <th className={HOST_TABLE_HEAD_CLASS}>Type</th>
                <th className={HOST_TABLE_HEAD_CLASS}>Tickets</th>
                <th className={HOST_TABLE_HEAD_CLASS}>Pool</th>
                <th className={HOST_TABLE_HEAD_CLASS}>Amount</th>
              </tr>
            </thead>
            <tbody>
              {bookings.map((booking) => (
                <tr key={booking.id} className={HOST_TABLE_ROW_DIVIDER_CLASS}>
                  <td className={HOST_TABLE_CELL_CLASS}>{booking.pitchName}</td>
                  <td className={HOST_TABLE_CELL_CLASS}>
                    {new Date(booking.startsAt).toLocaleString()}
                  </td>
                  <td className={HOST_TABLE_CELL_CLASS}>{booking.customerName}</td>
                  <td className={HOST_TABLE_CELL_CLASS}>
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="accent">{booking.productType}</Badge>
                      <Badge variant="default">{booking.status}</Badge>
                    </div>
                  </td>
                  <td className={HOST_TABLE_CELL_CLASS}>
                    {booking.assignedTickets} assigned / {booking.checkedInTickets} checked in
                  </td>
                  <td className={HOST_TABLE_CELL_CLASS}>{booking.poolStatus ?? "-"}</td>
                  <td
                    className={cn(
                      HOST_TABLE_CELL_CLASS,
                      "font-semibold text-[var(--color-text-primary)]",
                    )}
                  >
                    {formatCurrency(booking.totalAmount)}
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        }
        mobileCards={bookings.map((booking) => (
          <BookingRowCard key={booking.id} booking={booking} />
        ))}
      />
    </HostWorkbenchTableSection>
  );
}
