/**
 * Tests for HMAC webhook signature verification on the payout callback route.
 * The pattern mirrors the existing payment webhook protection.
 */
import { createHmac } from "crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockReconcilePitchOwnerPayout = vi.fn();

vi.mock("@/services/payouts", () => ({
  reconcilePitchOwnerPayout: mockReconcilePitchOwnerPayout,
}));

vi.mock("@/lib/logger", () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

function makeSignature(body: string, secret: string) {
  return createHmac("sha256", secret).update(body).digest("hex");
}

function buildRequest(body: string, signature: string) {
  return new Request("https://app.meda.test/api/payouts/chapa/callback", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-chapa-signature": signature,
    },
    body,
  });
}

const VALID_PAYLOAD = JSON.stringify({
  status: "success",
  reference: "MEDAPAYOUT-test-ref",
  data: { status: "paid", transfer_id: "tr_abc" },
});
const SECRET = "test-webhook-secret-32chars-padded";

describe("POST /api/payouts/chapa/callback — HMAC verification", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...originalEnv, CHAPA_WEBHOOK_SECRET: SECRET, NODE_ENV: "production" };
    mockReconcilePitchOwnerPayout.mockResolvedValue({
      id: "payout-1",
      status: "PAID",
      reference: "MEDAPAYOUT-test-ref",
    });
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("accepts a request with a valid HMAC signature", async () => {
    const sig = makeSignature(VALID_PAYLOAD, SECRET);
    const req = buildRequest(VALID_PAYLOAD, sig);

    const { POST } = await import("@/app/api/payouts/chapa/callback/route");
    const res = await POST(req);

    expect(res.status).toBe(200);
    expect(mockReconcilePitchOwnerPayout).toHaveBeenCalledWith(
      expect.objectContaining({ reference: "MEDAPAYOUT-test-ref" }),
    );
  });

  it("rejects a request with a tampered signature", async () => {
    const req = buildRequest(VALID_PAYLOAD, "bad-signature-value");

    const { POST } = await import("@/app/api/payouts/chapa/callback/route");
    const res = await POST(req);

    expect(res.status).toBe(401);
    expect(mockReconcilePitchOwnerPayout).not.toHaveBeenCalled();
  });

  it("rejects a request with a missing signature", async () => {
    const req = new Request("https://app.meda.test/api/payouts/chapa/callback", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: VALID_PAYLOAD,
    });

    const { POST } = await import("@/app/api/payouts/chapa/callback/route");
    const res = await POST(req);

    expect(res.status).toBe(401);
  });

  it("accepts unsigned requests when no CHAPA_WEBHOOK_SECRET is set in dev", async () => {
    process.env = { ...originalEnv, CHAPA_WEBHOOK_SECRET: "", NODE_ENV: "development" };

    const req = buildRequest(VALID_PAYLOAD, "");

    const { POST } = await import("@/app/api/payouts/chapa/callback/route");
    const res = await POST(req);

    expect(res.status).toBe(200);
  });

  it("returns 503 in production when CHAPA_WEBHOOK_SECRET is missing", async () => {
    process.env = { ...originalEnv, CHAPA_WEBHOOK_SECRET: "", NODE_ENV: "production" };

    const req = buildRequest(VALID_PAYLOAD, "");

    const { POST } = await import("@/app/api/payouts/chapa/callback/route");
    const res = await POST(req);

    expect(res.status).toBe(503);
    expect(mockReconcilePitchOwnerPayout).not.toHaveBeenCalled();
  });
});
