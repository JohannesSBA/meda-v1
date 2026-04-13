import { afterAll, beforeAll, beforeEach, describe, expect, test, vi } from "vitest";
import type { PrismaClient } from "@/generated/prisma/client";
import {
  getIntegrationPrisma,
  resetDatabase,
  startIntegrationDatabase,
  stopIntegrationDatabase,
} from "./helpers/postgres";

const TENANT_B_PITCH_NAME = "ZZZ_TENANT_B_PITCH_EXPORT_MARKER";
const TENANT_B_EVENT_NAME = "ZZZ_TENANT_B_EVENT_EXPORT_MARKER";

const mockGetAuthUserEmails = vi.fn(
  async (userIds: string[]) =>
    new Map(
      userIds.map((userId) => [
        userId,
        {
          email: `${userId.slice(0, 8)}@tenant.example.com`,
          name: `User ${userId.slice(0, 6)}`,
        },
      ]),
    ),
);

vi.mock("@/lib/auth/userLookup", () => ({
  getAuthUserEmails: mockGetAuthUserEmails,
}));

describe.sequential("owner dashboard CSV exports (cross-tenant isolation)", () => {
  let prisma: PrismaClient;
  let container: Parameters<typeof stopIntegrationDatabase>[0];
  let integrationReady = false;
  let exportOwnerDashboardCsv: typeof import("@/services/ownerAnalytics").exportOwnerDashboardCsv;

  const ownerA = "550e8400-e29b-41d4-a716-4466554400a1";
  const ownerB = "550e8400-e29b-41d4-a716-4466554400b2";
  const categoryId = "550e8400-e29b-41d4-a716-4466554400c3";
  const pitchBId = "550e8400-e29b-41d4-a716-4466554400d4";
  const slotBId = "550e8400-e29b-41d4-a716-4466554400e5";
  const bookingBId = "550e8400-e29b-41d4-a716-4466554400f6";
  const ticketBId = "550e8400-e29b-41d4-a716-4466554401a7";
  const eventBId = "550e8400-e29b-41d4-a716-4466554401b8";
  const paymentBId = "550e8400-e29b-41d4-a716-4466554401c9";
  const buyerUserId = "550e8400-e29b-41d4-a716-4466554401d0";

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
    ({ exportOwnerDashboardCsv } = await import("@/services/ownerAnalytics"));
  }, 120_000);

  afterAll(async () => {
    await stopIntegrationDatabase(container);
  }, 60_000);

  beforeEach(async () => {
    if (!integrationReady) return;
    await resetDatabase(prisma);
    mockGetAuthUserEmails.mockClear();
  });

  async function seedTenantBMarketplace() {
    const startAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const endAt = new Date(startAt.getTime() + 2 * 60 * 60 * 1000);
    const slotStart = new Date();
    const slotEnd = new Date(slotStart.getTime() + 60 * 60 * 1000);

    await prisma.category.create({
      data: {
        categoryId,
        categoryName: "Integration Category",
      },
    });

    await prisma.pitch.create({
      data: {
        id: pitchBId,
        ownerId: ownerB,
        name: TENANT_B_PITCH_NAME,
        categoryId,
        addressLabel: "B pitch",
        latitude: 9.02,
        longitude: 38.75,
      },
    });

    await prisma.bookableSlot.create({
      data: {
        id: slotBId,
        pitchId: pitchBId,
        categoryId,
        startsAt: slotStart,
        endsAt: slotEnd,
        capacity: 8,
        price: "100.00",
        currency: "ETB",
        productType: "DAILY",
        status: "OPEN",
        requiresParty: false,
        createdById: ownerB,
      },
    });

    await prisma.booking.create({
      data: {
        id: bookingBId,
        slotId: slotBId,
        userId: buyerUserId,
        productType: "DAILY",
        quantity: 1,
        totalAmount: "100.00",
        surchargeAmount: "0",
        ownerRevenueAmount: "80.00",
        currency: "ETB",
        status: "CONFIRMED",
      },
    });

    await prisma.bookingTicket.create({
      data: {
        id: ticketBId,
        bookingId: bookingBId,
        purchaserId: buyerUserId,
        status: "ASSIGNED",
      },
    });

    await prisma.event.create({
      data: {
        eventId: eventBId,
        eventName: TENANT_B_EVENT_NAME,
        eventDatetime: startAt,
        eventEndtime: endAt,
        eventLocation: "Somewhere",
        addressLabel: "Venue",
        latitude: 9.0,
        longitude: 38.0,
        capacity: 50,
        priceField: 100,
        userId: ownerB,
        categoryId,
      },
    });

    await prisma.payment.create({
      data: {
        paymentId: paymentBId,
        eventId: eventBId,
        userId: buyerUserId,
        amountEtb: "75.00",
        unitPriceEtb: "75.00",
        status: "succeeded",
        providerReference: "integration-export-payment-ref-001",
      },
    });
  }

  test("owner A CSV exports do not include tenant B slot bookings, tickets, or event payments", async () => {
    if (!integrationReady) return;

    await seedTenantBMarketplace();

    for (const type of ["bookings", "payments", "attendees"] as const) {
      const csv = await exportOwnerDashboardCsv({
        ownerId: ownerA,
        type,
      });
      expect(csv, `leak in ${type} export`).not.toContain(bookingBId);
      expect(csv, `leak in ${type} export`).not.toContain(ticketBId);
      expect(csv, `leak in ${type} export`).not.toContain(TENANT_B_PITCH_NAME);
      expect(csv, `leak in ${type} export`).not.toContain(TENANT_B_EVENT_NAME);
      expect(csv, `leak in ${type} export`).not.toContain(paymentBId);
    }
  });

  test("owner A cannot scope tenant B pitchId into exports (empty data rows)", async () => {
    if (!integrationReady) return;

    await seedTenantBMarketplace();

    for (const type of ["bookings", "payments", "attendees"] as const) {
      const csv = await exportOwnerDashboardCsv({
        ownerId: ownerA,
        pitchId: pitchBId,
        type,
      });
      const lines = csv.trim().split("\n");
      expect(lines.length, `${type} with foreign pitchId`).toBe(1);
      expect(csv).not.toContain(TENANT_B_PITCH_NAME);
      expect(csv).not.toContain(bookingBId);
    }
  });

  test("owner B exports include their own seeded markers (positive control)", async () => {
    if (!integrationReady) return;

    await seedTenantBMarketplace();

    const bookingsCsv = await exportOwnerDashboardCsv({
      ownerId: ownerB,
      type: "bookings",
    });
    expect(bookingsCsv).toContain(bookingBId);
    expect(bookingsCsv).toContain(TENANT_B_PITCH_NAME);

    const paymentsCsv = await exportOwnerDashboardCsv({
      ownerId: ownerB,
      type: "payments",
    });
    expect(paymentsCsv).toContain(TENANT_B_EVENT_NAME);

    const attendeesCsv = await exportOwnerDashboardCsv({
      ownerId: ownerB,
      type: "attendees",
    });
    expect(attendeesCsv).toContain(ticketBId);
    expect(attendeesCsv).toContain(TENANT_B_PITCH_NAME);
  });
});
