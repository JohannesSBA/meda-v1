import { describe, expect, it } from "vitest";
import { formatOwnerDashboardCurrency } from "@/lib/ownerDashboardQuery";
import { buildOwnerOverviewMetricTiles } from "@/lib/ownerOverviewDashboardMetrics";

const baseOverview = {
  revenueTotalEtb: 100,
  refundedAmountEtb: 10,
  bookingsTotal: 20,
  bookingsConfirmed: 12,
  activeSlotCount: 5,
  utilization: 0.42,
  dailySalesCount: 3,
  monthlySalesCount: 7,
  expiredPools: 1,
  partyCompletion: 0.25,
  assignedTicketCount: 4,
  unassignedTicketCount: 6,
  checkedInTicketCount: 2,
  monthlyPassCustomers: 9,
  subscription: {
    status: "ACTIVE",
    entitlementActive: true,
    daysRemaining: 14,
  },
};

describe("buildOwnerOverviewMetricTiles", () => {
  it("uses zeros when overview is null", () => {
    const tiles = buildOwnerOverviewMetricTiles(null, null, "Host plan");
    expect(tiles.map((t) => t.label)).toHaveLength(8);
    expect(tiles[0]).toMatchObject({
      label: "Money in",
      value: formatOwnerDashboardCurrency(0),
      detail: "0 booked and paid",
    });
    expect(tiles.find((t) => t.label === "Calendar use")).toMatchObject({
      value: "0%",
      detail: "0 booking times in range",
    });
    expect(tiles.find((t) => t.label === "Player names")).toMatchObject({
      value: "0/0",
      detail: "0 checked in",
    });
    const plan = tiles.find((t) => t.label === "Host plan");
    expect(plan).toMatchObject({
      value: "NONE",
      detail: "Turn this on to publish booking times",
    });
  });

  it("formats utilization, calendar slots, and party completion", () => {
    const tiles = buildOwnerOverviewMetricTiles(
      baseOverview,
      { totals: { slotCount: 33 } },
      "Plan",
    );
    expect(tiles.find((t) => t.label === "Calendar use")).toEqual({
      label: "Calendar use",
      value: "42%",
      detail: "33 booking times in range",
    });
    expect(tiles.find((t) => t.label === "Monthly members")?.detail).toBe(
      "25% group payment completion",
    );
  });

  it("uses subscription plan copy when entitlement is active", () => {
    const tiles = buildOwnerOverviewMetricTiles(baseOverview, null, "Host plan");
    expect(tiles.find((t) => t.label === "Host plan")).toEqual({
      label: "Host plan",
      value: "ACTIVE",
      detail: "14 days left",
    });
  });

  it("shows publish prompt when subscription is missing or inactive", () => {
    const inactive = {
      ...baseOverview,
      subscription: {
        status: "NONE",
        entitlementActive: false,
        daysRemaining: 0,
      },
    };
    const tiles = buildOwnerOverviewMetricTiles(inactive, null, "Host plan");
    expect(tiles.find((t) => t.label === "Host plan")?.detail).toBe(
      "Turn this on to publish booking times",
    );
  });
});
