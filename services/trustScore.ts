import { HostTrustBadge, type PrismaClient } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

export const TRUST_SCORE_VERSION = "v1";

export type HostTrustMetricsSummary = {
  hostId: string;
  avgRating: number;
  reviewCount: number;
  attendanceRate: number;
  cancellationRate: number;
  refundRate: number;
  repeatPlayerRate: number;
  trustScore: number;
  trustScoreVersion: string;
  trustBadge: HostTrustBadge;
  updatedAt: string;
};

type DbClient = Pick<
  PrismaClient,
  "hostReview" | "hostTrustMetrics" | "event" | "ticketScan" | "refund" | "payment" | "booking"
>;

function clamp01(value: number) {
  return Math.min(1, Math.max(0, value));
}

function asNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function mapScoreToTrustBadge(params: { reviewCount: number; trustScore: number }): HostTrustBadge {
  if (params.reviewCount < 3) return HostTrustBadge.NEW_HOST;
  if (params.trustScore >= 85) return HostTrustBadge.HIGHLY_RATED;
  if (params.trustScore >= 70) return HostTrustBadge.RELIABLE_HOST;
  return HostTrustBadge.NEEDS_IMPROVEMENT;
}

export function computeHostTrustScore(metrics: {
  avgRating: number;
  attendanceRate: number;
  cancellationRate: number;
  refundRate: number;
  repeatPlayerRate: number;
}) {
  const ratingQuality = clamp01(metrics.avgRating / 5);
  const attendance = clamp01(metrics.attendanceRate);
  const cancellationPenalty = clamp01(1 - metrics.cancellationRate);
  const refundPenalty = clamp01(1 - metrics.refundRate);
  const repeat = clamp01(metrics.repeatPlayerRate);

  const score =
    ratingQuality * 45 +
    attendance * 20 +
    cancellationPenalty * 15 +
    refundPenalty * 10 +
    repeat * 10;

  return Number(score.toFixed(2));
}

export async function computeHostTrustMetrics(hostId: string, db: DbClient = prisma): Promise<HostTrustMetricsSummary> {
  const [reviews, hostEvents, bookings] = await Promise.all([
    db.hostReview.findMany({ where: { hostId }, select: { rating: true } }),
    db.event.findMany({ where: { userId: hostId }, select: { eventId: true } }),
    db.booking.findMany({
      where: { slot: { pitch: { ownerId: hostId } } },
      select: { status: true, userId: true },
    }),
  ]);

  const eventIds = hostEvents.map((event) => event.eventId);

  const [eventAttendeesTotal, eventAttendeesCheckedIn, refunds, payments] = await Promise.all([
    eventIds.length > 0
      ? db.event.count({ where: { eventId: { in: eventIds }, attendees: { some: {} } } }).then(async () =>
          db.event.findMany({
            where: { eventId: { in: eventIds } },
            select: { _count: { select: { attendees: true } } },
          }),
        )
      : Promise.resolve([]),
    eventIds.length > 0
      ? db.ticketScan.count({ where: { eventId: { in: eventIds } } })
      : Promise.resolve(0),
    eventIds.length > 0
      ? db.refund.count({ where: { eventId: { in: eventIds } } })
      : Promise.resolve(0),
    eventIds.length > 0
      ? db.payment.count({ where: { eventId: { in: eventIds }, status: "succeeded" } })
      : Promise.resolve(0),
  ]);

  const attendeeTotal = Array.isArray(eventAttendeesTotal)
    ? eventAttendeesTotal.reduce((sum, event) => sum + (event._count.attendees ?? 0), 0)
    : 0;

  const reviewCount = reviews.length;
  const avgRating = reviewCount > 0
    ? Number((reviews.reduce((sum, review) => sum + review.rating, 0) / reviewCount).toFixed(2))
    : 0;

  const attendanceRate = attendeeTotal > 0 ? Number((eventAttendeesCheckedIn / attendeeTotal).toFixed(4)) : 0;
  const cancellationRate = bookings.length > 0
    ? Number((bookings.filter((booking) => booking.status === "CANCELLED").length / bookings.length).toFixed(4))
    : 0;
  const refundRate = payments > 0 ? Number((refunds / payments).toFixed(4)) : 0;

  const bookingCounts = new Map<string, number>();
  for (const booking of bookings) {
    if (!booking.userId) continue;
    bookingCounts.set(booking.userId, (bookingCounts.get(booking.userId) ?? 0) + 1);
  }
  const repeatUsers = Array.from(bookingCounts.values()).filter((count) => count > 1).length;
  const repeatPlayerRate = bookingCounts.size > 0 ? Number((repeatUsers / bookingCounts.size).toFixed(4)) : 0;

  const trustScore = computeHostTrustScore({
    avgRating,
    attendanceRate,
    cancellationRate,
    refundRate,
    repeatPlayerRate,
  });
  const trustBadge = mapScoreToTrustBadge({ reviewCount, trustScore });

  const persisted = await db.hostTrustMetrics.upsert({
    where: { hostId },
    create: {
      hostId,
      avgRating,
      reviewCount,
      attendanceRate,
      cancellationRate,
      refundRate,
      repeatPlayerRate,
      trustScore,
      trustScoreVersion: TRUST_SCORE_VERSION,
      trustBadge,
    },
    update: {
      avgRating,
      reviewCount,
      attendanceRate,
      cancellationRate,
      refundRate,
      repeatPlayerRate,
      trustScore,
      trustScoreVersion: TRUST_SCORE_VERSION,
      trustBadge,
    },
  });

  return {
    hostId,
    avgRating: asNumber(persisted.avgRating),
    reviewCount: persisted.reviewCount,
    attendanceRate: asNumber(persisted.attendanceRate),
    cancellationRate: asNumber(persisted.cancellationRate),
    refundRate: asNumber(persisted.refundRate),
    repeatPlayerRate: asNumber(persisted.repeatPlayerRate),
    trustScore: asNumber(persisted.trustScore),
    trustScoreVersion: persisted.trustScoreVersion,
    trustBadge: persisted.trustBadge,
    updatedAt: persisted.updatedAt.toISOString(),
  };
}

export async function getHostTrustSummary(hostId: string, db: DbClient = prisma): Promise<HostTrustMetricsSummary> {
  const existing = await db.hostTrustMetrics.findUnique({ where: { hostId } });
  if (!existing) return computeHostTrustMetrics(hostId, db);

  return {
    hostId,
    avgRating: asNumber(existing.avgRating),
    reviewCount: existing.reviewCount,
    attendanceRate: asNumber(existing.attendanceRate),
    cancellationRate: asNumber(existing.cancellationRate),
    refundRate: asNumber(existing.refundRate),
    repeatPlayerRate: asNumber(existing.repeatPlayerRate),
    trustScore: asNumber(existing.trustScore),
    trustScoreVersion: existing.trustScoreVersion,
    trustBadge: existing.trustBadge,
    updatedAt: existing.updatedAt.toISOString(),
  };
}
