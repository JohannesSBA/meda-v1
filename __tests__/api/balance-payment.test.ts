import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextResponse } from "next/server";

// ---- mocks ----

const mockRequireSessionUser = vi.fn();
const mockEventFindUnique = vi.fn();
const mockUserBalanceFindUnique = vi.fn();
const mockTransaction = vi.fn();
const mockAttendeeFindMany = vi.fn();

vi.mock("@/lib/auth/guards", () => ({
  requireSessionUser: mockRequireSessionUser,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    event: { findUnique: mockEventFindUnique },
    userBalance: { findUnique: mockUserBalanceFindUnique },
    eventAttendee: { findMany: mockAttendeeFindMany },
    $transaction: mockTransaction,
  },
}));

vi.mock("@/services/email", () => ({
  sendTicketConfirmationEmail: vi.fn(),
}));

vi.mock("@/lib/location", () => ({
  decodeEventLocation: vi.fn().mockReturnValue({ addressLabel: "Test Venue" }),
  resolveEventLocation: vi
    .fn()
    .mockReturnValue({ addressLabel: "Test Venue", latitude: 9, longitude: 38 }),
}));

vi.mock("@/lib/ratelimit", () => ({
  checkRateLimit: vi.fn().mockResolvedValue({ limited: false }),
  getClientId: vi.fn().mockReturnValue("test-client"),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}));

// ---- helpers ----

const TEST_USER_ID = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
const EVENT_ID = "550e8400-e29b-41d4-a716-446655440000";

function makeSessionUser(id = TEST_USER_ID) {
  return {
    user: { id, email: "user@test.com", name: "Test User" },
    response: null,
  };
}

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
    userId: "event-owner-id",
    ...overrides,
  };
}

function makeRequest(body: object, ip = "1.2.3.4") {
  return new Request("http://localhost/api/payments/balance", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-forwarded-for": ip,
    },
    body: JSON.stringify(body),
  });
}

async function importHandler() {
  const mod = await import("@/app/api/payments/balance/route");
  return mod.POST;
}

// ---- tests ----

describe("POST /api/payments/balance", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireSessionUser.mockResolvedValue(makeSessionUser());
    mockAttendeeFindMany.mockResolvedValue([{ attendeeId: "att-1" }]);
    mockTransaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
      return fn({
        userBalance: {
          findUnique: vi.fn().mockResolvedValue({ userId: TEST_USER_ID, balanceEtb: 500 }),
          update: vi.fn().mockResolvedValue({ userId: TEST_USER_ID, balanceEtb: 400 }),
        },
        event: {
          updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        },
        eventAttendee: {
          createMany: vi.fn(),
        },
        pitchOwnerProfile: {
          findUnique: vi.fn().mockResolvedValue(null),
        },
        payment: {
          create: vi.fn(),
        },
      });
    });
    // After transaction, for newBalance check
    mockUserBalanceFindUnique.mockResolvedValue({ userId: TEST_USER_ID, balanceEtb: 400 });
  });

  it("returns 401 when not authenticated", async () => {
    mockRequireSessionUser.mockResolvedValue({
      user: null,
      response: NextResponse.json({ error: "Unauthenticated" }, { status: 401 }),
    });

    const POST = await importHandler();
    const res = await POST(makeRequest({ eventId: EVENT_ID, quantity: 1 }));
    expect(res.status).toBe(401);
  });

  it("returns 400 for missing eventId", async () => {
    const POST = await importHandler();
    const res = await POST(makeRequest({ quantity: 1 }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/eventId/i);
  });

  it("returns 400 for invalid request body", async () => {
    const POST = await importHandler();
    const req = new Request("http://localhost/api/payments/balance", {
      method: "POST",
      headers: { "x-forwarded-for": "1.2.3.4" },
      body: "not-json",
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("returns 404 when event does not exist", async () => {
    mockEventFindUnique.mockResolvedValue(null);

    const POST = await importHandler();
    const res = await POST(makeRequest({ eventId: EVENT_ID, quantity: 1 }));
    expect(res.status).toBe(404);
  });

  it("returns 400 when event has ended", async () => {
    mockEventFindUnique.mockResolvedValue(
      makeEvent({ eventEndtime: new Date(Date.now() - 1000) }),
    );

    const POST = await importHandler();
    const res = await POST(makeRequest({ eventId: EVENT_ID, quantity: 1 }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/ended/i);
  });

  it("returns 400 for free events", async () => {
    mockEventFindUnique.mockResolvedValue(makeEvent({ priceField: 0 }));

    const POST = await importHandler();
    const res = await POST(makeRequest({ eventId: EVENT_ID, quantity: 1 }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/does not require payment/i);
  });

  it("returns 400 when quantity exceeds capacity", async () => {
    mockEventFindUnique.mockResolvedValue(makeEvent({ capacity: 2 }));

    const POST = await importHandler();
    const res = await POST(makeRequest({ eventId: EVENT_ID, quantity: 5 }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/seats/i);
  });

  it("returns 400 for insufficient balance", async () => {
    mockEventFindUnique.mockResolvedValue(makeEvent({ priceField: 500 }));
    mockUserBalanceFindUnique.mockResolvedValue({
      userId: TEST_USER_ID,
      balanceEtb: 100,
    });

    const POST = await importHandler();
    const res = await POST(makeRequest({ eventId: EVENT_ID, quantity: 1 }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/insufficient balance/i);
    expect(body.shortfall).toBe(415);
  });

  it("returns 200 on successful balance payment", async () => {
    mockEventFindUnique.mockResolvedValue(makeEvent({ priceField: 100 }));
    mockUserBalanceFindUnique.mockResolvedValue({
      userId: TEST_USER_ID,
      balanceEtb: 500,
    });

    const POST = await importHandler();
    const res = await POST(makeRequest({ eventId: EVENT_ID, quantity: 1 }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.quantity).toBe(1);
    expect(body.amountPaid).toBe(115);
  });

  it("executes transaction on valid payment", async () => {
    mockEventFindUnique.mockResolvedValue(makeEvent({ priceField: 100 }));
    mockUserBalanceFindUnique.mockResolvedValue({
      userId: TEST_USER_ID,
      balanceEtb: 500,
    });

    const POST = await importHandler();
    await POST(makeRequest({ eventId: EVENT_ID, quantity: 2 }));
    expect(mockTransaction).toHaveBeenCalledTimes(1);
  });

  it("clamps quantity between 1 and 20", async () => {
    mockEventFindUnique.mockResolvedValue(makeEvent({ priceField: 10, capacity: 100 }));
    mockUserBalanceFindUnique.mockResolvedValue({
      userId: TEST_USER_ID,
      balanceEtb: 5000,
    });

    const POST = await importHandler();
    const res = await POST(makeRequest({ eventId: EVENT_ID, quantity: 50 }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.quantity).toBe(20);
  });

  it("defaults quantity to 1 when not provided", async () => {
    mockEventFindUnique.mockResolvedValue(makeEvent({ priceField: 100 }));
    mockUserBalanceFindUnique.mockResolvedValue({
      userId: TEST_USER_ID,
      balanceEtb: 500,
    });

    const POST = await importHandler();
    const res = await POST(makeRequest({ eventId: EVENT_ID }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.quantity).toBe(1);
  });

  it("returns 400 when transaction throws", async () => {
    mockEventFindUnique.mockResolvedValue(makeEvent({ priceField: 100 }));
    mockUserBalanceFindUnique.mockResolvedValue({
      userId: TEST_USER_ID,
      balanceEtb: 500,
    });
    mockTransaction.mockRejectedValue(new Error("Insufficient balance"));

    const POST = await importHandler();
    const res = await POST(makeRequest({ eventId: EVENT_ID, quantity: 1 }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/insufficient balance/i);
  });
});
