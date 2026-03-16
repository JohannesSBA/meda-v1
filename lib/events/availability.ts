import { prisma } from "@/lib/prisma";
import {
  PaymentProvider,
  PaymentStatus,
  Prisma,
} from "@/generated/prisma/client";

export const CHAPA_HOLD_WINDOW_MS = 10 * 60 * 1000;

type DbClient = typeof prisma | Prisma.TransactionClient;

type LockedEventInventoryRow = {
  eventId: string;
  eventName: string;
  eventDatetime: Date;
  eventEndtime: Date;
  eventLocation: string | null;
  addressLabel: string | null;
  latitude: number | null;
  longitude: number | null;
  capacity: number | null;
  priceField: number | null;
  userId: string;
};

const ACTIVE_RESERVATION_STATUSES = [
  PaymentStatus.created,
  PaymentStatus.processing,
] as const;

export function computeSpotsLeft(
  capacityTotal: number | null,
  attendeeCount: number,
  reservedCount: number,
) {
  if (capacityTotal == null) return null;
  return Math.max(capacityTotal - attendeeCount - reservedCount, 0);
}

export async function getActiveReservationCountForEvent(
  eventId: string,
  db: DbClient = prisma,
  options?: { excludePaymentId?: string; now?: Date },
) {
  if (typeof db.payment?.aggregate !== "function") {
    return 0;
  }

  const now = options?.now ?? new Date();
  const aggregate = await db.payment.aggregate({
    where: {
      eventId,
      provider: PaymentProvider.chapa,
      status: { in: [...ACTIVE_RESERVATION_STATUSES] },
      reservationExpiresAt: { gt: now },
      ...(options?.excludePaymentId
        ? { paymentId: { not: options.excludePaymentId } }
        : {}),
    },
    _sum: { quantity: true },
  });
  return aggregate._sum.quantity ?? 0;
}

export async function getActiveReservationCountMap(
  eventIds: string[],
  db: DbClient = prisma,
  now = new Date(),
) {
  const counts = new Map<string, number>();
  if (eventIds.length === 0) return counts;
  if (typeof db.payment?.groupBy !== "function") return counts;

  const grouped = await db.payment.groupBy({
    by: ["eventId"],
    where: {
      eventId: { in: eventIds },
      provider: PaymentProvider.chapa,
      status: { in: [...ACTIVE_RESERVATION_STATUSES] },
      reservationExpiresAt: { gt: now },
    },
    _sum: { quantity: true },
  });

  grouped.forEach((entry) => {
    counts.set(entry.eventId, entry._sum.quantity ?? 0);
  });

  return counts;
}

export async function getAttendeeCountMap(
  eventIds: string[],
  db: DbClient = prisma,
) {
  const counts = new Map<string, number>();
  if (eventIds.length === 0) return counts;
  if (typeof db.eventAttendee?.groupBy !== "function") return counts;

  const grouped = await db.eventAttendee.groupBy({
    by: ["eventId"],
    where: {
      eventId: { in: eventIds },
    },
    _count: { _all: true },
  });

  grouped.forEach((entry) => {
    counts.set(entry.eventId, entry._count._all);
  });

  return counts;
}

export async function lockEventInventory(
  eventId: string,
  db: Prisma.TransactionClient,
) {
  const fallbackFindUnique = async () =>
    prisma.event.findUnique({
      where: { eventId },
      select: {
        eventId: true,
        eventName: true,
        eventDatetime: true,
        eventEndtime: true,
        eventLocation: true,
        addressLabel: true,
        latitude: true,
        longitude: true,
        capacity: true,
        priceField: true,
        userId: true,
      },
    });

  if (typeof db.$queryRaw !== "function") {
    return fallbackFindUnique();
  }

  if (typeof db.event?.findUnique !== "function") {
    return fallbackFindUnique();
  }

  const rows = await db.$queryRaw<LockedEventInventoryRow[]>`
    SELECT
      event_id AS "eventId",
      event_name AS "eventName",
      event_datetime AS "eventDatetime",
      event_endtime AS "eventEndtime",
      event_location AS "eventLocation",
      address_label AS "addressLabel",
      latitude AS "latitude",
      longitude AS "longitude",
      capacity AS "capacity",
      price_field AS "priceField",
      user_id AS "userId"
    FROM events
    WHERE event_id = ${eventId}::uuid
    FOR UPDATE
  `;

  return rows[0] ?? null;
}

export async function getLockedAvailabilitySnapshot(
  eventId: string,
  db: Prisma.TransactionClient,
  options?: { excludePaymentId?: string; now?: Date },
) {
  const event = await lockEventInventory(eventId, db);
  if (!event) return null;

  const attendeeCount =
    typeof db.eventAttendee?.count === "function"
      ? await db.eventAttendee.count({ where: { eventId } })
      : 0;
  const reservedCount = await getActiveReservationCountForEvent(eventId, db, {
    excludePaymentId: options?.excludePaymentId,
    now: options?.now,
  });

  return {
    event,
    attendeeCount,
    reservedCount,
    spotsLeft: computeSpotsLeft(event.capacity, attendeeCount, reservedCount),
  };
}
