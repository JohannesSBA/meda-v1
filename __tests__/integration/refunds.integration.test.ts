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

vi.mock("@/services/email", () => ({
  sendRefundConfirmationEmail: vi.fn(),
  sendWaitlistSpotAvailableEmail: vi.fn(),
}));

vi.mock("@/lib/auth/userLookup", () => ({
  getAuthUserEmails: mockGetAuthUserEmails,
}));

describe.sequential("refund integration", () => {
  let prisma: PrismaClient;
  let container: Parameters<typeof stopIntegrationDatabase>[0];
  let integrationReady = false;
  let skipReason = "";
  let processRefund: typeof import("@/services/refunds").processRefund;

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
    ({ processRefund } = await import("@/services/refunds"));
  }, 120_000);

  afterAll(async () => {
    await stopIntegrationDatabase(container);
  }, 60_000);

  beforeEach(async () => {
    if (!integrationReady) return;
    await resetDatabase(prisma);
    mockGetAuthUserEmails.mockClear();
  });

  test("refunds tickets, credits balance, and deletes scanned attendees", async () => {
    if (!integrationReady) {
      return;
    }

    const categoryId = "550e8400-e29b-41d4-a716-446655440210";
    const eventId = "550e8400-e29b-41d4-a716-446655440211";
    const userId = "550e8400-e29b-41d4-a716-446655440212";
    const attendeeId = "550e8400-e29b-41d4-a716-446655440213";
    const secondAttendeeId = "550e8400-e29b-41d4-a716-446655440214";

    const startAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
    const endAt = new Date(startAt.getTime() + 2 * 60 * 60 * 1000);

    await prisma.category.create({
      data: {
        categoryId,
        categoryName: "Football",
      },
    });

    await prisma.event.create({
      data: {
        eventId,
        eventName: "Integration Refund Match",
        eventDatetime: startAt,
        eventEndtime: endAt,
        eventLocation: "Integration Arena!longitude=38.75&latitude=9.02",
        addressLabel: "Integration Arena",
        latitude: 9.02,
        longitude: 38.75,
        capacity: 10,
        priceField: 120,
        userId: "550e8400-e29b-41d4-a716-446655440215",
        categoryId,
      },
    });

    await prisma.eventAttendee.createMany({
      data: [
        {
          attendeeId,
          eventId,
          userId,
          purchaserUserId: userId,
          status: "RSVPed",
        },
        {
          attendeeId: secondAttendeeId,
          eventId,
          userId,
          purchaserUserId: userId,
          status: "RSVPed",
        },
      ],
    });

    await prisma.ticketScan.create({
      data: {
        scanId: "550e8400-e29b-41d4-a716-446655440216",
        attendeeId,
        eventId,
        scannedByUserId: "550e8400-e29b-41d4-a716-446655440217",
      },
    });

    const result = await processRefund(eventId, userId, 1);

    expect(result.ok).toBe(true);
    expect(result.ticketCount).toBe(1);
    expect(result.amountEtb).toBe(120);
    expect(result.newBalance).toBe(120);

    const [balance, remainingAttendees, deletedScan, refunds] = await Promise.all([
      prisma.userBalance.findUnique({ where: { userId } }),
      prisma.eventAttendee.findMany({
        where: { eventId, userId },
        orderBy: { attendeeId: "asc" },
      }),
      prisma.ticketScan.findUnique({ where: { attendeeId } }),
      prisma.refund.findMany({ where: { eventId, userId } }),
    ]);

    expect(Number(balance?.balanceEtb ?? 0)).toBe(120);
    expect(remainingAttendees).toHaveLength(1);
    expect(remainingAttendees[0]?.attendeeId).toBe(secondAttendeeId);
    expect(deletedScan).toBeNull();
    expect(refunds).toHaveLength(1);
  });
});
