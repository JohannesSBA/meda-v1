import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextResponse } from "next/server";

// ---- mocks ----

const mockRequireSessionUser = vi.fn();
const mockProcessRefund = vi.fn();

vi.mock("@/lib/auth/guards", () => ({
  requireSessionUser: mockRequireSessionUser,
}));

vi.mock("@/services/refunds", () => ({
  processRefund: mockProcessRefund,
}));

vi.mock("@/lib/ratelimit", () => ({
  checkRateLimit: vi.fn().mockReturnValue({ limited: false }),
  getClientId: vi.fn().mockReturnValue("test-client"),
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

// ---- helpers ----

const TEST_USER_ID = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
const EVENT_ID = "event-uuid-1";

function makeSessionUser(id = TEST_USER_ID) {
  return { user: { id, email: "user@test.com", name: "Test User" }, response: null };
}

function makeRequest(body: object, ip = "1.2.3.4") {
  return new Request(`http://localhost/api/events/${EVENT_ID}/refund`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-forwarded-for": ip,
    },
    body: JSON.stringify(body),
  });
}

async function importHandler() {
  const mod = await import("@/app/api/events/[id]/refund/route");
  return mod.POST;
}

// ---- tests ----

describe("POST /api/events/[id]/refund", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireSessionUser.mockResolvedValue(makeSessionUser());
    mockProcessRefund.mockResolvedValue({
      ok: true,
      refundId: "refund-uuid-1",
      ticketCount: 2,
      amountEtb: 200,
      newBalance: 200,
    });
  });

  it("returns 401 when not authenticated", async () => {
    mockRequireSessionUser.mockResolvedValue({
      user: null,
      response: NextResponse.json({ error: "Unauthenticated" }, { status: 401 }),
    });

    const POST = await importHandler();
    const res = await POST(makeRequest({}), {
      params: Promise.resolve({ id: EVENT_ID }),
    });
    expect(res.status).toBe(401);
  });

  it("returns 200 on successful refund", async () => {
    const POST = await importHandler();
    const res = await POST(makeRequest({ ticketCount: 2 }), {
      params: Promise.resolve({ id: EVENT_ID }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.ticketCount).toBe(2);
    expect(body.amountEtb).toBe(200);
  });

  it("passes ticketCount to processRefund when provided", async () => {
    const POST = await importHandler();
    await POST(makeRequest({ ticketCount: 3 }), {
      params: Promise.resolve({ id: EVENT_ID }),
    });
    expect(mockProcessRefund).toHaveBeenCalledWith(EVENT_ID, TEST_USER_ID, 3);
  });

  it("passes undefined ticketCount when not provided", async () => {
    const POST = await importHandler();
    await POST(makeRequest({}), {
      params: Promise.resolve({ id: EVENT_ID }),
    });
    expect(mockProcessRefund).toHaveBeenCalledWith(EVENT_ID, TEST_USER_ID, undefined);
  });

  it("floors fractional ticketCount", async () => {
    const POST = await importHandler();
    await POST(makeRequest({ ticketCount: 2.7 }), {
      params: Promise.resolve({ id: EVENT_ID }),
    });
    expect(mockProcessRefund).toHaveBeenCalledWith(EVENT_ID, TEST_USER_ID, 2);
  });

  it("enforces minimum ticketCount of 1", async () => {
    const POST = await importHandler();
    await POST(makeRequest({ ticketCount: 0 }), {
      params: Promise.resolve({ id: EVENT_ID }),
    });
    expect(mockProcessRefund).toHaveBeenCalledWith(EVENT_ID, TEST_USER_ID, 1);
  });

  it("returns 400 when processRefund throws", async () => {
    mockProcessRefund.mockRejectedValue(
      new Error("Refunds are not available within 24 hours of the event start time"),
    );

    const POST = await importHandler();
    const res = await POST(makeRequest({ ticketCount: 1 }), {
      params: Promise.resolve({ id: EVENT_ID }),
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/24 hours/);
  });

  it("handles invalid JSON body gracefully", async () => {
    const POST = await importHandler();
    const req = new Request(`http://localhost/api/events/${EVENT_ID}/refund`, {
      method: "POST",
      headers: { "x-forwarded-for": "1.2.3.4" },
      body: "not-json",
    });
    const res = await POST(req, {
      params: Promise.resolve({ id: EVENT_ID }),
    });
    expect(res.status).toBe(200);
    expect(mockProcessRefund).toHaveBeenCalledWith(EVENT_ID, TEST_USER_ID, undefined);
  });
});
