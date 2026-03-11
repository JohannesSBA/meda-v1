import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextResponse } from "next/server";

// ---- mocks ----

const mockRequireSessionUser = vi.fn();
const mockUserBalanceFindUnique = vi.fn();

vi.mock("@/lib/auth/guards", () => ({
  requireSessionUser: mockRequireSessionUser,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    userBalance: { findUnique: mockUserBalanceFindUnique },
  },
}));

// ---- helpers ----

const TEST_USER_ID = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";

function makeSessionUser(id = TEST_USER_ID) {
  return { user: { id, email: "user@test.com", name: "Test User" }, response: null };
}

async function importHandler() {
  const mod = await import("@/app/api/profile/balance/route");
  return mod.GET;
}

// ---- tests ----

describe("GET /api/profile/balance", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireSessionUser.mockResolvedValue(makeSessionUser());
  });

  it("returns 401 when not authenticated", async () => {
    mockRequireSessionUser.mockResolvedValue({
      user: null,
      response: NextResponse.json({ error: "Unauthenticated" }, { status: 401 }),
    });

    const GET = await importHandler();
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it("returns balance when user has one", async () => {
    mockUserBalanceFindUnique.mockResolvedValue({
      userId: TEST_USER_ID,
      balanceEtb: 150.5,
    });

    const GET = await importHandler();
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.balanceEtb).toBe(150.5);
  });

  it("returns 0 when user has no balance record", async () => {
    mockUserBalanceFindUnique.mockResolvedValue(null);

    const GET = await importHandler();
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.balanceEtb).toBe(0);
  });

  it("queries with the correct userId", async () => {
    mockUserBalanceFindUnique.mockResolvedValue(null);

    const GET = await importHandler();
    await GET();
    expect(mockUserBalanceFindUnique).toHaveBeenCalledWith({
      where: { userId: TEST_USER_ID },
    });
  });
});
