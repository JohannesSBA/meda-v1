import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  facilitatorCreateMock,
  facilitatorFindManyMock,
  facilitatorFindFirstMock,
  facilitatorFindUniqueMock,
  facilitatorUpdateMock,
  getAuthUserByEmailMock,
  getAuthUserEmailsMock,
} = vi.hoisted(() => ({
  facilitatorCreateMock: vi.fn(),
  facilitatorFindManyMock: vi.fn(),
  facilitatorFindFirstMock: vi.fn(),
  facilitatorFindUniqueMock: vi.fn(),
  facilitatorUpdateMock: vi.fn(),
  getAuthUserByEmailMock: vi.fn(),
  getAuthUserEmailsMock: vi.fn(),
}));

vi.mock("@/lib/auth/userLookup", () => ({
  getAuthUserByEmail: getAuthUserByEmailMock,
  getAuthUserEmails: getAuthUserEmailsMock,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    facilitator: {
      create: facilitatorCreateMock,
      findMany: facilitatorFindManyMock,
      findFirst: facilitatorFindFirstMock,
      findUnique: facilitatorFindUniqueMock,
      update: facilitatorUpdateMock,
    },
  },
}));

describe("facilitator service", () => {
  beforeEach(() => {
    facilitatorCreateMock.mockReset();
    facilitatorFindManyMock.mockReset();
    facilitatorFindFirstMock.mockReset();
    facilitatorFindUniqueMock.mockReset();
    facilitatorUpdateMock.mockReset();
    getAuthUserByEmailMock.mockReset();
    getAuthUserEmailsMock.mockReset();
  });

  it("creates a facilitator link for an existing auth user", async () => {
    getAuthUserByEmailMock.mockResolvedValue({
      id: "facilitator-user",
      email: "scan@example.com",
      name: "Scanner",
    });
    facilitatorFindUniqueMock.mockResolvedValue(null);
    facilitatorCreateMock.mockResolvedValue({
      id: "facilitator-1",
      facilitatorUserId: "facilitator-user",
      pitchOwnerUserId: "owner-1",
      isActive: true,
      createdAt: new Date("2026-03-15T12:00:00.000Z"),
      updatedAt: new Date("2026-03-15T12:00:00.000Z"),
    });

    const { createFacilitator } = await import("@/services/facilitator");
    const facilitator = await createFacilitator({
      pitchOwnerUserId: "owner-1",
      email: "scan@example.com",
    });

    expect(facilitatorCreateMock).toHaveBeenCalledWith({
      data: {
        facilitatorUserId: "facilitator-user",
        pitchOwnerUserId: "owner-1",
      },
    });
    expect(facilitator).toEqual(
      expect.objectContaining({
        facilitatorUserId: "facilitator-user",
        email: "scan@example.com",
        name: "Scanner",
        isActive: true,
      }),
    );
  });

  it("lists facilitator records with auth user details", async () => {
    facilitatorFindManyMock.mockResolvedValue([
      {
        id: "facilitator-1",
        facilitatorUserId: "facilitator-user",
        pitchOwnerUserId: "owner-1",
        isActive: true,
        createdAt: new Date("2026-03-15T12:00:00.000Z"),
        updatedAt: new Date("2026-03-15T12:00:00.000Z"),
      },
    ]);
    getAuthUserEmailsMock.mockResolvedValue(
      new Map([
        [
          "facilitator-user",
          {
            id: "facilitator-user",
            email: "scan@example.com",
            name: "Scanner",
          },
        ],
      ]),
    );

    const { listFacilitatorsForPitchOwner } = await import(
      "@/services/facilitator"
    );
    const facilitators = await listFacilitatorsForPitchOwner("owner-1");

    expect(facilitators).toEqual([
      expect.objectContaining({
        facilitatorUserId: "facilitator-user",
        email: "scan@example.com",
        name: "Scanner",
      }),
    ]);
  });
});
