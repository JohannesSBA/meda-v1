/**
 * Row / payload shapes for {@link OwnerDashboardWorkspace} and its mobile row cards.
 * Kept in one module so presentational extractions stay typed without API changes.
 */

export type BookingRow = {
  id: string;
  status: string;
  productType: string;
  pitchName: string;
  startsAt: string;
  quantity: number;
  totalAmount: number;
  customerName: string;
  partyName: string | null;
  partyStatus: string | null;
  partyMemberCount: number;
  poolStatus: string | null;
  poolAmountPaid: number | null;
  poolTotalAmount: number | null;
  poolOutstandingAmount: number | null;
  poolExpiresAt: string | null;
  soldTickets: number;
  assignedTickets: number;
  checkedInTickets: number;
};

export type PaymentRow = {
  type: string;
  id: string;
  bookingId: string | null;
  pitchName: string | null;
  productType: string | null;
  amount: number;
  status: string;
  paidAt: string | null;
};

export type CustomerRow = {
  customerId: string;
  customerName: string;
  customerEmail: string | null;
  bookings: number;
  ticketsAssigned: number;
  ticketsCheckedIn: number;
  totalPaidEtb: number;
  monthlyPassUsage: number;
  history: Array<{
    referenceId: string;
    sourceType: "SLOT" | "EVENT";
    title: string;
    startsAt: string;
    amountEtb: number;
    checkedInCount: number;
    assignedCount: number;
    refundAmountEtb: number;
  }>;
};

export type Utilization = {
  totals: {
    slotCount: number;
    bookingCount: number;
    utilization: number;
    revenueTotalEtb: number;
  };
  slots: Array<{
    id: string;
    pitchName: string;
    startsAt: string;
    endsAt: string;
    status: string;
    capacity: number;
    soldQuantity: number;
    remainingCapacity: number;
    bookingCount: number;
    utilization: number;
    revenueSummaryEtb: number;
    productType: string;
  }>;
};

export type UtilizationSlotRow = Utilization["slots"][number];

/** Pitch options for the owner dashboard date/pitch filter. */
export type OwnerDashboardPitchOption = {
  id: string;
  name: string;
};

export type OwnerDashboardTab =
  | "overview"
  | "bookings"
  | "payments"
  | "pool_payments"
  | "customers"
  | "slots"
  | "subscription"
  | "exports";
