import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireFacilitatorUser } from "@/lib/auth/guards";
import { getActiveReservationCountMap } from "@/lib/events/availability";
import { serializePublicEvent } from "@/lib/events/serializers";

export async function GET() {
  const sessionCheck = await requireFacilitatorUser();
  if (sessionCheck.response) return sessionCheck.response;

  const parentPitchOwnerUserId = sessionCheck.user!.parentPitchOwnerUserId;
  if (!parentPitchOwnerUserId) {
    return NextResponse.json({ items: [] }, { status: 200 });
  }

  const now = new Date();
  const events = await prisma.event.findMany({
    where: {
      userId: parentPitchOwnerUserId,
      eventEndtime: { gte: now },
    },
    include: { _count: { select: { attendees: true } } },
    orderBy: { eventDatetime: "asc" },
  });
  const reservationCounts = await getActiveReservationCountMap(
    events.map((event) => event.eventId),
  );

  return NextResponse.json({
    items: events.map((event) =>
      serializePublicEvent(event, {
        attendeeCount: event._count.attendees,
        reservedCount: reservationCounts.get(event.eventId) ?? 0,
      }),
    ),
  });
}
