import { beforeEach, describe, expect, it, vi } from "vitest";

const mockEventFindUnique = vi.fn();
const mockHostReviewFindUnique = vi.fn();
const mockTicketScanCount = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    event: { findUnique: mockEventFindUnique },
    hostReview: { findUnique: mockHostReviewFindUnique },
    ticketScan: { count: mockTicketScanCount },
  },
}));

describe("getEventReviewStateForUser", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns too_early before event end", async () => {
    mockEventFindUnique.mockResolvedValue({
      eventId: "11111111-1111-1111-1111-111111111111",
      userId: "22222222-2222-2222-2222-222222222222",
      eventEndtime: new Date(Date.now() + 60_000),
      attendees: [{ attendeeId: "a1" }],
    });
    mockHostReviewFindUnique.mockResolvedValue(null);

    const { getEventReviewStateForUser } = await import("@/services/hostReviews");
    const state = await getEventReviewStateForUser({
      eventId: "11111111-1111-1111-1111-111111111111",
      reviewerId: "33333333-3333-3333-3333-333333333333",
      now: new Date(),
    });

    expect(state.code).toBe("too_early");
    expect(state.eligible).toBe(false);
  });

  it("returns eligible when attendee checked in within window", async () => {
    mockEventFindUnique.mockResolvedValue({
      eventId: "11111111-1111-1111-1111-111111111111",
      userId: "22222222-2222-2222-2222-222222222222",
      eventEndtime: new Date(Date.now() - 60_000),
      attendees: [{ attendeeId: "a1" }],
    });
    mockHostReviewFindUnique.mockResolvedValue(null);
    mockTicketScanCount.mockResolvedValue(1);

    const { getEventReviewStateForUser } = await import("@/services/hostReviews");
    const state = await getEventReviewStateForUser({
      eventId: "11111111-1111-1111-1111-111111111111",
      reviewerId: "33333333-3333-3333-3333-333333333333",
      now: new Date(),
    });

    expect(state.code).toBe("eligible");
    expect(state.eligible).toBe(true);
  });
});
