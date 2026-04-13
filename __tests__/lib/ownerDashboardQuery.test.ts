import { describe, expect, it } from "vitest";
import {
  buildOwnerDashboardQueryString,
  formatOwnerDashboardCurrency,
  ownerDashboardDateInputFromDate,
} from "@/lib/ownerDashboardQuery";

describe("ownerDashboardQuery", () => {
  it("formats ETB with zero fraction digits by default", () => {
    expect(formatOwnerDashboardCurrency(42)).toContain("42");
    expect(formatOwnerDashboardCurrency(0)).toContain("0");
  });

  it("ownerDashboardDateInputFromDate uses local YYYY-MM-DD", () => {
    expect(ownerDashboardDateInputFromDate(new Date(2026, 2, 9))).toBe("2026-03-09");
  });

  it("buildOwnerDashboardQueryString maps filters to ISO range params", () => {
    const qs = buildOwnerDashboardQueryString({
      from: "2026-01-15",
      to: "2026-01-20",
      pitchId: "550e8400-e29b-41d4-a716-446655440000",
    });
    const params = new URLSearchParams(qs);
    expect(params.get("pitchId")).toBe("550e8400-e29b-41d4-a716-446655440000");
    expect(params.get("from")).toBe(new Date("2026-01-15T00:00:00").toISOString());
    expect(params.get("to")).toBe(new Date("2026-01-20T23:59:59").toISOString());
  });

  it("buildOwnerDashboardQueryString includes customerId when set", () => {
    const qs = buildOwnerDashboardQueryString({
      from: "2026-01-01",
      to: "2026-01-31",
      pitchId: "",
      customerId: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
    });
    expect(new URLSearchParams(qs).get("customerId")).toBe("aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee");
  });

  it("buildOwnerDashboardQueryString omits empty pitchId", () => {
    const qs = buildOwnerDashboardQueryString({
      from: "2026-01-01",
      to: "2026-01-31",
      pitchId: "",
    });
    expect(new URLSearchParams(qs).has("pitchId")).toBe(false);
  });
});
