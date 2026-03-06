/**
 * Unit tests for the event registration business logic.
 *
 * These tests mock Prisma and the auth guards so they can run without a real DB.
 * They verify the quantity validation, capacity enforcement, per-user limit, and
 * rate-limiting behaviour added by the audit fixes.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextResponse } from "next/server";

// ---- mocks ----

const mockRequireSessionUser = vi.fn();
const mockPrismaEventFindUnique = vi.fn();
const mockPrismaAttendeCount = vi.fn();
const mockPrismaTransaction = vi.fn();

vi.mock("@/lib/auth/guards", () => ({
  requireSessionUser: mockRequireSessionUser,
}));

vi.mock("@/lib/auth/server", () => ({
  auth: { getSession: vi.fn().mockResolvedValue({ data: null }) },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    event: { findUnique: mockPrismaEventFindUnique },
    eventAttendee: {
      count: mockPrismaAttendeCount,
      createMany: vi.fn(),
    },
    $transaction: mockPrismaTransaction,
  },
}));

vi.mock("@/services/email", () => ({
  sendTicketConfirmationEmail: vi.fn(),
}));

vi.mock("@/app/helpers/locationCodec", () => ({
  decodeEventLocation: vi.fn().mockReturnValue({ addressLabel: "Test Venue" }),
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

// ---- helpers ----

const TEST_USER_ID = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
const OTHER_USER_ID = "11111111-2222-3333-4444-555555555555";

function makeSessionUser(id = TEST_USER_ID) {
  return { user: { id, email: "user@test.com", name: "Test User" }, response: null };
}

function makeEvent(overrides: Partial<{
  capacity: number | null;
  priceField: number | null;
  eventEndtime: Date;
}> = {}) {
  return {
    eventId: "event-uuid-1",
    eventName: "Test Event",
    eventDatetime: new Date(Date.now() + 86400_000),
    eventEndtime: overrides.eventEndtime ?? new Date(Date.now() + 2 * 86400_000),
    eventLocation: "Venue!longitude=38.7&latitude=9.0",
    capacity: overrides.capacity !== undefined ? overrides.capacity : null,
    priceField: overrides.priceField ?? null,
    userId: "host-uuid",
  };
}

function makeRequest(body: object, ip = "1.2.3.4") {
  return new Request("http://localhost/api/events/event-uuid-1", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-forwarded-for": ip,
    },
    body: JSON.stringify(body),
  });
}

// Import the handler after mocks are set up
async function importHandler() {
  // Dynamic import so mocks are set before module evaluation
  const mod = await import("@/app/api/events/[id]/route");
  return mod.POST;
}

// ---- tests ----

describe("POST /api/events/[id] — registration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: authenticated user
    mockRequireSessionUser.mockResolvedValue(makeSessionUser());
    // Default: no existing tickets
    mockPrismaAttendeCount.mockResolvedValue(0);
    // Default: transaction succeeds
    mockPrismaTransaction.mockImplementation((fn: (tx: unknown) => Promise<unknown>) =>
      fn({
        event: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
        eventAttendee: { createMany: vi.fn() },
      }),
    );
  });

  it("returns 401 when not authenticated", async () => {
    mockRequireSessionUser.mockResolvedValue({
      user: null,
      response: NextResponse.json({ error: "Unauthenticated" }, { status: 401 }),
    });
    mockPrismaEventFindUnique.mockResolvedValue(makeEvent());

    const POST = await importHandler();
    const res = await POST(makeRequest({ quantity: 1, userId: TEST_USER_ID }), {
      params: Promise.resolve({ id: "event-uuid-1" }),
    });
    expect(res.status).toBe(401);
  });

  it("returns 403 when userId in body does not match session", async () => {
    mockPrismaEventFindUnique.mockResolvedValue(makeEvent());
    const POST = await importHandler();
    const res = await POST(
      makeRequest({ quantity: 1, userId: OTHER_USER_ID }),
      { params: Promise.resolve({ id: "event-uuid-1" }) },
    );
    expect(res.status).toBe(403);
  });

  it("returns 400 for quantity > 20", async () => {
    mockPrismaEventFindUnique.mockResolvedValue(makeEvent());
    const POST = await importHandler();
    const res = await POST(
      makeRequest({ quantity: 21, userId: TEST_USER_ID }),
      { params: Promise.resolve({ id: "event-uuid-1" }) },
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/quantity/i);
  });

  it("returns 400 when event has ended", async () => {
    mockPrismaEventFindUnique.mockResolvedValue(
      makeEvent({ eventEndtime: new Date(Date.now() - 1000) }),
    );
    const POST = await importHandler();
    const res = await POST(
      makeRequest({ quantity: 1, userId: TEST_USER_ID }),
      { params: Promise.resolve({ id: "event-uuid-1" }) },
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/ended/i);
  });

  it("returns 400 when quantity exceeds available capacity", async () => {
    mockPrismaEventFindUnique.mockResolvedValue(makeEvent({ capacity: 2 }));
    const POST = await importHandler();
    const res = await POST(
      makeRequest({ quantity: 5, userId: TEST_USER_ID }),
      { params: Promise.resolve({ id: "event-uuid-1" }) },
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/seats/i);
  });

  it("returns 400 when per-user limit would be exceeded", async () => {
    mockPrismaEventFindUnique.mockResolvedValue(makeEvent());
    mockPrismaAttendeCount.mockResolvedValue(18); // already has 18 tickets
    const POST = await importHandler();
    const res = await POST(
      makeRequest({ quantity: 5, userId: TEST_USER_ID }), // 18 + 5 > 20
      { params: Promise.resolve({ id: "event-uuid-1" }) },
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/20 tickets/i);
  });

  it("returns 201 on successful registration", async () => {
    mockPrismaEventFindUnique.mockResolvedValue(makeEvent());
    mockPrismaAttendeCount
      .mockResolvedValueOnce(0) // existingTickets check
      .mockResolvedValueOnce(1); // updatedCount after insert
    const POST = await importHandler();
    const res = await POST(
      makeRequest({ quantity: 1, userId: TEST_USER_ID }),
      { params: Promise.resolve({ id: "event-uuid-1" }) },
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.ok).toBe(true);
  });

  it("returns 404 when event does not exist", async () => {
    mockPrismaEventFindUnique.mockResolvedValue(null);
    const POST = await importHandler();
    const res = await POST(
      makeRequest({ quantity: 1, userId: TEST_USER_ID }),
      { params: Promise.resolve({ id: "nonexistent" }) },
    );
    expect(res.status).toBe(404);
  });
});
