import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSessionUser } from "@/lib/auth/guards";
import { getActiveReservationCountMap } from "@/lib/events/availability";
import { serializePublicEvent } from "@/lib/events/serializers";
import { parseSearchParams, validationErrorResponse } from "@/lib/validations/http";
import { profileStatusQuerySchema } from "@/lib/validations/profile";
import { getUserEventTicketSummaryMap } from "@/services/ticketSummaries";

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
  const scope = parsed.data.scope ?? "related";
  const now = new Date();
  const dateFilter =
    status === "past"
      ? { lt: now }
      : status === "all"
        ? undefined
        : { gte: now };

  const [heldGrouped, refundableGrouped] = await Promise.all([
    prisma.eventAttendee.groupBy({
      by: ["eventId"],
      where: { userId: user.id },
      _count: { _all: true },
    }),
    scope === "related"
      ? prisma.eventAttendee.groupBy({
          by: ["eventId"],
          where: { purchaserUserId: user.id },
          _count: { _all: true },
        })
      : Promise.resolve([]),
  ]);

  const eventIds =
    scope === "held"
      ? heldGrouped.map((row) => row.eventId)
      : [...new Set([...heldGrouped, ...refundableGrouped].map((row) => row.eventId))];
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

  const reservationCounts = await getActiveReservationCountMap(eventIds);
  const ticketSummaryMap = await getUserEventTicketSummaryMap(
    user.id,
    events.map((event) => event.eventId),
  );

  return NextResponse.json(
    {
      items: events.map((event) => ({
        ...serializePublicEvent(event, {
          attendeeCount: event._count.attendees,
          reservedCount: reservationCounts.get(event.eventId) ?? 0,
        }),
        ticketCount: ticketSummaryMap.get(event.eventId)?.heldTicketCount ?? 0,
        heldTicketCount:
          ticketSummaryMap.get(event.eventId)?.heldTicketCount ?? 0,
        refundableTicketCount:
          ticketSummaryMap.get(event.eventId)?.refundableTicketCount ?? 0,
        refundableAmountEtb:
          ticketSummaryMap.get(event.eventId)?.refundableAmountEtb ?? 0,
      })),
    },
    { status: 200 },
  );
}
