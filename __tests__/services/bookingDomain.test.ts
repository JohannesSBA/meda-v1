import { BookingStatus, TicketStatus } from "@/generated/prisma/client";
import {
  buildDailyTicketSeeds,
  buildMonthlyTicketSeedsFromResolvedMembers,
  buildReservedPitchContributionAmounts,
  getOutstandingAmount,
  isCapacityActiveBooking,
  normalizeEmail,
} from "@/services/bookingDomain";
import { describe, expect, it } from "vitest";

describe("booking domain helpers", () => {
  it("normalizes emails safely", () => {
    expect(normalizeEmail("  TEST@Example.com ")).toBe("test@example.com");
    expect(normalizeEmail("")).toBeNull();
    expect(normalizeEmail(null)).toBeNull();
  });

  it("gives the organizer the remainder after assigning each added member one full share", () => {
    const amounts = buildReservedPitchContributionAmounts({
      members: [
        { userId: "organizer-1", invitedEmail: "owner@example.com" },
        { userId: null, invitedEmail: "friend-1@example.com" },
        { userId: null, invitedEmail: "friend-2@example.com" },
      ],
      organizerUserId: "organizer-1",
      organizerEmail: "owner@example.com",
      memberShareAmount: 125,
      totalAmount: 1000,
    });

    expect(amounts).toEqual([750, 125, 125]);
  });

  it("creates daily ticket seeds with the first ticket valid for the purchaser", () => {
    const seeds = buildDailyTicketSeeds({
      quantity: 3,
      purchaserId: "user-1",
      purchaserEmail: "buyer@example.com",
      purchaserName: "Buyer",
    });

    expect(seeds).toHaveLength(3);
    expect(seeds[0]).toEqual({
      purchaserId: "user-1",
      assignedUserId: "user-1",
      assignedName: "Buyer",
      assignedEmail: "buyer@example.com",
      status: TicketStatus.VALID,
    });
    expect(seeds[1]?.status).toBe(TicketStatus.ASSIGNMENT_PENDING);
    expect(seeds[2]?.status).toBe(TicketStatus.ASSIGNMENT_PENDING);
  });

  it("creates monthly ticket seeds for known members and reserves empty seats", () => {
    const seeds = buildMonthlyTicketSeedsFromResolvedMembers({
      members: [
        {
          userId: "user-1",
          invitedEmail: "owner@example.com",
          knownUser: { email: "owner@example.com", name: "Owner" },
        },
        {
          userId: null,
          invitedEmail: "friend@example.com",
          knownUser: null,
        },
      ],
      purchaserId: "user-1",
      reservedCapacity: 4,
    });

    expect(seeds).toHaveLength(4);
    expect(seeds[0]).toEqual({
      purchaserId: "user-1",
      assignedUserId: "user-1",
      assignedEmail: "owner@example.com",
      assignedName: "Owner",
      status: TicketStatus.VALID,
    });
    expect(seeds[1]).toEqual({
      purchaserId: "user-1",
      assignedUserId: null,
      assignedEmail: "friend@example.com",
      assignedName: null,
      status: TicketStatus.ASSIGNED,
    });
    expect(seeds[2]?.status).toBe(TicketStatus.ASSIGNMENT_PENDING);
    expect(seeds[3]?.status).toBe(TicketStatus.ASSIGNMENT_PENDING);
  });

  it("computes outstanding amounts without going below zero", () => {
    expect(getOutstandingAmount({ totalAmount: 500, amountPaid: 180 })).toBe(320);
    expect(getOutstandingAmount({ totalAmount: 500, amountPaid: 700 })).toBe(0);
  });

  it("treats confirmed and unexpired pending bookings as capacity-active", () => {
    const now = new Date("2026-03-30T12:00:00.000Z");

    expect(
      isCapacityActiveBooking(
        { status: BookingStatus.CONFIRMED, expiresAt: null },
        now,
      ),
    ).toBe(true);
    expect(
      isCapacityActiveBooking(
        { status: BookingStatus.PENDING, expiresAt: new Date("2026-03-30T13:00:00.000Z") },
        now,
      ),
    ).toBe(true);
    expect(
      isCapacityActiveBooking(
        { status: BookingStatus.PENDING, expiresAt: new Date("2026-03-30T11:00:00.000Z") },
        now,
      ),
    ).toBe(false);
  });
});
