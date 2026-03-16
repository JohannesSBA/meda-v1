import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  facilitatorFindUniqueMock,
  pitchOwnerProfileFindUniqueMock,
} = vi.hoisted(() => ({
  facilitatorFindUniqueMock: vi.fn(),
  pitchOwnerProfileFindUniqueMock: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    pitchOwnerProfile: {
      findUnique: pitchOwnerProfileFindUniqueMock,
    },
    facilitator: {
      findUnique: facilitatorFindUniqueMock,
    },
  },
}));

describe("auth roles", () => {
  beforeEach(() => {
    facilitatorFindUniqueMock.mockReset();
    pitchOwnerProfileFindUniqueMock.mockReset();
    pitchOwnerProfileFindUniqueMock.mockResolvedValue(null);
    facilitatorFindUniqueMock.mockResolvedValue(null);
  });

  it("keeps admins as admin without extra lookups", async () => {
    const { enrichSessionUser } = await import("@/lib/auth/roles");

    const user = await enrichSessionUser({
      id: "admin-user",
      role: "admin",
    });

    expect(user).toEqual({
      id: "admin-user",
      role: "admin",
      authRole: "admin",
      parentPitchOwnerUserId: null,
    });
    expect(pitchOwnerProfileFindUniqueMock).not.toHaveBeenCalled();
    expect(facilitatorFindUniqueMock).not.toHaveBeenCalled();
  });

  it("derives pitch owners before facilitator status", async () => {
    pitchOwnerProfileFindUniqueMock.mockResolvedValue({ userId: "pitch-owner" });
    facilitatorFindUniqueMock.mockResolvedValue({
      pitchOwnerUserId: "parent-owner",
      isActive: true,
    });

    const { enrichSessionUser } = await import("@/lib/auth/roles");
    const user = await enrichSessionUser({
      id: "pitch-owner",
      role: "user",
    });

    expect(user).toEqual({
      id: "pitch-owner",
      role: "pitch_owner",
      authRole: "user",
      parentPitchOwnerUserId: null,
    });
  });

  it("derives facilitators and exposes the parent pitch owner id", async () => {
    facilitatorFindUniqueMock.mockResolvedValue({
      pitchOwnerUserId: "parent-owner",
      isActive: true,
    });

    const { enrichSessionUser } = await import("@/lib/auth/roles");
    const user = await enrichSessionUser({
      id: "facilitator-user",
      role: "user",
    });

    expect(user).toEqual({
      id: "facilitator-user",
      role: "facilitator",
      authRole: "user",
      parentPitchOwnerUserId: "parent-owner",
    });
  });

  it("provides helper predicates for event creation, management, and scan access", async () => {
    const { canCreateEvent, canManageEvent, canScanEvent } = await import(
      "@/lib/auth/roles"
    );

    expect(canCreateEvent({ role: "admin" })).toBe(true);
    expect(canCreateEvent({ role: "pitch_owner" })).toBe(true);
    expect(canCreateEvent({ role: "facilitator" })).toBe(false);

    expect(
      canManageEvent({ id: "owner", role: "pitch_owner" }, "owner"),
    ).toBe(true);
    expect(
      canManageEvent({ id: "other", role: "pitch_owner" }, "owner"),
    ).toBe(false);

    expect(
      canScanEvent(
        {
          id: "facilitator",
          role: "facilitator",
          parentPitchOwnerUserId: "owner",
        },
        "owner",
      ),
    ).toBe(true);
    expect(
      canScanEvent(
        {
          id: "facilitator",
          role: "facilitator",
          parentPitchOwnerUserId: "other-owner",
        },
        "owner",
      ),
    ).toBe(false);
  });
});
