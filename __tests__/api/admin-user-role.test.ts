import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";

const requireAdminUserMock = vi.fn();
const callNeonAdminPostMock = vi.fn();
const getAdminUserFromStoreMock = vi.fn();

vi.mock("@/lib/auth/guards", () => ({
  requireAdminUser: requireAdminUserMock,
}));

vi.mock("@/lib/auth/neonAdmin", () => ({
  callNeonAdminPost: callNeonAdminPostMock,
}));

vi.mock("@/lib/auth/adminUserStore", () => ({
  getAdminUserFromStore: getAdminUserFromStoreMock,
}));

async function importHandler() {
  const mod = await import("@/app/api/admin/users/[userId]/role/route");
  return mod.PATCH;
}

function makeRequest(role: unknown) {
  return new Request("http://localhost/api/admin/users/11111111-1111-1111-1111-111111111111/role", {
    method: "PATCH",
    body: JSON.stringify({ role }),
    headers: { "content-type": "application/json" },
  });
}

const params = Promise.resolve({
  userId: "11111111-1111-1111-1111-111111111111",
});

describe("PATCH /api/admin/users/[userId]/role", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireAdminUserMock.mockResolvedValue({ response: null, user: { id: "admin-1", role: "admin" } });
    callNeonAdminPostMock.mockResolvedValue({ error: null, status: 200 });
    getAdminUserFromStoreMock.mockResolvedValue({
      id: "11111111-1111-1111-1111-111111111111",
      authRole: "user",
    });
  });

  it("allows user -> admin transitions", async () => {
    const PATCH = await importHandler();
    const res = await PATCH(makeRequest("admin"), { params });

    expect(res.status).toBe(200);
    expect(callNeonAdminPostMock).toHaveBeenCalledWith(
      expect.any(Request),
      "admin/set-role",
      {
        userId: "11111111-1111-1111-1111-111111111111",
        role: "admin",
      },
    );
  });

  it("allows admin -> user transitions", async () => {
    getAdminUserFromStoreMock.mockResolvedValue({
      id: "11111111-1111-1111-1111-111111111111",
      authRole: "admin",
    });

    const PATCH = await importHandler();
    const res = await PATCH(makeRequest("user"), { params });

    expect(res.status).toBe(200);
    expect(callNeonAdminPostMock).toHaveBeenCalledWith(
      expect.any(Request),
      "admin/set-role",
      {
        userId: "11111111-1111-1111-1111-111111111111",
        role: "user",
      },
    );
  });

  it("rejects marketplace roles in admin auth-role mutation", async () => {
    const PATCH = await importHandler();
    const res = await PATCH(makeRequest("pitch_owner"), { params });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("Invalid role payload");
    expect(callNeonAdminPostMock).not.toHaveBeenCalled();
  });

  it("returns auth error when requester is not admin", async () => {
    requireAdminUserMock.mockResolvedValue({
      response: NextResponse.json({ error: "forbidden" }, { status: 403 }),
      user: null,
    });

    const PATCH = await importHandler();
    const res = await PATCH(makeRequest("admin"), { params });

    expect(res.status).toBe(403);
    expect(callNeonAdminPostMock).not.toHaveBeenCalled();
  });

  it("rejects no-op transitions", async () => {
    getAdminUserFromStoreMock.mockResolvedValue({
      id: "11111111-1111-1111-1111-111111111111",
      authRole: "user",
    });
    const PATCH = await importHandler();
    const res = await PATCH(makeRequest("user"), { params });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/not allowed/i);
    expect(callNeonAdminPostMock).not.toHaveBeenCalled();
  });
});
