import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  createEventWithClientMock,
  eventCreationFeeConfigFindFirstMock,
  eventCreationPaymentCreateMock,
  eventCreationPaymentFindFirstMock,
  eventCreationPaymentUpdateMock,
  findActivePromoCodeMock,
  initializeChapaTransactionMock,
  hasActiveOwnerSubscriptionMock,
  verifyChapaTransactionWithRetryMock,
} = vi.hoisted(() => ({
  createEventWithClientMock: vi.fn(),
  eventCreationFeeConfigFindFirstMock: vi.fn(),
  eventCreationPaymentCreateMock: vi.fn(),
  eventCreationPaymentFindFirstMock: vi.fn(),
  eventCreationPaymentUpdateMock: vi.fn(),
  findActivePromoCodeMock: vi.fn(),
  initializeChapaTransactionMock: vi.fn(),
  hasActiveOwnerSubscriptionMock: vi.fn(),
  verifyChapaTransactionWithRetryMock: vi.fn(),
}));

vi.mock("@/lib/chapa", () => ({
  getChapaClient: () => ({
    genTxRef: () => "MEDAFEE-123",
  }),
  initializeChapaTransaction: initializeChapaTransactionMock,
  verifyChapaTransactionWithRetry: verifyChapaTransactionWithRetryMock,
}));

vi.mock("@/lib/dbLocks", () => ({
  acquireTransactionLock: vi.fn(),
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock("@/services/events", () => ({
  createEventWithClient: createEventWithClientMock,
}));

vi.mock("@/services/promoCode", () => ({
  findActivePromoCode: findActivePromoCodeMock,
  computePromoDiscount: (amount: number, promo: { discountType?: string } | null) =>
    promo?.discountType === "full" ? amount : 0,
  consumePromoCode: vi.fn(),
}));

vi.mock("@/services/subscriptions", () => ({
  hasActiveOwnerSubscription: hasActiveOwnerSubscriptionMock,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    eventCreationFeeConfig: {
      findFirst: eventCreationFeeConfigFindFirstMock,
    },
    eventCreationPayment: {
      create: eventCreationPaymentCreateMock,
      update: eventCreationPaymentUpdateMock,
      findFirst: eventCreationPaymentFindFirstMock,
    },
    $transaction: vi.fn(),
  },
}));

describe("event creation fee service", () => {
  beforeEach(() => {
    eventCreationFeeConfigFindFirstMock.mockReset();
    eventCreationPaymentCreateMock.mockReset();
    eventCreationPaymentFindFirstMock.mockReset();
    eventCreationPaymentUpdateMock.mockReset();
    findActivePromoCodeMock.mockReset();
    initializeChapaTransactionMock.mockReset();
    hasActiveOwnerSubscriptionMock.mockReset();
    verifyChapaTransactionWithRetryMock.mockReset();
    createEventWithClientMock.mockReset();
    hasActiveOwnerSubscriptionMock.mockResolvedValue(false);
  });

  it("waives the fee when a full promo code applies", async () => {
    eventCreationFeeConfigFindFirstMock.mockResolvedValue({
      amountEtb: 100,
    });
    findActivePromoCodeMock.mockResolvedValue({
      id: "promo-1",
      code: "FREE100",
      discountType: "full",
      discountValue: 100,
    });

    const { getEventCreationQuote } = await import(
      "@/services/eventCreationFee"
    );
    const quote = await getEventCreationQuote({
      pitchOwnerUserId: "owner-1",
      promoCode: "FREE100",
    });

    expect(quote).toEqual(
      expect.objectContaining({
        baseAmountEtb: 100,
        discountAmountEtb: 100,
        amountDueEtb: 0,
        promo: expect.objectContaining({ id: "promo-1" }),
        waiverReason: "promo",
      }),
    );
  });

  it("creates a pending Chapa checkout when a fee is due", async () => {
    eventCreationFeeConfigFindFirstMock.mockResolvedValue({
      amountEtb: 75,
    });
    findActivePromoCodeMock.mockResolvedValue(null);
    eventCreationPaymentCreateMock.mockResolvedValue({
      id: "payment-1",
    });
    initializeChapaTransactionMock.mockResolvedValue({
      status: "success",
      data: { checkout_url: "https://checkout.example.com" },
    });

    const { initializeEventCreationCheckout } = await import(
      "@/services/eventCreationFee"
    );
    const result = await initializeEventCreationCheckout({
      pitchOwnerUserId: "owner-1",
      email: "owner@example.com",
      callbackUrl: "https://meda.app/api/payments/chapa/callback",
      returnUrlBase: "https://meda.app/create-events/status",
      eventPayload: {
        userId: "owner-1",
        eventName: "Friday Night Football",
        categoryId: "category-1",
        description: null,
        startDate: "2026-04-01T18:00",
        endDate: "2026-04-01T20:00",
        location: "Addis",
        latitude: "9.01",
        longitude: "38.76",
        capacity: 10,
        price: 100,
        pictureUrl: null,
        recurrenceEnabled: false,
      },
    });

    expect(eventCreationPaymentCreateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          pitchOwnerUserId: "owner-1",
          status: "pending",
          providerReference: "MEDAFEE-123",
        }),
      }),
    );
    expect(result).toEqual(
      expect.objectContaining({
        kind: "checkout",
        checkoutUrl: "https://checkout.example.com",
        txRef: "MEDAFEE-123",
      }),
    );
  });

  it("waives the fee when the owner has an active subscription", async () => {
    eventCreationFeeConfigFindFirstMock.mockResolvedValue({
      amountEtb: 120,
    });
    findActivePromoCodeMock.mockResolvedValue(null);
    hasActiveOwnerSubscriptionMock.mockResolvedValue(true);

    const { getEventCreationQuote } = await import(
      "@/services/eventCreationFee"
    );
    const quote = await getEventCreationQuote({
      pitchOwnerUserId: "owner-1",
    });

    expect(quote).toEqual(
      expect.objectContaining({
        baseAmountEtb: 120,
        discountAmountEtb: 120,
        amountDueEtb: 0,
        promo: null,
        waiverReason: "subscription",
      }),
    );
  });
});
