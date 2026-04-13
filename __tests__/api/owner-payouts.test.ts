import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";

const mockRequirePitchOwnerUser = vi.fn();
const mockCreatePitchOwnerPayout = vi.fn();
const mockGetPitchOwnerPayoutSummary = vi.fn();

const { mockOwnerPayoutInitRateLimit } = vi.hoisted(() => ({
  mockOwnerPayoutInitRateLimit: vi.fn().mockResolvedValue({ limited: false }),
}));

vi.mock("@/lib/auth/guards", () => ({
  requirePitchOwnerUser: mockRequirePitchOwnerUser,
}));

vi.mock("@/lib/ratelimit", async () => {
  const actual = await vi.importActual<typeof import("@/lib/ratelimit")>("@/lib/ratelimit");
  return {
    ...actual,
    checkOwnerPayoutInitRateLimit: mockOwnerPayoutInitRateLimit,
  };
});

vi.mock("@/services/payouts", () => ({
  createPitchOwnerPayout: mockCreatePitchOwnerPayout,
  getPitchOwnerPayoutSummary: mockGetPitchOwnerPayoutSummary,
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    error: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
  },
}));

const OWNER_ID = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";

describe("POST /api/owner/payouts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockOwnerPayoutInitRateLimit.mockResolvedValue({ limited: false });
    mockRequirePitchOwnerUser.mockResolvedValue({
      user: { id: OWNER_ID, role: "pitch_owner" },
      response: null,
    });
    mockCreatePitchOwnerPayout.mockResolvedValue({
      id: "payout-row-id",
      reference: "ref-1",
    });
  });

  it("returns 401 when unauthenticated", async () => {
    mockRequirePitchOwnerUser.mockResolvedValue({
      user: null,
      response: NextResponse.json({ error: "Unauthenticated" }, { status: 401 }),
    });
    const { POST } = await import("@/app/api/owner/payouts/route");
    const res = await POST(
      new Request("http://localhost/api/owner/payouts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      }),
    );
    expect(res.status).toBe(401);
    expect(mockOwnerPayoutInitRateLimit).not.toHaveBeenCalled();
    expect(mockCreatePitchOwnerPayout).not.toHaveBeenCalled();
  });

  it("returns 429 when payout initiation rate limit is exceeded", async () => {
    mockOwnerPayoutInitRateLimit.mockResolvedValueOnce({
      limited: true,
      retryAfterMs: 30_000,
    });
    const { POST } = await import("@/app/api/owner/payouts/route");
    const res = await POST(
      new Request("http://localhost/api/owner/payouts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      }),
    );
    expect(res.status).toBe(429);
    const body = (await res.json()) as { error?: string };
    expect(body.error).toMatch(/too many requests/i);
    expect(res.headers.get("Retry-After")).toBe("30");
    expect(mockCreatePitchOwnerPayout).not.toHaveBeenCalled();
    expect(mockOwnerPayoutInitRateLimit).toHaveBeenCalledWith(OWNER_ID);
  });

  it("creates a payout when authorized and under the limit", async () => {
    const { POST } = await import("@/app/api/owner/payouts/route");
    const res = await POST(
      new Request("http://localhost/api/owner/payouts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amountEtb: 500 }),
      }),
    );
    expect(res.status).toBe(201);
    expect(mockCreatePitchOwnerPayout).toHaveBeenCalledWith(
      expect.objectContaining({
        ownerId: OWNER_ID,
        amountEtb: 500,
        initiatedByUserId: OWNER_ID,
      }),
    );
    expect(mockOwnerPayoutInitRateLimit).toHaveBeenCalledWith(OWNER_ID);
  });
});
