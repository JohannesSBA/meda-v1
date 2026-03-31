import { describe, expect, it, vi } from "vitest";
import { getUserEventTicketSummaryMap } from "@/services/ticketSummaries";

describe("getUserEventTicketSummaryMap", () => {
  it("returns an empty map when no event ids are provided", async () => {
    const db = {
      eventAttendee: { findMany: vi.fn() },
      event: { findMany: vi.fn() },
      payment: { findMany: vi.fn() },
    };

    const result = await getUserEventTicketSummaryMap("user-1", [], db as never);
    expect(result.size).toBe(0);
    expect(db.eventAttendee.findMany).not.toHaveBeenCalled();
  });

  it("summarizes held and refundable tickets with payment-level prices", async () => {
    const db = {
      eventAttendee: {
        findMany: vi.fn().mockResolvedValue([
          {
            eventId: "event-1",
            userId: "user-1",
            purchaserUserId: "user-1",
            paymentId: "payment-1",
          },
          {
            eventId: "event-1",
            userId: "dependent-1",
            purchaserUserId: "user-1",
            paymentId: "payment-2",
          },
          {
            eventId: "event-2",
            userId: "user-1",
            purchaserUserId: "friend-1",
            paymentId: null,
          },
        ]),
      },
      event: {
        findMany: vi.fn().mockResolvedValue([
          { eventId: "event-1", priceField: 100 },
          { eventId: "event-2", priceField: 50 },
        ]),
      },
      payment: {
        findMany: vi.fn().mockResolvedValue([
          { paymentId: "payment-1", unitPriceEtb: 115 },
          { paymentId: "payment-2", unitPriceEtb: 120 },
        ]),
      },
    };

    const result = await getUserEventTicketSummaryMap(
      "user-1",
      ["event-1", "event-2"],
      db as never,
    );

    expect(result.get("event-1")).toEqual({
      eventId: "event-1",
      heldTicketCount: 1,
      refundableTicketCount: 2,
      refundableAmountEtb: 235,
    });
    expect(result.get("event-2")).toEqual({
      eventId: "event-2",
      heldTicketCount: 1,
      refundableTicketCount: 0,
      refundableAmountEtb: 0,
    });
  });

  it("falls back to the event price when payment records are missing", async () => {
    const db = {
      eventAttendee: {
        findMany: vi.fn().mockResolvedValue([
          {
            eventId: "event-1",
            userId: "friend-1",
            purchaserUserId: "user-1",
            paymentId: "missing-payment",
          },
        ]),
      },
      event: {
        findMany: vi.fn().mockResolvedValue([{ eventId: "event-1", priceField: 99.5 }]),
      },
      payment: {
        findMany: vi.fn().mockResolvedValue([]),
      },
    };

    const result = await getUserEventTicketSummaryMap(
      "user-1",
      ["event-1"],
      db as never,
    );

    expect(result.get("event-1")).toEqual({
      eventId: "event-1",
      heldTicketCount: 0,
      refundableTicketCount: 1,
      refundableAmountEtb: 99.5,
    });
  });
});
