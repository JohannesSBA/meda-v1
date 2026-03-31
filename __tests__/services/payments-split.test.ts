import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  acquireTransactionLockMock,
  eventAttendeeCountMock,
  eventAttendeeCreateManyMock,
  eventFindUniqueMock,
  getLockedAvailabilitySnapshotMock,
  getChapaClientMock,
  initializeChapaTransactionMock,
  paymentCreateMock,
  paymentUpdateManyMock,
  paymentUpdateMock,
  pitchOwnerProfileFindUniqueMock,
  prismaTransactionMock,
  sendTicketConfirmationEmailMock,
  userBalanceFindUniqueMock,
  userBalanceUpdateMock,
  userBalanceUpsertMock,
} = vi.hoisted(() => ({
  acquireTransactionLockMock: vi.fn(),
  eventAttendeeCountMock: vi.fn(),
  eventAttendeeCreateManyMock: vi.fn(),
  eventFindUniqueMock: vi.fn(),
  getLockedAvailabilitySnapshotMock: vi.fn(),
  getChapaClientMock: vi.fn(),
  initializeChapaTransactionMock: vi.fn(),
  paymentCreateMock: vi.fn(),
  paymentUpdateManyMock: vi.fn(),
  paymentUpdateMock: vi.fn(),
  pitchOwnerProfileFindUniqueMock: vi.fn(),
  prismaTransactionMock: vi.fn(),
  sendTicketConfirmationEmailMock: vi.fn(),
  userBalanceFindUniqueMock: vi.fn(),
  userBalanceUpdateMock: vi.fn(),
  userBalanceUpsertMock: vi.fn(),
}));

vi.mock("@/lib/chapa", () => ({
  getChapaClient: getChapaClientMock,
  initializeChapaTransaction: initializeChapaTransactionMock,
  verifyChapaTransactionWithRetry: vi.fn(),
}));

vi.mock("@/lib/dbLocks", () => ({
  acquireTransactionLock: acquireTransactionLockMock,
}));

vi.mock("@/lib/events/availability", () => ({
  CHAPA_HOLD_WINDOW_MS: 15 * 60 * 1000,
  getLockedAvailabilitySnapshot: getLockedAvailabilitySnapshotMock,
}));

vi.mock("@/services/email", () => ({
  sendTicketConfirmationEmail: sendTicketConfirmationEmailMock,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    event: {
      findUnique: eventFindUniqueMock,
    },
    userBalance: {
      findUnique: userBalanceFindUniqueMock,
    },
    payment: {
      update: paymentUpdateMock,
    },
    eventAttendee: {
      findMany: vi.fn(),
    },
    $transaction: prismaTransactionMock,
  },
}));

describe("payments split handling", () => {
  beforeEach(() => {
    acquireTransactionLockMock.mockReset();
    eventAttendeeCountMock.mockReset();
    eventAttendeeCreateManyMock.mockReset();
    eventFindUniqueMock.mockReset();
    getLockedAvailabilitySnapshotMock.mockReset();
    getChapaClientMock.mockReset();
    initializeChapaTransactionMock.mockReset();
    paymentCreateMock.mockReset();
    paymentUpdateManyMock.mockReset();
    paymentUpdateMock.mockReset();
    pitchOwnerProfileFindUniqueMock.mockReset();
    prismaTransactionMock.mockReset();
    sendTicketConfirmationEmailMock.mockReset();
    userBalanceFindUniqueMock.mockReset();
    userBalanceUpdateMock.mockReset();
    userBalanceUpsertMock.mockReset();
  });

  it("includes surcharge totals and stores owner payout metadata for pitch-owner events", async () => {
    getChapaClientMock.mockReturnValue({
      genTxRef: () => "MEDA-TX-1",
    });
    getLockedAvailabilitySnapshotMock.mockResolvedValue({
      event: {
        eventId: "event-1",
        eventName: "Sunday 5v5",
        eventEndtime: new Date("2099-01-01T18:00:00.000Z"),
        priceField: 120,
        userId: "owner-1",
      },
      spotsLeft: 20,
    });
    pitchOwnerProfileFindUniqueMock.mockResolvedValue({
      chapaSubaccountId: "sub-123",
      splitType: "percentage",
      splitValue: 0.05,
      payoutSetupVerifiedAt: new Date("2099-01-01T00:00:00.000Z"),
    });
    eventAttendeeCountMock.mockResolvedValue(0);
    paymentCreateMock.mockResolvedValue({ paymentId: "payment-1" });
    initializeChapaTransactionMock.mockResolvedValue({
      status: "success",
      data: { checkout_url: "https://checkout.example.com" },
    });
    prismaTransactionMock.mockImplementation(async (callback: (tx: unknown) => unknown) =>
      callback({
        payment: {
          updateMany: paymentUpdateManyMock,
          create: paymentCreateMock,
        },
        eventAttendee: {
          count: eventAttendeeCountMock,
        },
        pitchOwnerProfile: {
          findUnique: pitchOwnerProfileFindUniqueMock,
        },
      }),
    );

    const { initializeChapaCheckout } = await import("@/services/payments");
    await initializeChapaCheckout({
      eventId: "event-1",
      quantity: 2,
      userId: "buyer-1",
      email: "buyer@example.com",
      callbackUrl: "https://meda.app/api/payments/chapa/callback",
      returnUrlBase: "https://meda.app/payments/chapa/status?eventId=event-1",
    });

    expect(initializeChapaTransactionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        amount: "270.00",
      }),
    );
    expect(paymentCreateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          amountEtb: 270,
          surchargeEtb: 30,
          ownerRevenueEtb: 228,
          chapaSubaccountId: null,
        }),
      }),
    );
  });

  it("credits the pitch owner balance share for balance-paid tickets", async () => {
    eventFindUniqueMock.mockResolvedValue({
      eventId: "event-1",
      eventEndtime: new Date("2099-01-01T18:00:00.000Z"),
      capacity: 20,
      priceField: 100,
    });
    userBalanceFindUniqueMock
      .mockResolvedValueOnce({ balanceEtb: 500 })
      .mockResolvedValueOnce({ balanceEtb: 300 });
    getLockedAvailabilitySnapshotMock.mockResolvedValue({
      event: {
        eventId: "event-1",
        eventName: "Sunday 5v5",
        eventDatetime: new Date("2099-01-01T16:00:00.000Z"),
        eventEndtime: new Date("2099-01-01T18:00:00.000Z"),
        eventLocation: "Addis",
        addressLabel: "Addis",
        latitude: 9.01,
        longitude: 38.76,
        priceField: 100,
        userId: "owner-1",
      },
      spotsLeft: 20,
    });
    pitchOwnerProfileFindUniqueMock.mockResolvedValue({
      userId: "owner-1",
      chapaSubaccountId: "sub-123",
      payoutSetupVerifiedAt: new Date("2099-01-01T00:00:00.000Z"),
    });
    eventAttendeeCountMock.mockResolvedValue(0);
    prismaTransactionMock.mockImplementation(async (callback: (tx: unknown) => unknown) =>
      callback({
        eventAttendee: {
          count: eventAttendeeCountMock,
          createMany: eventAttendeeCreateManyMock,
        },
        payment: {
          create: paymentCreateMock,
        },
        pitchOwnerProfile: {
          findUnique: pitchOwnerProfileFindUniqueMock,
        },
        userBalance: {
          findUnique: vi.fn().mockResolvedValue({ balanceEtb: 500 }),
          update: userBalanceUpdateMock,
          upsert: userBalanceUpsertMock,
        },
      }),
    );

    const { payWithBalance } = await import("@/services/payments");
    await payWithBalance({
      eventId: "event-1",
      userId: "buyer-1",
      quantity: 2,
      userEmail: null,
      userName: null,
      baseUrl: "https://meda.app",
    });

    expect(userBalanceUpsertMock).toHaveBeenCalledWith({
      where: { userId: "owner-1" },
      update: {
        balanceEtb: { increment: 190 },
      },
      create: {
        userId: "owner-1",
        balanceEtb: 190,
      },
    });
    expect(paymentCreateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          chapaSubaccountId: "sub-123",
          provider: "balance",
        }),
      }),
    );
  });
});
