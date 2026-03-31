import { afterAll, beforeAll, beforeEach, describe, expect, test, vi } from "vitest";
import type { PrismaClient } from "@/generated/prisma/client";
import { PaymentProvider, PaymentStatus } from "@/generated/prisma/client";
import {
  getIntegrationPrisma,
  resetDatabase,
  startIntegrationDatabase,
  stopIntegrationDatabase,
} from "./helpers/postgres";

const mockAxiosGet = vi.fn();
const mockAxiosPost = vi.fn();
const mockGenTxRef = vi.fn();

vi.mock("axios", () => ({
  default: {
    get: mockAxiosGet,
    post: mockAxiosPost,
    isAxiosError: () => false,
  },
  get: mockAxiosGet,
  post: mockAxiosPost,
  isAxiosError: () => false,
}));

vi.mock("chapa-nodejs", () => ({
  Chapa: class {
    genTxRef() {
      return mockGenTxRef();
    }
  },
}));

vi.mock("@/services/email", () => ({
  sendTicketConfirmationEmail: vi.fn(),
}));

describe.sequential("payments concurrency", () => {
  let prisma: PrismaClient;
  let container: Parameters<typeof stopIntegrationDatabase>[0];
  let integrationReady = false;
  let skipReason = "";
  let confirmChapaPayment: typeof import("@/services/payments").confirmChapaPayment;
  let initializeChapaCheckout: typeof import("@/services/payments").initializeChapaCheckout;

  beforeAll(async () => {
    const db = await startIntegrationDatabase();
    if (!db.available) {
      skipReason = db.reason;
      console.warn(`Skipping integration DB tests: ${skipReason}`);
      return;
    }

    integrationReady = true;
    container = db.container;
    vi.resetModules();
    prisma = await getIntegrationPrisma();
    ({ confirmChapaPayment, initializeChapaCheckout } = await import(
      "@/services/payments"
    ));
  }, 120_000);

  afterAll(async () => {
    await stopIntegrationDatabase(container);
  }, 60_000);

  beforeEach(async () => {
    if (!integrationReady) return;
    await resetDatabase(prisma);
    mockAxiosGet.mockReset();
    mockAxiosPost.mockReset();
    mockGenTxRef.mockReset();
  });

  test("fulfills a Chapa payment exactly once under concurrent confirmation", async () => {
    if (!integrationReady) {
      return;
    }

    const categoryId = "550e8400-e29b-41d4-a716-446655440310";
    const eventId = "550e8400-e29b-41d4-a716-446655440311";
    const userId = "550e8400-e29b-41d4-a716-446655440312";
    const txRef = "MEDA-CONFIRM-310";
    const startAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const endAt = new Date(startAt.getTime() + 2 * 60 * 60 * 1000);

    await prisma.category.create({
      data: { categoryId, categoryName: "Football" },
    });

    await prisma.event.create({
      data: {
        eventId,
        eventName: "Concurrent Confirm Match",
        eventDatetime: startAt,
        eventEndtime: endAt,
        eventLocation: "Concurrency Arena!longitude=38.75&latitude=9.02",
        addressLabel: "Concurrency Arena",
        latitude: 9.02,
        longitude: 38.75,
        capacity: 10,
        priceField: 100,
        userId: "550e8400-e29b-41d4-a716-446655440313",
        categoryId,
      },
    });

    await prisma.payment.create({
      data: {
        paymentId: "550e8400-e29b-41d4-a716-446655440314",
        eventId,
        userId,
        quantity: 2,
        unitPriceEtb: 100,
        amountEtb: 200,
        currency: "ETB",
        provider: PaymentProvider.chapa,
        providerReference: txRef,
        status: PaymentStatus.processing,
        reservationExpiresAt: new Date(Date.now() + 10 * 60 * 1000),
      },
    });

    mockAxiosGet.mockResolvedValue({
      data: {
        status: "success",
        data: {
          status: "success",
          tx_ref: txRef,
          amount: "200",
          currency: "ETB",
        },
      },
    });

    const results = await Promise.all([
      confirmChapaPayment({ txRef }),
      confirmChapaPayment({ txRef }),
    ]);

    const statuses = results.map((result) => result.status).sort();
    expect(statuses).toEqual(["already_confirmed", "fulfilled"]);

    const [payment, attendees] = await Promise.all([
      prisma.payment.findUnique({
        where: {
          provider_providerReference: {
            provider: PaymentProvider.chapa,
            providerReference: txRef,
          },
        },
      }),
      prisma.eventAttendee.findMany({ where: { eventId, userId } }),
    ]);

    expect(payment?.status).toBe(PaymentStatus.succeeded);
    expect(attendees).toHaveLength(2);
  });

  test("keeps only one active checkout hold for the same user and event", async () => {
    if (!integrationReady) {
      return;
    }

    const categoryId = "550e8400-e29b-41d4-a716-446655440320";
    const eventId = "550e8400-e29b-41d4-a716-446655440321";
    const userId = "550e8400-e29b-41d4-a716-446655440322";
    const startAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const endAt = new Date(startAt.getTime() + 90 * 60 * 1000);

    await prisma.category.create({
      data: { categoryId, categoryName: "Football" },
    });

    await prisma.event.create({
      data: {
        eventId,
        eventName: "Concurrent Hold Match",
        eventDatetime: startAt,
        eventEndtime: endAt,
        eventLocation: "Hold Arena!longitude=38.81&latitude=9.01",
        addressLabel: "Hold Arena",
        latitude: 9.01,
        longitude: 38.81,
        capacity: 1,
        priceField: 100,
        userId: "550e8400-e29b-41d4-a716-446655440323",
        categoryId,
      },
    });

    mockGenTxRef
      .mockReturnValueOnce("MEDA-HOLD-1")
      .mockReturnValueOnce("MEDA-HOLD-2");

    mockAxiosPost.mockImplementation(async (_url: string, body: { tx_ref: string }) => ({
      data: {
        status: "success",
        data: {
          checkout_url: `https://pay.example.test/${body.tx_ref}`,
        },
      },
    }));

    const [first, second] = await Promise.all([
      initializeChapaCheckout({
        eventId,
        quantity: 1,
        userId,
        email: "checkout@example.com",
        callbackUrl: "http://127.0.0.1:3100/api/payments/chapa/callback",
        returnUrlBase: "http://127.0.0.1:3100/payments/chapa/status",
      }),
      initializeChapaCheckout({
        eventId,
        quantity: 1,
        userId,
        email: "checkout@example.com",
        callbackUrl: "http://127.0.0.1:3100/api/payments/chapa/callback",
        returnUrlBase: "http://127.0.0.1:3100/payments/chapa/status",
      }),
    ]);

    expect(first.txRef).not.toBe(second.txRef);

    const payments = await prisma.payment.findMany({
      where: {
        eventId,
        userId,
        provider: PaymentProvider.chapa,
      },
      orderBy: { createdAt: "asc" },
    });

    expect(payments).toHaveLength(2);
    expect(
      payments.filter((payment) => payment.status === PaymentStatus.processing),
    ).toHaveLength(1);
    expect(
      payments.filter((payment) => payment.status === PaymentStatus.canceled),
    ).toHaveLength(1);
  });
});
