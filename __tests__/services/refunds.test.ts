import { describe, it, expect, vi, beforeEach } from "vitest";

// ---- mocks ----

const mockEventFindUnique = vi.fn();
const mockAttendeeFindMany = vi.fn();
const mockTransaction = vi.fn();
const mockWaitlistFindMany = vi.fn();
const mockQueryRawUnsafe = vi.fn();
const mockSendRefundConfirmationEmail = vi.fn();
const mockSendWaitlistSpotAvailableEmail = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    event: { findUnique: mockEventFindUnique },
    eventAttendee: { findMany: mockAttendeeFindMany },
    eventWaitlist: { findMany: mockWaitlistFindMany },
    $transaction: mockTransaction,
    $queryRawUnsafe: mockQueryRawUnsafe,
  },
}));

vi.mock("@/services/email", () => ({
  sendRefundConfirmationEmail: mockSendRefundConfirmationEmail,
  sendWaitlistSpotAvailableEmail: mockSendWaitlistSpotAvailableEmail,
}));

vi.mock("@/app/helpers/locationCodec", () => ({
  decodeEventLocation: vi.fn().mockReturnValue({ addressLabel: "Test Venue" }),
}));

// ---- helpers ----

const EVENT_ID = "event-uuid-1";
const USER_ID = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
const WAITLIST_USER_ID = "11111111-2222-3333-4444-555555555555";

function futureDate(hoursFromNow: number) {
  return new Date(Date.now() + hoursFromNow * 60 * 60 * 1000);
}

function makeEvent(overrides: Record<string, unknown> = {}) {
  return {
    eventId: EVENT_ID,
    eventName: "Test Event",
    eventDatetime: futureDate(48),
    eventEndtime: futureDate(50),
    eventLocation: "Venue!longitude=38.7&latitude=9.0",
    capacity: 10,
    priceField: 100,
    ...overrides,
  };
}

function makeTickets(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    attendeeId: `attendee-${i}`,
  }));
}

function setupDefaultTransaction() {
  mockTransaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
    return fn({
      ticketScan: { deleteMany: vi.fn() },
      eventAttendee: { deleteMany: vi.fn() },
      event: { update: vi.fn() },
      userBalance: {
        findUnique: vi.fn().mockResolvedValue({ userId: USER_ID, balanceEtb: 50 }),
        update: vi.fn().mockResolvedValue({ userId: USER_ID, balanceEtb: 150 }),
        create: vi.fn().mockResolvedValue({ userId: USER_ID, balanceEtb: 100 }),
      },
      refund: {
        create: vi.fn().mockResolvedValue({ refundId: "refund-uuid-1" }),
      },
    });
  });
}

async function importProcessRefund() {
  const mod = await import("@/services/refunds");
  return mod.processRefund;
}

// ---- tests ----

describe("processRefund", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockQueryRawUnsafe.mockResolvedValue([]);
    mockWaitlistFindMany.mockResolvedValue([]);
    setupDefaultTransaction();
  });

  it("throws when event is not found", async () => {
    mockEventFindUnique.mockResolvedValue(null);
    const processRefund = await importProcessRefund();
    await expect(processRefund(EVENT_ID, USER_ID)).rejects.toThrow("Event not found");
  });

  it("throws when event starts within 24 hours", async () => {
    mockEventFindUnique.mockResolvedValue(makeEvent({ eventDatetime: futureDate(12) }));
    const processRefund = await importProcessRefund();
    await expect(processRefund(EVENT_ID, USER_ID)).rejects.toThrow(
      "Refunds are not available within 24 hours",
    );
  });

  it("throws when event has already ended", async () => {
    mockEventFindUnique.mockResolvedValue(
      makeEvent({
        eventDatetime: futureDate(48),
        eventEndtime: new Date(Date.now() - 1000),
      }),
    );
    const processRefund = await importProcessRefund();
    await expect(processRefund(EVENT_ID, USER_ID)).rejects.toThrow("already ended");
  });

  it("throws when user has no tickets", async () => {
    mockEventFindUnique.mockResolvedValue(makeEvent());
    mockAttendeeFindMany.mockResolvedValue([]);
    const processRefund = await importProcessRefund();
    await expect(processRefund(EVENT_ID, USER_ID)).rejects.toThrow("no tickets");
  });

  it("processes refund for paid event and returns correct result", async () => {
    mockEventFindUnique.mockResolvedValue(makeEvent({ priceField: 100 }));
    mockAttendeeFindMany.mockResolvedValue(makeTickets(3));

    const processRefund = await importProcessRefund();
    const result = await processRefund(EVENT_ID, USER_ID, 2);

    expect(result.ok).toBe(true);
    expect(result.ticketCount).toBe(2);
    expect(result.amountEtb).toBe(200);
    expect(result.refundId).toBe("refund-uuid-1");
    expect(mockTransaction).toHaveBeenCalledTimes(1);
  });

  it("refunds all tickets when no count specified", async () => {
    mockEventFindUnique.mockResolvedValue(makeEvent({ priceField: 50 }));
    mockAttendeeFindMany.mockResolvedValue(makeTickets(4));

    const processRefund = await importProcessRefund();
    const result = await processRefund(EVENT_ID, USER_ID);

    expect(result.ticketCount).toBe(4);
    expect(result.amountEtb).toBe(200);
  });

  it("caps refund count to owned tickets", async () => {
    mockEventFindUnique.mockResolvedValue(makeEvent({ priceField: 100 }));
    mockAttendeeFindMany.mockResolvedValue(makeTickets(2));

    const processRefund = await importProcessRefund();
    const result = await processRefund(EVENT_ID, USER_ID, 10);

    expect(result.ticketCount).toBe(2);
    expect(result.amountEtb).toBe(200);
  });

  it("handles free event refund with zero amount", async () => {
    mockEventFindUnique.mockResolvedValue(makeEvent({ priceField: null }));
    mockAttendeeFindMany.mockResolvedValue(makeTickets(1));

    const processRefund = await importProcessRefund();
    const result = await processRefund(EVENT_ID, USER_ID);

    expect(result.ticketCount).toBe(1);
    expect(result.amountEtb).toBe(0);
    expect(result.newBalance).toBe(0);
  });

  it("sends waitlist notification emails when waitlist has entries", async () => {
    mockEventFindUnique.mockResolvedValue(makeEvent());
    mockAttendeeFindMany.mockResolvedValue(makeTickets(1));
    mockWaitlistFindMany.mockResolvedValue([
      { waitlistId: "w1", eventId: EVENT_ID, userId: WAITLIST_USER_ID },
    ]);
    mockQueryRawUnsafe.mockResolvedValue([
      { id: WAITLIST_USER_ID, email: "waitlist@test.com", name: "Waiter" },
    ]);

    const processRefund = await importProcessRefund();
    await processRefund(EVENT_ID, USER_ID, 1);

    expect(mockSendWaitlistSpotAvailableEmail).toHaveBeenCalledTimes(1);
    expect(mockSendWaitlistSpotAvailableEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "waitlist@test.com",
        eventId: EVENT_ID,
      }),
    );
  });

  it("does not send waitlist email when waitlist is empty", async () => {
    mockEventFindUnique.mockResolvedValue(makeEvent());
    mockAttendeeFindMany.mockResolvedValue(makeTickets(1));
    mockWaitlistFindMany.mockResolvedValue([]);

    const processRefund = await importProcessRefund();
    await processRefund(EVENT_ID, USER_ID, 1);

    expect(mockSendWaitlistSpotAvailableEmail).not.toHaveBeenCalled();
  });

  it("sends refund confirmation email when user email is available", async () => {
    mockEventFindUnique.mockResolvedValue(makeEvent());
    mockAttendeeFindMany.mockResolvedValue(makeTickets(1));
    mockQueryRawUnsafe.mockResolvedValue([
      { id: USER_ID, email: "user@test.com", name: "Test User" },
    ]);

    const processRefund = await importProcessRefund();
    await processRefund(EVENT_ID, USER_ID, 1);

    expect(mockSendRefundConfirmationEmail).toHaveBeenCalledTimes(1);
    expect(mockSendRefundConfirmationEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "user@test.com",
        eventName: "Test Event",
        ticketCount: 1,
        amountCredited: 100,
      }),
    );
  });

  it("does not throw if email sending fails", async () => {
    mockEventFindUnique.mockResolvedValue(makeEvent());
    mockAttendeeFindMany.mockResolvedValue(makeTickets(1));
    mockQueryRawUnsafe.mockResolvedValue([
      { id: USER_ID, email: "user@test.com", name: "Test" },
    ]);
    mockSendRefundConfirmationEmail.mockRejectedValue(new Error("Email failed"));

    const processRefund = await importProcessRefund();
    const result = await processRefund(EVENT_ID, USER_ID, 1);
    expect(result.ok).toBe(true);
  });

  it("allows refund exactly at 24-hour boundary", async () => {
    mockEventFindUnique.mockResolvedValue(
      makeEvent({ eventDatetime: futureDate(24.01) }),
    );
    mockAttendeeFindMany.mockResolvedValue(makeTickets(1));

    const processRefund = await importProcessRefund();
    const result = await processRefund(EVENT_ID, USER_ID, 1);
    expect(result.ok).toBe(true);
  });
});
