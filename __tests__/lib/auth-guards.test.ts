import { beforeEach, describe, expect, it, vi } from "vitest";

const { getSessionMock } = vi.hoisted(() => ({
  getSessionMock: vi.fn(),
}));

vi.mock("@/lib/auth/server", () => ({
  auth: {
    getSession: getSessionMock,
  },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    pitchOwnerProfile: { findUnique: vi.fn().mockResolvedValue(null) },
    facilitator: { findUnique: vi.fn().mockResolvedValue(null) },
  },
}));

describe("auth guards", () => {
  beforeEach(() => {
    vi.resetModules();
    getSessionMock.mockReset();
  });

  it("returns 401 when unauthenticated", async () => {
    getSessionMock.mockResolvedValue({ data: { user: null } });

    const { requireSessionUser } = await import("@/lib/auth/guards");
    const result = await requireSessionUser();

    expect(result.user).toBeNull();
    expect(result.response?.status).toBe(401);
  });

  it("normalizes malformed role payloads to user in session guard", async () => {
    getSessionMock.mockResolvedValue({
      data: {
        user: {
          id: "u1",
          role: "bogus-role",
          authRole: "bogus-role",
          parentPitchOwnerUserId: "owner-a",
        },
      },
    });

    const { requireSessionUser } = await import("@/lib/auth/guards");
    const result = await requireSessionUser();

    expect(result.response).toBeNull();
    expect(result.user).toEqual({
      id: "u1",
      role: "user",
      authRole: "bogus-role",
      parentPitchOwnerUserId: null,
    });
  });

  it("enforces admin, pitch owner, facilitator, and owner/admin create checks", async () => {
    const { requireAdminUser, requirePitchOwnerUser, requireFacilitatorUser, requireAdminOrPitchOwnerUser } =
      await import("@/lib/auth/guards");

    getSessionMock.mockResolvedValue({ data: { user: { id: "a1", role: "admin" } } });
    expect((await requireAdminUser()).response).toBeNull();

    getSessionMock.mockResolvedValue({ data: { user: { id: "u1", role: "user" } } });
    expect((await requireAdminUser()).response?.status).toBe(403);

    getSessionMock.mockResolvedValue({ data: { user: { id: "po1", role: "pitch_owner" } } });
    expect((await requirePitchOwnerUser()).response).toBeNull();
    expect((await requireAdminOrPitchOwnerUser()).response).toBeNull();

    getSessionMock.mockResolvedValue({ data: { user: { id: "f1", role: "facilitator" } } });
    expect((await requireFacilitatorUser()).response).toBeNull();
    expect((await requireAdminOrPitchOwnerUser()).response?.status).toBe(403);
  });
});
