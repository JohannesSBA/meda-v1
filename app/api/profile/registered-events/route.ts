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
    return validationErrorResponse(parsed.error, "Invalid registration filter");
  }

  const status = parsed.data.status;
  const now = new Date();
  const dateFilter =
    status === "past"
      ? { lt: now }
      : status === "all"
        ? undefined
        : { gte: now };

  const grouped = await prisma.eventAttendee.groupBy({
    by: ["eventId"],
    where: { userId: user.id },
    _count: { _all: true },
  });

  const eventIds = grouped.map((row) => row.eventId);
  if (eventIds.length === 0) {
    return NextResponse.json({ items: [] }, { status: 200 });
  }

  const events = await prisma.event.findMany({
    where: {
      eventId: { in: eventIds },
      ...(dateFilter ? { eventEndtime: dateFilter } : {}),
    },
    include: { _count: { select: { attendees: true } } },
    orderBy: { eventDatetime: status === "past" ? "desc" : "asc" },
  });

  const ticketMap = new Map(grouped.map((row) => [row.eventId, row._count._all]));
  const reservationCounts = await getActiveReservationCountMap(eventIds);

  return NextResponse.json(
    {
      items: events.map((event) => ({
        ...serializePublicEvent(event, {
          attendeeCount: event._count.attendees,
          reservedCount: reservationCounts.get(event.eventId) ?? 0,
        }),
        ticketCount: ticketMap.get(event.eventId) ?? 0,
      })),
    },
    { status: 200 },
  );
}
