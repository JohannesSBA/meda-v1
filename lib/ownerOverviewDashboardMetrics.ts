/**
 * Derives the owner dashboard "Overview" tab KPI strip ({@link OwnerDashboardWorkspace}).
 * Keeps percentage and ratio formatting in one testable place.
 */

import { formatOwnerDashboardCurrency } from "@/lib/ownerDashboardQuery";

export type OwnerOverviewMetricTile = {
  label: string;
  value: string;
  detail: string;
};

/** Subset of overview + utilization used only for overview metrics (structural typing from API state). */
type OverviewMetricsSource = {
  revenueTotalEtb: number;
  refundedAmountEtb: number;
  bookingsTotal: number;
  bookingsConfirmed: number;
  activeSlotCount: number;
  utilization: number;
  dailySalesCount: number;
  monthlySalesCount: number;
  expiredPools: number;
  partyCompletion: number;
  assignedTicketCount: number;
  unassignedTicketCount: number;
  checkedInTicketCount: number;
  monthlyPassCustomers: number;
  subscription: {
    status: string;
    entitlementActive: boolean;
    daysRemaining: number;
  } | null;
} | null;

type UtilizationMetricsSource = {
  totals: { slotCount: number };
} | null;

export function buildOwnerOverviewMetricTiles(
  overview: OverviewMetricsSource,
  utilization: UtilizationMetricsSource,
  hostPlanLabel: string,
): OwnerOverviewMetricTile[] {
  const o = overview;
  const revenue = o?.revenueTotalEtb ?? 0;
  const refunded = o?.refundedAmountEtb ?? 0;
  const bookingsConfirmed = o?.bookingsConfirmed ?? 0;
  const utilPct = Math.round((o?.utilization ?? 0) * 100);
  const slotCount = utilization?.totals.slotCount ?? 0;
  const assigned = o?.assignedTicketCount ?? 0;
  const unassigned = o?.unassignedTicketCount ?? 0;
  const checkedIn = o?.checkedInTicketCount ?? 0;
  const daily = o?.dailySalesCount ?? 0;
  const monthly = o?.monthlySalesCount ?? 0;
  const monthlyMembers = o?.monthlyPassCustomers ?? 0;
  const partyPct = Math.round((o?.partyCompletion ?? 0) * 100);
  const sub = o?.subscription ?? null;

  return [
    {
      label: "Money in",
      value: formatOwnerDashboardCurrency(revenue),
      detail: `${bookingsConfirmed} booked and paid`,
    },
    {
      label: "Refunds",
      value: formatOwnerDashboardCurrency(refunded),
      detail: `${o?.expiredPools ?? 0} expired group payments`,
    },
    {
      label: "Calendar use",
      value: `${utilPct}%`,
      detail: `${slotCount} booking times in range`,
    },
    {
      label: "Player names",
      value: `${assigned}/${assigned + unassigned}`,
      detail: `${checkedIn} checked in`,
    },
    {
      label: "Single vs group",
      value: `${daily} / ${monthly}`,
      detail: "Single visits vs monthly groups",
    },
    {
      label: "Monthly members",
      value: String(monthlyMembers),
      detail: `${partyPct}% group payment completion`,
    },
    {
      label: hostPlanLabel,
      value: sub?.status ?? "NONE",
      detail: sub?.entitlementActive
        ? `${sub.daysRemaining} days left`
        : "Turn this on to publish booking times",
    },
    {
      label: "Total bookings",
      value: String(o?.bookingsTotal ?? 0),
      detail: `${o?.activeSlotCount ?? 0} open booking times in range`,
    },
  ];
}
