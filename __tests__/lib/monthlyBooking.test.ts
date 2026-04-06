import { describe, expect, it } from "vitest";
import {
  buildMonthlyBookingPayload,
  normalizeMonthlyMemberEmails,
} from "@/lib/monthlyBooking";

describe("monthly booking helpers", () => {
  it("normalizes member emails into lowercase unique entries", () => {
    expect(
      normalizeMonthlyMemberEmails(" One@Example.com,\nTwo@example.com, one@example.com "),
    ).toEqual(["one@example.com", "two@example.com"]);
  });

  it("builds a new-group payload when no saved group is selected", () => {
    expect(
      buildMonthlyBookingPayload({
        slotId: "slot-1",
        groupName: " Friday Squad ",
        memberEmails: "one@example.com, two@example.com",
      }),
    ).toEqual({
      slotId: "slot-1",
      partyName: "Friday Squad",
      memberEmails: ["one@example.com", "two@example.com"],
    });
  });

  it("builds an existing-group payload without creating a new club", () => {
    expect(
      buildMonthlyBookingPayload({
        slotId: "slot-1",
        selectedGroupId: "party-1",
        groupName: "Ignored name",
        memberEmails: "ignored@example.com",
      }),
    ).toEqual({
      slotId: "slot-1",
      partyId: "party-1",
      memberEmails: [],
    });
  });
});
