import { describe, expect, it } from "vitest";
import {
  getOwnerSubscriptionDaysLeftMetricDetail,
  getOwnerSubscriptionDaysLeftValue,
  getOwnerSubscriptionPlanMetricDetail,
  getOwnerSubscriptionStatusMetricDetail,
} from "@/lib/ownerSubscriptionDashboardCopy";

const term = {
  endsAt: "2026-12-31T00:00:00.000Z",
  renewalAt: null as string | null,
  entitlementActive: true,
  daysRemaining: 14,
  graceEndsAt: null as string | null,
  gracePeriodActive: false,
  graceDaysRemaining: 0,
};

describe("ownerSubscriptionDashboardCopy", () => {
  it("status detail: inactive when subscription missing", () => {
    expect(getOwnerSubscriptionStatusMetricDetail(null)).toBe("Inventory access inactive");
    expect(getOwnerSubscriptionStatusMetricDetail(undefined)).toBe("Inventory access inactive");
  });

  it("status detail: grace message when grace period active", () => {
    expect(
      getOwnerSubscriptionStatusMetricDetail({
        ...term,
        gracePeriodActive: true,
        graceEndsAt: "2026-11-15T00:00:00.000Z",
        graceDaysRemaining: 5,
        entitlementActive: false,
      }),
    ).toMatch(/^Grace ends /);
  });

  it("status detail: active vs inactive when not in grace", () => {
    expect(getOwnerSubscriptionStatusMetricDetail({ ...term, entitlementActive: true })).toBe(
      "Inventory access active",
    );
    expect(getOwnerSubscriptionStatusMetricDetail({ ...term, entitlementActive: false })).toBe(
      "Inventory access inactive",
    );
  });

  it("days left value prefers grace days in grace period", () => {
    expect(
      getOwnerSubscriptionDaysLeftValue({
        ...term,
        gracePeriodActive: true,
        graceDaysRemaining: 3,
        daysRemaining: 99,
      }),
    ).toBe(3);
    expect(getOwnerSubscriptionDaysLeftValue({ ...term, gracePeriodActive: false, daysRemaining: 12 })).toBe(
      12,
    );
    expect(getOwnerSubscriptionDaysLeftValue(null)).toBe(0);
  });

  it("days left detail: grace vs term end vs none", () => {
    expect(
      getOwnerSubscriptionDaysLeftMetricDetail({
        ...term,
        gracePeriodActive: true,
        graceEndsAt: "2026-11-01T00:00:00.000Z",
        graceDaysRemaining: 2,
      }),
    ).toMatch(/^Grace ends /);

    expect(getOwnerSubscriptionDaysLeftMetricDetail({ ...term, endsAt: "2026-10-01T00:00:00.000Z" })).toMatch(
      /^Ends /,
    );

    expect(getOwnerSubscriptionDaysLeftMetricDetail(null)).toBe("No active term");
  });

  it("plan detail: renewal vs none", () => {
    expect(getOwnerSubscriptionPlanMetricDetail(null)).toBe("No renewal scheduled");
    expect(getOwnerSubscriptionPlanMetricDetail({ ...term, renewalAt: null })).toBe("No renewal scheduled");
    expect(getOwnerSubscriptionPlanMetricDetail({ ...term, renewalAt: "2027-01-01T00:00:00.000Z" })).toMatch(
      /^Renews /,
    );
  });
});
