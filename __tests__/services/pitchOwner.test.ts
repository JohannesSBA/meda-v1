import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  getAuthUserEmailsMock,
  pitchOwnerProfileCreateMock,
  pitchOwnerProfileFindUniqueMock,
  pitchOwnerProfileFindManyMock,
} = vi.hoisted(() => ({
  getAuthUserEmailsMock: vi.fn(),
  pitchOwnerProfileCreateMock: vi.fn(),
  pitchOwnerProfileFindUniqueMock: vi.fn(),
  pitchOwnerProfileFindManyMock: vi.fn(),
}));

vi.mock("@/lib/auth/userLookup", () => ({
  getAuthUserEmails: getAuthUserEmailsMock,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    pitchOwnerProfile: {
      create: pitchOwnerProfileCreateMock,
      findUnique: pitchOwnerProfileFindUniqueMock,
      findMany: pitchOwnerProfileFindManyMock,
    },
  },
}));

describe("pitch owner service", () => {
  beforeEach(() => {
    getAuthUserEmailsMock.mockReset();
    pitchOwnerProfileCreateMock.mockReset();
    pitchOwnerProfileFindUniqueMock.mockReset();
    pitchOwnerProfileFindManyMock.mockReset();
  });

  it("creates a pitch owner profile with default split settings", async () => {
    getAuthUserEmailsMock.mockResolvedValue(
      new Map([
        [
          "user-1",
          {
            id: "user-1",
            email: "owner@example.com",
            name: "Pitch Owner",
          },
        ],
      ]),
    );
    pitchOwnerProfileFindUniqueMock.mockResolvedValue(null);
    pitchOwnerProfileCreateMock.mockResolvedValue({
      id: "profile-1",
      userId: "user-1",
      businessName: "Pitch Owner",
      splitType: "percentage",
    });

    const { ensurePitchOwnerProfile } = await import("@/services/pitchOwner");
    const result = await ensurePitchOwnerProfile({ userId: "user-1" });

    expect(result).toEqual({
      created: true,
      profile: {
        id: "profile-1",
        userId: "user-1",
        businessName: "Pitch Owner",
        splitType: "percentage",
      },
    });
    expect(pitchOwnerProfileCreateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: "user-1",
          businessName: "Pitch Owner",
          splitType: "percentage",
        }),
      }),
    );
  });

  it("returns the existing profile without recreating it", async () => {
    const existingProfile = {
      id: "profile-1",
      userId: "user-1",
      businessName: "Existing owner",
    };
    getAuthUserEmailsMock.mockResolvedValue(
      new Map([
        [
          "user-1",
          {
            id: "user-1",
            email: "owner@example.com",
            name: "Pitch Owner",
          },
        ],
      ]),
    );
    pitchOwnerProfileFindUniqueMock.mockResolvedValue(existingProfile);

    const { ensurePitchOwnerProfile } = await import("@/services/pitchOwner");
    const result = await ensurePitchOwnerProfile({ userId: "user-1" });

    expect(result).toEqual({
      created: false,
      profile: existingProfile,
    });
    expect(pitchOwnerProfileCreateMock).not.toHaveBeenCalled();
  });

  it("fails when the target user does not exist in auth", async () => {
    getAuthUserEmailsMock.mockResolvedValue(new Map());
    pitchOwnerProfileFindUniqueMock.mockResolvedValue(null);

    const { ensurePitchOwnerProfile } = await import("@/services/pitchOwner");

    await expect(
      ensurePitchOwnerProfile({ userId: "missing-user" }),
    ).rejects.toThrow("User not found");
  });
});
