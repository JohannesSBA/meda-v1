"use client";

import { Badge } from "@/app/components/ui/badge";
import { cn } from "@/app/components/ui/cn";
import { HOST_WORKBENCH_LIST_CARD_CLASS } from "@/app/components/host/hostWorkbenchChrome";
import { formatOwnerDashboardCurrency } from "@/lib/ownerDashboardQuery";
import type {
  BookingRow,
  CustomerRow,
  PaymentRow,
  UtilizationSlotRow,
} from "@/app/components/owner/ownerDashboardWorkspaceTypes";

const formatCurrency = formatOwnerDashboardCurrency;

export function BookingRowCard({ booking }: { booking: BookingRow }) {
  return (
    <div className={HOST_WORKBENCH_LIST_CARD_CLASS}>
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="accent">{booking.productType}</Badge>
        <Badge variant="default">{booking.status}</Badge>
        {booking.poolStatus ? <Badge variant="default">{booking.poolStatus}</Badge> : null}
      </div>
      <div className="mt-3 space-y-1">
        <p className="text-base font-semibold text-[var(--color-text-primary)]">
          {booking.pitchName}
        </p>
        <p className="text-sm text-[var(--color-text-secondary)]">
          {new Date(booking.startsAt).toLocaleString()}
        </p>
      </div>
      <div className="mt-3 grid gap-2 text-sm text-[var(--color-text-secondary)]">
        <p>Customer: {booking.customerName}</p>
        <p>
          Tickets: {booking.assignedTickets} assigned / {booking.checkedInTickets} checked in
        </p>
        <p>Amount: {formatCurrency(booking.totalAmount)}</p>
      </div>
    </div>
  );
}

export function PaymentRowCard({ payment }: { payment: PaymentRow }) {
  return (
    <div className={HOST_WORKBENCH_LIST_CARD_CLASS}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-base font-semibold text-[var(--color-text-primary)]">{payment.type}</p>
        <Badge variant="default">{payment.status}</Badge>
      </div>
      <div className="mt-3 grid gap-2 text-sm text-[var(--color-text-secondary)]">
        <p>Reference: {payment.pitchName ?? "-"}</p>
        <p>Amount: {formatCurrency(payment.amount)}</p>
        <p>
          Paid at: {payment.paidAt ? new Date(payment.paidAt).toLocaleString() : "Not paid yet"}
        </p>
      </div>
    </div>
  );
}

export function CustomerRowCard({
  customer,
  onSelect,
}: {
  customer: CustomerRow;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        HOST_WORKBENCH_LIST_CARD_CLASS,
        "w-full text-left transition hover:bg-white/[0.03]",
      )}
    >
      <div className="space-y-1">
        <p className="text-base font-semibold text-[var(--color-text-primary)]">
          {customer.customerName}
        </p>
        <p className="text-sm text-[var(--color-text-muted)]">
          {customer.customerEmail ?? "No email"}
        </p>
      </div>
      <div className="mt-3 grid gap-2 text-sm text-[var(--color-text-secondary)] sm:grid-cols-2">
        <p>Bookings: {customer.bookings}</p>
        <p>Assigned: {customer.ticketsAssigned}</p>
        <p>Checked in: {customer.ticketsCheckedIn}</p>
        <p>Paid: {formatCurrency(customer.totalPaidEtb)}</p>
      </div>
      <p className="mt-3 text-xs text-[var(--color-text-muted)]">Tap to inspect history</p>
    </button>
  );
}

export function UtilizationSlotCard({ slot }: { slot: UtilizationSlotRow }) {
  return (
    <div className={HOST_WORKBENCH_LIST_CARD_CLASS}>
      <div className="flex flex-wrap gap-2">
        <Badge variant="default">{slot.status}</Badge>
        <Badge variant="accent">{slot.productType}</Badge>
      </div>
      <div className="mt-3 space-y-1">
        <p className="text-base font-semibold text-[var(--color-text-primary)]">{slot.pitchName}</p>
        <p className="text-sm text-[var(--color-text-secondary)]">
          {new Date(slot.startsAt).toLocaleString()}
        </p>
      </div>
      <div className="mt-3 grid gap-2 text-sm text-[var(--color-text-secondary)]">
        <p>
          Inventory: {slot.soldQuantity}/{slot.capacity} sold, {slot.remainingCapacity} left
        </p>
        <p>Space used: {Math.round(slot.utilization * 100)}%</p>
        <p>Revenue: {formatCurrency(slot.revenueSummaryEtb)}</p>
      </div>
    </div>
  );
}
