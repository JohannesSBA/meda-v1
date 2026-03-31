import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSessionUser } from "@/lib/auth/guards";
import { getActiveReservationCountMap } from "@/lib/events/availability";
import { serializePublicEvent } from "@/lib/events/serializers";
import { parseSearchParams, validationErrorResponse } from "@/lib/validations/http";
import { profileStatusQuerySchema } from "@/lib/validations/profile";

export async function GET(request: Request) {
  const sessionCheck = await requireSessionUser();
  if (sessionCheck.response) return sessionCheck.response;
  const user = sessionCheck.user!;

  const url = new URL(request.url);
  const parsed = parseSearchParams(profileStatusQuerySchema, url.searchParams);
  if (!parsed.success) {
    return validationErrorResponse(parsed.error, "Invalid event filter");
  }

  const status = parsed.data.status;
  const page = parsed.data.page ?? 1;
  const limit = parsed.data.limit ?? 10;
  const now = new Date();

  const datetimeFilter =
    status === "past"
      ? { lt: now }
      : status === "all"
        ? undefined
        : { gte: now };

  const where = {
    userId: user.id,
    ...(datetimeFilter ? { eventEndtime: datetimeFilter } : {}),
  };

  const [total, events] = await Promise.all([
    prisma.event.count({ where }),
    prisma.event.findMany({
      where,
      include: { _count: { select: { attendees: true } } },
      orderBy: { eventDatetime: status === "past" ? "desc" : "asc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
  ]);
  const reservationCounts = await getActiveReservationCountMap(
    events.map((event) => event.eventId),
  );

  return NextResponse.json({
    total,
    page,
    limit,
    items: events.map((event) =>
      serializePublicEvent(event, {
        attendeeCount: event._count.attendees,
        reservedCount: reservationCounts.get(event.eventId) ?? 0,
      }),
    ),
  });
}
