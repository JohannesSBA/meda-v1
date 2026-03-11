import { describe, it, expect, vi, beforeEach } from "vitest";

const mockEventFindUnique = vi.fn();
const mockAttendeeCount = vi.fn();
const mockInvitationCreate = vi.fn();
const mockInvitationFindFirst = vi.fn();
const mockInvitationUpdateMany = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    event: { findUnique: mockEventFindUnique },
    eventAttendee: {
      count: mockAttendeeCount,
    },
    invitation: {
      create: mockInvitationCreate,
      findFirst: mockInvitationFindFirst,
      updateMany: mockInvitationUpdateMany,
    },
  },
}));

vi.mock("@/app/helpers/locationCodec", () => ({
  decodeEventLocation: vi.fn().mockReturnValue({ addressLabel: "Test Venue" }),
}));

vi.mock("@/lib/tickets/shareTokens", () => ({
  generateShareToken: vi.fn().mockReturnValue("mock-token"),
  hashShareToken: vi.fn().mockReturnValue("mock-hash"),
}));

const TEST_USER_ID = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
const EVENT_ID = "event-uuid-1";

function futureDate(hoursFromNow: number) {
  return new Date(Date.now() + hoursFromNow * 60 * 60 * 1000);
}

describe("createShareLink", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("throws when event does not exist", async () => {
    mockEventFindUnique.mockResolvedValue(null);

    const { createShareLink } = await import("@/services/ticketSharing");
    await expect(
      createShareLink({ eventId: EVENT_ID, ownerUserId: TEST_USER_ID, baseUrl: "http://localhost" }),
    ).rejects.toThrow(/not found/i);
  });

  it("throws when user has only 1 ticket", async () => {
    mockEventFindUnique.mockResolvedValue({
      eventId: EVENT_ID,
      eventName: "Test Event",
      eventDatetime: futureDate(48),
      eventEndtime: futureDate(50),
    });
    mockAttendeeCount.mockResolvedValue(1);

    const { createShareLink } = await import("@/services/ticketSharing");
    await expect(
      createShareLink({ eventId: EVENT_ID, ownerUserId: TEST_USER_ID, baseUrl: "http://localhost" }),
    ).rejects.toThrow(/at least 2/i);
  });

  it("creates a share link when user has multiple tickets", async () => {
    mockEventFindUnique.mockResolvedValue({
      eventId: EVENT_ID,
      eventName: "Test Event",
      eventDatetime: futureDate(48),
      eventEndtime: futureDate(50),
    });
    mockAttendeeCount.mockResolvedValue(3);
    mockInvitationFindFirst.mockResolvedValue(null);
    mockInvitationCreate.mockResolvedValue({
      invitationId: "inv-1",
      maxClaims: 2,
      claimedCount: 0,
      expiresAt: futureDate(48),
    });
    mockInvitationUpdateMany.mockResolvedValue({ count: 0 });

    const { createShareLink } = await import("@/services/ticketSharing");
    const result = await createShareLink({
      eventId: EVENT_ID,
      ownerUserId: TEST_USER_ID,
      baseUrl: "http://localhost",
    });

    expect(result.shareUrl).toContain("mock-token");
    expect(result.remainingClaims).toBe(2);
    expect(mockInvitationCreate).toHaveBeenCalledTimes(1);
  });
});
