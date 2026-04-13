import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  bookingFindManyMock,
  createChapaTransferMock,
  getAuthUserEmailsMock,
  notifyUserByIdMock,
  paymentFindManyMock,
  pitchOwnerPayoutCreateMock,
  pitchOwnerPayoutFindManyMock,
  pitchOwnerProfileFindUniqueMock,
  readPitchOwnerPayoutCredentialsMock,
  userBalanceFindUniqueMock,
} = vi.hoisted(() => ({
  bookingFindManyMock: vi.fn(),
  createChapaTransferMock: vi.fn(),
  getAuthUserEmailsMock: vi.fn(),
  notifyUserByIdMock: vi.fn(),
  paymentFindManyMock: vi.fn(),
  pitchOwnerPayoutCreateMock: vi.fn(),
  pitchOwnerPayoutFindManyMock: vi.fn(),
  pitchOwnerProfileFindUniqueMock: vi.fn(),
  readPitchOwnerPayoutCredentialsMock: vi.fn(),
  userBalanceFindUniqueMock: vi.fn(),
}));

vi.mock("@/lib/auth/userLookup", () => ({
  getAuthUserEmails: getAuthUserEmailsMock,
}));

vi.mock("@/lib/chapa", () => ({
  createChapaTransfer: createChapaTransferMock,
}));

vi.mock("@/services/actionNotifications", () => ({
  notifyUserById: notifyUserByIdMock,
}));

vi.mock("@/services/payoutCredentials", () => ({
  PAYOUT_REVERIFICATION_REQUIRED_MESSAGE:
    "Your saved payout details can no longer be read with the current encryption key. Re-enter and verify them again.",
  readPitchOwnerPayoutCredentials: readPitchOwnerPayoutCredentialsMock,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    pitchOwnerProfile: {
      findUnique: pitchOwnerProfileFindUniqueMock,
    },
    userBalance: {
      findUnique: userBalanceFindUniqueMock,
    },
    payment: {
      findMany: paymentFindManyMock,
    },
    booking: {
      findMany: bookingFindManyMock,
    },
    pitchOwnerPayout: {
      findMany: pitchOwnerPayoutFindManyMock,
      create: pitchOwnerPayoutCreateMock,
      update: vi.fn(),
    },
  },
}));

describe("pitch owner payouts", () => {
  beforeEach(() => {
    bookingFindManyMock.mockReset();
    createChapaTransferMock.mockReset();
    getAuthUserEmailsMock.mockReset();
    notifyUserByIdMock.mockReset();
    paymentFindManyMock.mockReset();
    pitchOwnerPayoutCreateMock.mockReset();
    pitchOwnerPayoutFindManyMock.mockReset();
    pitchOwnerProfileFindUniqueMock.mockReset();
    readPitchOwnerPayoutCredentialsMock.mockReset();
    userBalanceFindUniqueMock.mockReset();

    userBalanceFindUniqueMock.mockResolvedValue({ balanceEtb: 0 });
    paymentFindManyMock.mockResolvedValue([]);
    bookingFindManyMock.mockResolvedValue([]);
    pitchOwnerPayoutFindManyMock.mockResolvedValue([]);
    pitchOwnerProfileFindUniqueMock.mockResolvedValue({
      userId: "owner-1",
      businessName: "Owner FC",
      accountNameEnc: "v1:account-name",
      accountNumberEnc: "v1:account-number",
      bankCodeEnc: "v1:bank-code",
      payoutSetupVerifiedAt: new Date("2026-04-01T10:00:00.000Z"),
    });
  });

  it("returns a non-ready summary when payout credentials need re-verification", async () => {
    readPitchOwnerPayoutCredentialsMock.mockReturnValue({
      accountName: null,
      accountNumber: null,
      accountNumberLast4: null,
      accountNumberMasked: null,
      bankCode: null,
      payoutSetupIssue:
        "Your saved payout details can no longer be read with the current encryption key. Re-enter and verify them again.",
    });

    const { getPitchOwnerPayoutSummary } = await import("@/services/payouts");
    const result = await getPitchOwnerPayoutSummary("owner-1");

    expect(result.summary).toEqual(
      expect.objectContaining({
        ownerId: "owner-1",
        businessName: "Owner FC",
        payoutReady: false,
        payoutSetupIssue:
          "Your saved payout details can no longer be read with the current encryption key. Re-enter and verify them again.",
        destinationLabel: null,
        destinationBankCode: null,
      }),
    );
  });

  it("rejects payout creation with a re-verification error when credentials are unreadable", async () => {
    readPitchOwnerPayoutCredentialsMock.mockReturnValue({
      accountName: null,
      accountNumber: null,
      accountNumberLast4: null,
      accountNumberMasked: null,
      bankCode: null,
      payoutSetupIssue:
        "Your saved payout details can no longer be read with the current encryption key. Re-enter and verify them again.",
    });

    const { createPitchOwnerPayout } = await import("@/services/payouts");

    await expect(
      createPitchOwnerPayout({
        ownerId: "owner-1",
        amountEtb: null,
        initiatedByUserId: "owner-1",
        callbackUrl: "https://meda.app/api/payouts/chapa/callback",
      }),
    ).rejects.toThrow(
      "Your saved payout details can no longer be read with the current encryption key. Re-enter and verify them again.",
    );

    expect(pitchOwnerPayoutCreateMock).not.toHaveBeenCalled();
    expect(createChapaTransferMock).not.toHaveBeenCalled();
  });
});
