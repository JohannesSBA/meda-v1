import { afterAll, beforeAll, beforeEach, describe, expect, test, vi } from "vitest";
import type { PrismaClient } from "@/generated/prisma/client";
import {
  getIntegrationPrisma,
  resetDatabase,
  startIntegrationDatabase,
  stopIntegrationDatabase,
} from "./helpers/postgres";

const mockGetAuthUserEmails = vi.fn(
  async (userIds: string[]) =>
    new Map(
      userIds.map((userId) => [
        userId,
        {
          email: `${userId}@example.com`,
          name: `User ${userId.slice(0, 6)}`,
        },
      ]),
    ),
);

const mockCreateChapaSubaccount = vi.fn(async () => ({
  data: {
    subaccount_id: "subacct-integration-001",
  },
}));

vi.mock("@/services/email", () => ({
  sendRefundConfirmationEmail: vi.fn(),
  sendTicketConfirmationEmail: vi.fn(),
  sendWaitlistSpotAvailableEmail: vi.fn(),
}));

vi.mock("@/lib/auth/userLookup", () => ({
  getAuthUserEmails: mockGetAuthUserEmails,
}));

vi.mock("@/lib/chapa", async () => {
  const actual = await vi.importActual<typeof import("@/lib/chapa")>("@/lib/chapa");
  return {
    ...actual,
    createChapaSubaccount: mockCreateChapaSubaccount,
  };
});

describe.sequential("marketplace lifecycle integration", () => {
  let prisma: PrismaClient;
  let container: Parameters<typeof stopIntegrationDatabase>[0];
  let integrationReady = false;
  let initializeEventCreationCheckout: typeof import("@/services/eventCreationFee").initializeEventCreationCheckout;
  let recordWaivedEventCreation: typeof import("@/services/eventCreationFee").recordWaivedEventCreation;
  let createEventWithClient: typeof import("@/services/events").createEventWithClient;
  let ensurePitchOwnerProfile: typeof import("@/services/pitchOwner").ensurePitchOwnerProfile;
  let updatePitchOwnerPayoutSettings: typeof import("@/services/pitchOwner").updatePitchOwnerPayoutSettings;
  let payWithBalance: typeof import("@/services/payments").payWithBalance;
  let processRefund: typeof import("@/services/refunds").processRefund;

  beforeAll(async () => {
    const db = await startIntegrationDatabase();
    if (!db.available) {
      console.warn(`Skipping integration DB tests: ${db.reason}`);
      return;
    }

    integrationReady = true;
    container = db.container;
    vi.resetModules();
    prisma = await getIntegrationPrisma();

    ({ initializeEventCreationCheckout, recordWaivedEventCreation } = await import(
      "@/services/eventCreationFee"
    ));
    ({ createEventWithClient } = await import("@/services/events"));
    ({ ensurePitchOwnerProfile, updatePitchOwnerPayoutSettings } = await import(
      "@/services/pitchOwner"
    ));
    ({ payWithBalance } = await import("@/services/payments"));
    ({ processRefund } = await import("@/services/refunds"));
  }, 120_000);

  afterAll(async () => {
    await stopIntegrationDatabase(container);
  }, 60_000);

  beforeEach(async () => {
    if (!integrationReady) return;
    await resetDatabase(prisma);
    mockGetAuthUserEmails.mockClear();
    mockCreateChapaSubaccount.mockClear();
  });

  test("covers onboarding, promo-waived creation, purchase, and refund with payout guardrails", async () => {
    if (!integrationReady) return;

    const ownerUserId = "550e8400-e29b-41d4-a716-446655440410";
    const buyerUserId = "550e8400-e29b-41d4-a716-446655440411";
    const waitlistUserId = "550e8400-e29b-41d4-a716-446655440412";
    const categoryId = "550e8400-e29b-41d4-a716-446655440413";

    const startAt = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000);
    const endAt = new Date(startAt.getTime() + 2 * 60 * 60 * 1000);

    await prisma.category.create({
      data: {
        categoryId,
        categoryName: "Football",
      },
    });

    await prisma.eventCreationFeeConfig.create({
      data: {
        id: "550e8400-e29b-41d4-a716-446655440414",
        amountEtb: 150,
        effectiveFrom: new Date(Date.now() - 24 * 60 * 60 * 1000),
      },
    });

    await prisma.promoCode.create({
      data: {
        id: "550e8400-e29b-41d4-a716-446655440415",
        code: "OWNER-WAIVER",
        discountType: "full",
        discountValue: 1,
        pitchOwnerUserId: ownerUserId,
        maxUses: 1,
        usedCount: 0,
        expiresAt: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
        isActive: true,
      },
    });

    await ensurePitchOwnerProfile({ userId: ownerUserId, businessName: "Stadium One" });

    const checkoutInit = await initializeEventCreationCheckout({
      pitchOwnerUserId: ownerUserId,
      email: "owner@example.com",
      callbackUrl: "http://127.0.0.1:3100/api/payments/chapa/callback",
      returnUrlBase: "http://127.0.0.1:3100/create-events/status",
      promoCode: "OWNER-WAIVER",
      eventPayload: {
        userId: ownerUserId,
        eventName: "Lifecycle Derby",
        categoryId,
        description: "Integration lifecycle event",
        startDate: startAt.toISOString(),
        endDate: endAt.toISOString(),
        location: "Integration Stadium",
        latitude: "9.03",
        longitude: "38.74",
        capacity: 6,
        price: 100,
        recurrenceEnabled: false,
      },
    });

    expect(checkoutInit.kind).toBe("waived");
    expect(checkoutInit.quote.waiverReason).toBe("promo");

    const created = await prisma.$transaction(async (tx) => {
      const eventResult = await createEventWithClient(tx, {
        userId: ownerUserId,
        eventName: "Lifecycle Derby",
        categoryId,
        description: "Integration lifecycle event",
        startDate: startAt.toISOString(),
        endDate: endAt.toISOString(),
        location: "Integration Stadium",
        latitude: "9.03",
        longitude: "38.74",
        capacity: 6,
        price: 100,
        recurrenceEnabled: false,
      });

      await recordWaivedEventCreation(
        {
          pitchOwnerUserId: ownerUserId,
          eventId: eventResult.event.eventId as string,
          quote: checkoutInit.quote,
        },
        tx,
      );

      return eventResult;
    });

    const eventId = created.event.eventId as string;

    const [promoAfterWaiver, creationPayment] = await Promise.all([
      prisma.promoCode.findUnique({ where: { id: "550e8400-e29b-41d4-a716-446655440415" } }),
      prisma.eventCreationPayment.findFirst({ where: { eventId } }),
    ]);

    expect(promoAfterWaiver?.usedCount).toBe(1);
    expect(creationPayment?.status).toBe("waived");

    await prisma.userBalance.create({
      data: {
        userId: buyerUserId,
        balanceEtb: 1_000,
      },
    });

    await expect(
      payWithBalance({
        eventId,
        userId: buyerUserId,
        quantity: 2,
        userEmail: "buyer@example.com",
        userName: "Buyer One",
        baseUrl: "http://127.0.0.1:3100",
      }),
    ).rejects.toThrow("This event is not accepting payments yet");

    await updatePitchOwnerPayoutSettings({
      userId: ownerUserId,
      businessName: "Stadium One",
      accountName: "Stadium Owner",
      accountNumber: "1002003004",
      bankCode: "128",
    });

    const purchase = await payWithBalance({
      eventId,
      userId: buyerUserId,
      quantity: 2,
      userEmail: "buyer@example.com",
      userName: "Buyer One",
      baseUrl: "http://127.0.0.1:3100",
    });

    expect(purchase.ok).toBe(true);
    expect(purchase.quantity).toBe(2);

    const payment = await prisma.payment.findFirst({
      where: {
        eventId,
        userId: buyerUserId,
        provider: "balance",
      },
    });

    expect(payment).toBeTruthy();
    const ownerBalanceAfterPurchase = await prisma.userBalance.findUnique({ where: { userId: ownerUserId } });
    expect(Number(ownerBalanceAfterPurchase?.balanceEtb ?? 0)).toBeGreaterThan(0);

    await prisma.eventWaitlist.create({
      data: {
        waitlistId: "550e8400-e29b-41d4-a716-446655440416",
        eventId,
        userId: waitlistUserId,
      },
    });

    const refund = await processRefund(eventId, buyerUserId, 1);

    expect(refund.ok).toBe(true);
    expect(refund.ticketCount).toBe(1);
    expect(refund.amountEtb).toBeGreaterThan(0);

    const [buyerBalanceAfterRefund, ownerBalanceAfterRefund, remainingAttendees, refunds] =
      await Promise.all([
        prisma.userBalance.findUnique({ where: { userId: buyerUserId } }),
        prisma.userBalance.findUnique({ where: { userId: ownerUserId } }),
        prisma.eventAttendee.findMany({ where: { eventId, userId: buyerUserId } }),
        prisma.refund.findMany({ where: { eventId, userId: buyerUserId } }),
      ]);

    expect(remainingAttendees).toHaveLength(1);
    expect(refunds).toHaveLength(1);
    expect(Number(buyerBalanceAfterRefund?.balanceEtb ?? 0)).toBeGreaterThan(
      Number(purchase.newBalance),
    );
    expect(Number(ownerBalanceAfterRefund?.balanceEtb ?? 0)).toBeLessThan(
      Number(ownerBalanceAfterPurchase?.balanceEtb ?? 0),
    );
  });
});
