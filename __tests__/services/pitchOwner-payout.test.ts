import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  createChapaSubaccountMock,
  decryptPayoutValueMock,
  encryptPayoutValueMock,
  getAuthUserEmailsMock,
  maskAccountNumberMock,
  pitchOwnerProfileFindUniqueMock,
  pitchOwnerProfileUpdateMock,
} = vi.hoisted(() => ({
  createChapaSubaccountMock: vi.fn(),
  decryptPayoutValueMock: vi.fn(),
  encryptPayoutValueMock: vi.fn(),
  getAuthUserEmailsMock: vi.fn(),
  maskAccountNumberMock: vi.fn(),
  pitchOwnerProfileFindUniqueMock: vi.fn(),
  pitchOwnerProfileUpdateMock: vi.fn(),
}));

vi.mock("@/lib/auth/userLookup", () => ({
  getAuthUserEmails: getAuthUserEmailsMock,
}));

vi.mock("@/lib/chapa", () => ({
  createChapaSubaccount: createChapaSubaccountMock,
  extractChapaSubaccountId: (payload: { data?: { subaccount_id?: string } }) =>
    payload.data?.subaccount_id ?? null,
}));

vi.mock("@/lib/encryption", () => ({
  decryptPayoutValue: decryptPayoutValueMock,
  encryptPayoutValue: encryptPayoutValueMock,
  maskAccountNumber: maskAccountNumberMock,
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    pitchOwnerProfile: {
      findUnique: pitchOwnerProfileFindUniqueMock,
      update: pitchOwnerProfileUpdateMock,
    },
  },
}));

describe("pitch owner payout settings", () => {
  beforeEach(() => {
    getAuthUserEmailsMock.mockReset();
    pitchOwnerProfileFindUniqueMock.mockReset();
    pitchOwnerProfileUpdateMock.mockReset();
    createChapaSubaccountMock.mockReset();
    encryptPayoutValueMock.mockReset();
    decryptPayoutValueMock.mockReset();
    maskAccountNumberMock.mockReset();
  });

  it("stores encrypted fields and saves the verified subaccount id", async () => {
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
    pitchOwnerProfileFindUniqueMock.mockResolvedValue({
      id: "profile-1",
      userId: "user-1",
      businessName: "Pitch Owner",
      accountNameEnc: null,
      accountNumberEnc: null,
      bankCodeEnc: null,
      chapaSubaccountId: null,
      splitType: "percentage",
      splitValue: 0.05,
      payoutSetupVerifiedAt: null,
    });
    pitchOwnerProfileUpdateMock
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce({
        userId: "user-1",
        businessName: "Pitch Owner FC",
        accountNameEnc: "enc:Abebe",
        accountNumberEnc: "enc:0123456789",
        bankCodeEnc: "enc:128",
        chapaSubaccountId: "sub-123",
        splitType: "percentage",
        splitValue: 0.05,
        payoutSetupVerifiedAt: new Date("2026-03-15T12:00:00.000Z"),
      });
    createChapaSubaccountMock.mockResolvedValue({
      data: { subaccount_id: "sub-123" },
    });
    encryptPayoutValueMock.mockImplementation((value: string) => `enc:${value}`);
    decryptPayoutValueMock.mockImplementation((value: string | null) =>
      value?.startsWith("enc:") ? value.slice(4) : value,
    );
    maskAccountNumberMock.mockImplementation((value: string | null) =>
      value ? `****${value.slice(-4)}` : null,
    );

    const { updatePitchOwnerPayoutSettings } = await import(
      "@/services/pitchOwner"
    );
    const result = await updatePitchOwnerPayoutSettings({
      userId: "user-1",
      businessName: "Pitch Owner FC",
      accountName: "Abebe",
      accountNumber: "0123456789",
      bankCode: "128",
    });

    expect(createChapaSubaccountMock).toHaveBeenCalledWith({
      accountName: "Abebe",
      accountNumber: "0123456789",
      bankCode: "128",
      businessName: "Pitch Owner FC",
      splitType: "percentage",
      splitValue: 0.05,
    });
    expect(pitchOwnerProfileUpdateMock).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        where: { userId: "user-1" },
        data: expect.objectContaining({
          businessName: "Pitch Owner FC",
          accountNameEnc: "enc:Abebe",
          accountNumberEnc: "enc:0123456789",
          bankCodeEnc: "enc:128",
          chapaSubaccountId: null,
          payoutSetupVerifiedAt: null,
        }),
      }),
    );
    expect(pitchOwnerProfileUpdateMock).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        where: { userId: "user-1" },
        data: expect.objectContaining({
          chapaSubaccountId: "sub-123",
          payoutSetupVerifiedAt: expect.any(Date),
        }),
      }),
    );
    expect(result).toEqual(
      expect.objectContaining({
        businessName: "Pitch Owner FC",
        accountName: "Abebe",
        accountNumberMasked: "****6789",
        accountNumberLast4: "6789",
        bankCode: "128",
        chapaSubaccountId: "sub-123",
        payoutSetupComplete: true,
        payoutSetupIssue: null,
      }),
    );
  });

  it("marks payout setup for re-verification when encrypted values cannot be decrypted", async () => {
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
    pitchOwnerProfileFindUniqueMock.mockResolvedValue({
      userId: "user-1",
      businessName: "Pitch Owner",
      accountNameEnc: "v1:broken-account-name",
      accountNumberEnc: "v1:broken-account-number",
      bankCodeEnc: "v1:broken-bank-code",
      chapaSubaccountId: "sub-123",
      splitType: "percentage",
      splitValue: 0.05,
      payoutSetupVerifiedAt: new Date("2026-03-15T12:00:00.000Z"),
    });
    decryptPayoutValueMock.mockImplementation(() => {
      throw new Error("Unsupported state or unable to authenticate data");
    });
    maskAccountNumberMock.mockReturnValue(null);

    const { getPitchOwnerPayoutSettings } = await import("@/services/pitchOwner");
    const result = await getPitchOwnerPayoutSettings("user-1");

    expect(result).toEqual(
      expect.objectContaining({
        businessName: "Pitch Owner",
        accountName: null,
        accountNumberMasked: null,
        accountNumberLast4: null,
        bankCode: null,
        payoutSetupComplete: false,
        payoutSetupVerifiedAt: null,
        payoutSetupIssue:
          "Your saved payout details can no longer be read with the current encryption key. Re-enter and verify them again.",
      }),
    );
  });
});
