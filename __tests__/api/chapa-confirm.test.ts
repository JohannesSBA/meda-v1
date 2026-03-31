import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextResponse } from "next/server";

const mockRequireSessionUser = vi.fn();
const mockRequirePitchOwnerUser = vi.fn();
const mockConfirmChapaPayment = vi.fn();
const mockGetPaymentEmailPayloadByReference = vi.fn();
const mockConfirmChapaEventCreationPayment = vi.fn();

vi.mock("@/lib/auth/guards", () => ({
  requireSessionUser: mockRequireSessionUser,
  requirePitchOwnerUser: mockRequirePitchOwnerUser,
}));

vi.mock("@/services/payments", () => ({
  confirmChapaPayment: mockConfirmChapaPayment,
  getPaymentEmailPayloadByReference: mockGetPaymentEmailPayloadByReference,
}));

vi.mock("@/services/eventCreationFee", () => ({
  confirmChapaEventCreationPayment: mockConfirmChapaEventCreationPayment,
}));

vi.mock("@/services/email", () => ({
  sendTicketConfirmationEmail: vi.fn(),
}));

vi.mock("@/lib/ratelimit", () => ({
  checkRateLimit: vi.fn().mockResolvedValue({ limited: false }),
  getClientId: vi.fn().mockReturnValue("test-client"),
}));

vi.mock("@/lib/revalidation", () => ({
  revalidateEventData: vi.fn(),
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

function makeSessionUser() {
  return {
    user: {
      id: "550e8400-e29b-41d4-a716-446655440100",
      email: "user@test.com",
      name: "Test User",
      role: "user",
    },
    response: null,
  };
}

function makePitchOwnerUser() {
  return {
    user: {
      id: "550e8400-e29b-41d4-a716-446655440101",
      email: "owner@test.com",
      name: "Pitch Owner",
      role: "pitch_owner",
    },
    response: null,
  };
}

describe("Chapa confirmation routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireSessionUser.mockResolvedValue(makeSessionUser());
    mockRequirePitchOwnerUser.mockResolvedValue(makePitchOwnerUser());
    mockGetPaymentEmailPayloadByReference.mockResolvedValue(null);
  });

  it("returns 202 when ticket payment confirmation is still processing", async () => {
    mockConfirmChapaPayment.mockResolvedValue({
      ok: false,
      status: "processing",
      quantity: 0,
      eventId: "550e8400-e29b-41d4-a716-446655440102",
      failureReason: "Payment is still processing",
    });

    const { POST } = await import("@/app/api/payments/chapa/confirm/route");
    const res = await POST(
      new Request("http://localhost/api/payments/chapa/confirm", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ txRef: "MEDA-123" }),
      }),
    );

    expect(res.status).toBe(202);
    const body = await res.json();
    expect(body.status).toBe("processing");
  });

  it("returns 202 when event creation payment confirmation is still processing", async () => {
    mockConfirmChapaEventCreationPayment.mockResolvedValue({
      ok: false,
      status: "processing",
      message: "Event creation payment is still processing",
    });

    const { POST } = await import(
      "@/app/api/payments/chapa/confirm-event-creation/route"
    );
    const res = await POST(
      new Request("http://localhost/api/payments/chapa/confirm-event-creation", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ txRef: "MEDAFEE-123" }),
      }),
    );

    expect(res.status).toBe(202);
    const body = await res.json();
    expect(body.status).toBe("processing");
  });

  it("returns auth response when session is missing", async () => {
    mockRequireSessionUser.mockResolvedValue({
      user: null,
      response: NextResponse.json({ error: "Unauthenticated" }, { status: 401 }),
    });

    const { POST } = await import("@/app/api/payments/chapa/confirm/route");
    const res = await POST(
      new Request("http://localhost/api/payments/chapa/confirm", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ txRef: "MEDA-123" }),
      }),
    );

    expect(res.status).toBe(401);
  });
});
