import { Prisma, type HostReview } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { computeHostTrustMetrics, getHostTrustSummary } from "@/services/trustScore";

const DEFAULT_REVIEW_WINDOW_HOURS = Number(process.env.HOST_REVIEW_WINDOW_HOURS ?? "72");

export const HOST_REVIEW_TAGS = [
  "well_organized",
  "good_communication",
  "accurate_listing",
  "started_on_time",
  "friendly_host",
  "poor_organization",
  "misleading_listing",
  "started_late",
] as const;

export type HostReviewTag = (typeof HOST_REVIEW_TAGS)[number];
export type ReviewEligibilityCode =
  | "eligible"
  | "not_attended"
  | "too_early"
  | "review_window_expired"
  | "already_reviewed"
  | "event_cancelled";

export class HostReviewEligibilityError extends Error {
  constructor(public code: Exclude<ReviewEligibilityCode, "eligible">, message: string) {
    super(message);
    this.name = "HostReviewEligibilityError";
  }
}

export type EventReviewState = {
  eventId: string;
  hostId: string | null;
  code: ReviewEligibilityCode;
  eligible: boolean;
  hasReviewed: boolean;
  eventEndedAt: string | null;
  reviewWindowEndsAt: string | null;
};

function getReviewWindowEndsAt(eventEndtime: Date) {
  const ms = DEFAULT_REVIEW_WINDOW_HOURS * 60 * 60 * 1000;
  return new Date(eventEndtime.getTime() + ms);
}

function ensureValidTags(tags: string[]) {
  for (const tag of tags) {
    if (!HOST_REVIEW_TAGS.includes(tag as HostReviewTag)) {
      throw new Error(`Invalid review tag: ${tag}`);
    }
  }
}

export async function validateReviewEligibility(params: {
  eventId: string;
  reviewerId: string;
  now?: Date;
}) {
  const now = params.now ?? new Date();
  const event = await prisma.event.findUnique({
    where: { eventId: params.eventId },
    select: {
      eventId: true,
      userId: true,
      eventEndtime: true,
      attendees: {
        where: { purchaserUserId: params.reviewerId },
        select: { attendeeId: true, paymentId: true },
      },
    },
  });

  if (!event) {
    throw new HostReviewEligibilityError("not_attended", "Event not found");
  }

  const existing = await prisma.hostReview.findUnique({
    where: {
      reviewerId_eventId: {
        reviewerId: params.reviewerId,
        eventId: params.eventId,
      },
    },
  });

  if (existing) {
    throw new HostReviewEligibilityError("already_reviewed", "You already reviewed this host for this event.");
  }

  if (event.eventEndtime > now) {
    throw new HostReviewEligibilityError("too_early", "Reviews open after the event ends.");
  }

  const reviewWindowEndsAt = getReviewWindowEndsAt(event.eventEndtime);
  if (reviewWindowEndsAt < now) {
    throw new HostReviewEligibilityError("review_window_expired", "The rating window has expired for this event.");
  }

  if (event.attendees.length === 0) {
    throw new HostReviewEligibilityError("not_attended", "You must have a valid booking to leave a host review.");
  }

  const attendeeIds = event.attendees.map((attendee) => attendee.attendeeId);
  const scanCount = await prisma.ticketScan.count({
    where: {
      eventId: params.eventId,
      attendeeId: { in: attendeeIds },
    },
  });

  if (scanCount === 0) {
    throw new HostReviewEligibilityError("not_attended", "You must check in before rating this host.");
  }

  return {
    eventId: event.eventId,
    hostId: event.userId,
    reviewWindowEndsAt,
    eligibleBookingId: null as string | null,
  };
}

export async function getEventReviewStateForUser(params: {
  eventId: string;
  reviewerId: string;
  now?: Date;
}): Promise<EventReviewState> {
  const now = params.now ?? new Date();
  const event = await prisma.event.findUnique({
    where: { eventId: params.eventId },
    select: {
      eventId: true,
      userId: true,
      eventEndtime: true,
      attendees: {
        where: { purchaserUserId: params.reviewerId },
        select: { attendeeId: true },
      },
    },
  });

  if (!event) {
    return {
      eventId: params.eventId,
      hostId: null,
      code: "not_attended",
      eligible: false,
      hasReviewed: false,
      eventEndedAt: null,
      reviewWindowEndsAt: null,
    };
  }

  const eventEndedAt = event.eventEndtime.toISOString();
  const reviewWindowEndsAt = getReviewWindowEndsAt(event.eventEndtime).toISOString();

  const existing = await prisma.hostReview.findUnique({
    where: {
      reviewerId_eventId: {
        reviewerId: params.reviewerId,
        eventId: params.eventId,
      },
    },
  });

  if (existing) {
    return {
      eventId: event.eventId,
      hostId: event.userId,
      code: "already_reviewed",
      eligible: false,
      hasReviewed: true,
      eventEndedAt,
      reviewWindowEndsAt,
    };
  }

  if (event.eventEndtime > now) {
    return {
      eventId: event.eventId,
      hostId: event.userId,
      code: "too_early",
      eligible: false,
      hasReviewed: false,
      eventEndedAt,
      reviewWindowEndsAt,
    };
  }

  if (new Date(reviewWindowEndsAt) < now) {
    return {
      eventId: event.eventId,
      hostId: event.userId,
      code: "review_window_expired",
      eligible: false,
      hasReviewed: false,
      eventEndedAt,
      reviewWindowEndsAt,
    };
  }

  if (event.attendees.length === 0) {
    return {
      eventId: event.eventId,
      hostId: event.userId,
      code: "not_attended",
      eligible: false,
      hasReviewed: false,
      eventEndedAt,
      reviewWindowEndsAt,
    };
  }

  const scanCount = await prisma.ticketScan.count({
    where: {
      eventId: params.eventId,
      attendeeId: { in: event.attendees.map((entry) => entry.attendeeId) },
    },
  });

  if (scanCount === 0) {
    return {
      eventId: event.eventId,
      hostId: event.userId,
      code: "not_attended",
      eligible: false,
      hasReviewed: false,
      eventEndedAt,
      reviewWindowEndsAt,
    };
  }

  return {
    eventId: event.eventId,
    hostId: event.userId,
    code: "eligible",
    eligible: true,
    hasReviewed: false,
    eventEndedAt,
    reviewWindowEndsAt,
  };
}

export async function createReview(input: {
  eventId: string;
  reviewerId: string;
  rating: number;
  tags?: HostReviewTag[];
}): Promise<HostReview> {
  if (!Number.isInteger(input.rating) || input.rating < 1 || input.rating > 5) {
    throw new Error("Rating must be an integer from 1 to 5.");
  }

  const tags = [...new Set((input.tags ?? []) as string[])];
  ensureValidTags(tags);

  const eligibility = await validateReviewEligibility({
    eventId: input.eventId,
    reviewerId: input.reviewerId,
  });

  try {
    const review = await prisma.hostReview.create({
      data: {
        eventId: input.eventId,
        hostId: eligibility.hostId,
        reviewerId: input.reviewerId,
        rating: input.rating,
        tags,
      },
    });

    await computeHostTrustMetrics(eligibility.hostId);
    return review;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new HostReviewEligibilityError("already_reviewed", "You already reviewed this host for this event.");
    }
    throw error;
  }
}

export async function getHostReviewSummary(hostId: string) {
  const [agg, trust] = await Promise.all([
    prisma.hostReview.aggregate({
      where: { hostId },
      _avg: { rating: true },
      _count: { _all: true },
    }),
    getHostTrustSummary(hostId),
  ]);

  return {
    hostId,
    averageRating: Number((agg._avg.rating ?? 0).toFixed(2)),
    reviewCount: agg._count._all,
    trust,
  };
}

export async function getHostReviewsForAdminOrInternalUse(hostId: string) {
  return prisma.hostReview.findMany({
    where: { hostId },
    orderBy: { createdAt: "desc" },
  });
}
