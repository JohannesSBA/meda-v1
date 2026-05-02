import { describe, it, expect, vi, beforeEach } from "vitest";

// ---- mocks ----

const mockEventFindUnique = vi.fn();
const mockWaitlistFindMany = vi.fn();
const mockTransaction = vi.fn();
const mockSendTicketConfirmationEmail = vi.fn();
const mockSendWaitlistSpotAvailableEmail = vi.fn();
const mockGetAuthUserEmails = vi.fn();
const mockAttendeeFindMany = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    event: { findUnique: mockEventFindUnique },
    eventWaitlist: { findMany: mockWaitlistFindMany },
    eventAttendee: { findMany: mockAttendeeFindMany },
    $transaction: mockTransaction,
  },
}));

vi.mock("@/services/email", () => ({
  sendTicketConfirmationEmail: mockSendTicketConfirmationEmail,
  sendWaitlistSpotAvailableEmail: mockSendWaitlistSpotAvailableEmail,
}));

vi.mock("@/lib/auth/userLookup", () => ({
  getAuthUserEmails: mockGetAuthUserEmails,
}));

vi.mock("@/lib/location", () => ({
  resolveEventLocation: vi.fn().mockReturnValue({ addressLabel: "Test Arena" }),
}));

vi.mock("@/lib/events/availability", () => ({
  getLockedAvailabilitySnapshot: vi.fn(),
}));

// ---- helpers ----

const EVENT_ID = "event-uuid-1";
const OWNER_ID = "owner-uuid-1";

function futureDate(hoursFromNow: number) {
  return new Date(Date.now() + hoursFromNow * 60 * 60 * 1000);
}

function makeFreeEvent(overrides: Record<string, unknown> = {}) {
  return {
    eventId: EVENT_ID,
    eventName: "Free Event",
    eventDatetime: futureDate(48),
    eventEndtime: futureDate(50),
    eventLocation: null,
    addressLabel: "Test Arena",
    latitude: 9,
    longitude: 38,
    priceField: null,
    ...overrides,
  };
}

function makePaidEvent(overrides: Record<string, unknown> = {}) {
  return makeFreeEvent({ priceField: 200, ...overrides });
}

function makeWaitlistEntry(userId: string) {
  return { waitlistId: `wl-${userId}`, eventId: EVENT_ID, userId, createdAt: new Date() };
}

async function importModule() {
  const mod = await import("@/services/waitlistPromotion");
  return mod.promoteWaitlistForEvent;
}

// ---- tests ----

describe("promoteWaitlistForEvent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAuthUserEmails.mockImplementation(async (ids: string[]) =>
      new Map(ids.map((id) => [id, { email: `${id}@test.com`, name: `User ${id}` }])),
    );
    mockAttendeeFindMany.mockResolvedValue([]);
    mockWaitlistFindMany.mockResolvedValue([]);
  });

  it("returns 0 when event does not exist", async () => {
    mockEventFindUnique.mockResolvedValue(null);
    const fn = await importModule();
    expect(await fn(EVENT_ID)).toBe(0);
  });

  it("returns 0 for a free event with no capacity", async () => {
    mockEventFindUnique.mockResolvedValue(makeFreeEvent());
    mockTransaction.mockImplementation(async (cb: Function) => cb({
      $queryRaw: vi.fn().mockResolvedValue([]),
    }));
    const fn = await importModule();
    expect(await fn(EVENT_ID)).toBe(0);
  });

  it("promotes free-event waitlisted users when capacity is available", async () => {
    mockEventFindUnique.mockResolvedValue(makeFreeEvent());

    const freshWaitlist = [{ userId: "user-a" }, { userId: "user-b" }];
    const snapshotMock = { spotsLeft: 2, event: makeFreeEvent() };

    mockTransaction.mockImplementation(async (cb: Function) => {
      const { getLockedAvailabilitySnapshot } = await import("@/lib/events/availability");
      vi.mocked(getLockedAvailabilitySnapshot).mockResolvedValueOnce(snapshotMock as any);

      return cb({
        $queryRaw: vi.fn().mockResolvedValue(freshWaitlist),
        eventAttendee: { create: vi.fn() },
        eventWaitlist: { delete: vi.fn() },
      });
    });

    mockAttendeeFindMany.mockResolvedValue([
      { attendeeId: "att-a", userId: "user-a" },
      { attendeeId: "att-b", userId: "user-b" },
    ]);

    const fn = await importModule();
    const result = await fn(EVENT_ID);

    expect(result).toBe(2);
    expect(mockSendTicketConfirmationEmail).toHaveBeenCalledTimes(2);
  });

  it("sends spot-available emails for paid events instead of promoting", async () => {
    mockEventFindUnique.mockResolvedValue(makePaidEvent());
    mockWaitlistFindMany.mockResolvedValue([
      makeWaitlistEntry("user-x"),
      makeWaitlistEntry("user-y"),
    ]);

    // $transaction is only called by the inner notifyWaitlistForPaidEvent helper
    const snapshotMock = { spotsLeft: 2, event: makePaidEvent() };
    mockTransaction.mockImplementation(async (cb: Function) => {
      const { getLockedAvailabilitySnapshot } = await import("@/lib/events/availability");
      vi.mocked(getLockedAvailabilitySnapshot).mockResolvedValueOnce(snapshotMock as any);
      return cb({});
    });

    const fn = await importModule();
    const result = await fn(EVENT_ID);

    expect(result).toBe(2);
    expect(mockSendWaitlistSpotAvailableEmail).toHaveBeenCalledTimes(2);
    // Must NOT create free attendee rows for paid event
    expect(mockSendTicketConfirmationEmail).not.toHaveBeenCalled();
  });

  it("returns 0 for paid event with no open spots", async () => {
    mockEventFindUnique.mockResolvedValue(makePaidEvent());
    mockWaitlistFindMany.mockResolvedValue([makeWaitlistEntry("user-x")]);

    const snapshotMock = { spotsLeft: 0, event: makePaidEvent() };
    mockTransaction.mockImplementation(async (cb: Function) => {
      const { getLockedAvailabilitySnapshot } = await import("@/lib/events/availability");
      vi.mocked(getLockedAvailabilitySnapshot).mockResolvedValueOnce(snapshotMock as any);
      return cb({});
    });

    const fn = await importModule();
    expect(await fn(EVENT_ID)).toBe(0);
    expect(mockSendWaitlistSpotAvailableEmail).not.toHaveBeenCalled();
  });
});
