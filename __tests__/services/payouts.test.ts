import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  bookingFindManyMock,
  createChapaTransferMock,
  getAuthUserEmailsMock,
  notifyUserByIdMock,
  paymentFindManyMock,
  pitchOwnerPayoutAggregateMock,
  pitchOwnerPayoutCreateMock,
  pitchOwnerPayoutFindManyMock,
  pitchOwnerPayoutGroupByMock,
  pitchOwnerProfileFindManyMock,
  pitchOwnerProfileFindUniqueMock,
  readPitchOwnerPayoutCredentialsMock,
  userBalanceFindManyMock,
  userBalanceFindUniqueMock,
} = vi.hoisted(() => ({
  bookingFindManyMock: vi.fn(),
  createChapaTransferMock: vi.fn(),
  getAuthUserEmailsMock: vi.fn(),
  notifyUserByIdMock: vi.fn(),
  paymentFindManyMock: vi.fn(),
  pitchOwnerPayoutAggregateMock: vi.fn(),
  pitchOwnerPayoutCreateMock: vi.fn(),
  pitchOwnerPayoutFindManyMock: vi.fn(),
  pitchOwnerPayoutGroupByMock: vi.fn(),
  pitchOwnerProfileFindManyMock: vi.fn(),
  pitchOwnerProfileFindUniqueMock: vi.fn(),
  readPitchOwnerPayoutCredentialsMock: vi.fn(),
  userBalanceFindManyMock: vi.fn(),
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
      findMany: pitchOwnerProfileFindManyMock,
    },
    userBalance: {
      findUnique: userBalanceFindUniqueMock,
      findMany: userBalanceFindManyMock,
    },
    payment: {
      findMany: paymentFindManyMock,
    },
    booking: {
      findMany: bookingFindManyMock,
    },
    pitchOwnerPayout: {
      findMany: pitchOwnerPayoutFindManyMock,
      aggregate: pitchOwnerPayoutAggregateMock,
      groupBy: pitchOwnerPayoutGroupByMock,
      create: pitchOwnerPayoutCreateMock,
      update: vi.fn(),
    },
  },
}));

const GOOD_CREDENTIALS = {
  accountName: "Owner Name",
  accountNumber: "1234567890",
  accountNumberLast4: "7890",
  accountNumberMasked: "******7890",
  bankCode: "CBE",
  payoutSetupIssue: null,
};

describe("pitch owner payouts", () => {
  beforeEach(() => {
    bookingFindManyMock.mockReset();
    createChapaTransferMock.mockReset();
    getAuthUserEmailsMock.mockReset();
    notifyUserByIdMock.mockReset();
    paymentFindManyMock.mockReset();
    pitchOwnerPayoutAggregateMock.mockReset();
    pitchOwnerPayoutCreateMock.mockReset();
    pitchOwnerPayoutFindManyMock.mockReset();
    pitchOwnerPayoutGroupByMock.mockReset();
    pitchOwnerProfileFindManyMock.mockReset();
    pitchOwnerProfileFindUniqueMock.mockReset();
    readPitchOwnerPayoutCredentialsMock.mockReset();
    userBalanceFindManyMock.mockReset();
    userBalanceFindUniqueMock.mockReset();

    userBalanceFindUniqueMock.mockResolvedValue({ balanceEtb: 0 });
    userBalanceFindManyMock.mockResolvedValue([]);
    paymentFindManyMock.mockResolvedValue([]);
    bookingFindManyMock.mockResolvedValue([]);
    pitchOwnerPayoutFindManyMock.mockResolvedValue([]);
    pitchOwnerPayoutAggregateMock.mockResolvedValue({ _sum: { amountEtb: null } });
    pitchOwnerPayoutGroupByMock.mockResolvedValue([]);
    pitchOwnerProfileFindManyMock.mockResolvedValue([]);
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

  describe("availablePayoutEtb uses DB aggregate, not display list", () => {
    it("uses the aggregate sum for reservedPayoutEtb regardless of display list length", async () => {
      // Owner has ETB 5000 balance and ETB 3000 in aggregate reserved payouts.
      // The display list only shows 2 payouts (1000 + 500 = 1500) due to the take limit,
      // but the real reserved amount is 3000 from the aggregate.
      userBalanceFindUniqueMock.mockResolvedValue({ balanceEtb: 5000 });
      pitchOwnerPayoutAggregateMock.mockResolvedValue({ _sum: { amountEtb: 3000 } });
      pitchOwnerPayoutFindManyMock.mockResolvedValue([
        { id: "p1", ownerId: "owner-1", amountEtb: 1000, status: "PENDING", currency: "ETB", reference: "ref1", providerTransferId: null, destinationBusinessName: null, destinationAccountLast4: null, destinationBankCode: null, failureReason: null, initiatedByUserId: null, paidAt: null, createdAt: new Date(), updatedAt: new Date() },
        { id: "p2", ownerId: "owner-1", amountEtb: 500, status: "PAID", currency: "ETB", reference: "ref2", providerTransferId: null, destinationBusinessName: null, destinationAccountLast4: null, destinationBankCode: null, failureReason: null, initiatedByUserId: null, paidAt: new Date(), createdAt: new Date(), updatedAt: new Date() },
      ]);
      readPitchOwnerPayoutCredentialsMock.mockReturnValue(GOOD_CREDENTIALS);

      const { getPitchOwnerPayoutSummary } = await import("@/services/payouts");
      const result = await getPitchOwnerPayoutSummary("owner-1");

      // available = min(balance=5000, netRevenue=0 - reserved=3000) => max(0, ...) = 0
      // because netOwnerRevenue (no payments) minus 3000 reserved = -3000
      expect(result.summary.availablePayoutEtb).toBe(0);
    });

    it("reports positive available amount when revenue exceeds reserved payouts", async () => {
      userBalanceFindUniqueMock.mockResolvedValue({ balanceEtb: 2000 });
      // No reserved payouts
      pitchOwnerPayoutAggregateMock.mockResolvedValue({ _sum: { amountEtb: null } });
      pitchOwnerPayoutFindManyMock.mockResolvedValue([]);
      paymentFindManyMock.mockResolvedValue([
        {
          paymentId: "pay-1",
          quantity: 2,
          amountEtb: 2300,
          surchargeEtb: 300,
          ownerRevenueEtb: 1900,
          event: { userId: "owner-1" },
          refunds: [],
        },
      ]);
      readPitchOwnerPayoutCredentialsMock.mockReturnValue(GOOD_CREDENTIALS);

      const { getPitchOwnerPayoutSummary } = await import("@/services/payouts");
      const result = await getPitchOwnerPayoutSummary("owner-1");

      // netOwnerRevenue = 1900, balance = 2000, reserved = 0
      // available = min(2000, 1900) = 1900
      expect(result.summary.availablePayoutEtb).toBe(1900);
    });
  });
});
