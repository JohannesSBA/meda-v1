import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { decodeEventLocation } from "@/app/helpers/locationCodec";
import { requireSessionUser } from "@/lib/auth/guards";

export async function GET(request: Request) {
  const sessionCheck = await requireSessionUser();
  if (sessionCheck.response) return sessionCheck.response;
  const user = sessionCheck.user!;

  const url = new URL(request.url);
  const status = (url.searchParams.get("status") ?? "upcoming").toLowerCase();
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
      ...(dateFilter ? { eventDatetime: dateFilter } : {}),
    },
    include: { _count: { select: { attendees: true } } },
    orderBy: { eventDatetime: status === "past" ? "desc" : "asc" },
  });

  const ticketMap = new Map(grouped.map((row) => [row.eventId, row._count._all]));

  return NextResponse.json(
    {
      items: events.map((event) => {
        const decoded = decodeEventLocation(event.eventLocation);
        return {
          eventId: event.eventId,
          eventName: event.eventName,
          eventDatetime: event.eventDatetime.toISOString(),
          eventEndtime: event.eventEndtime.toISOString(),
          attendeeCount: event._count.attendees,
          capacity: event.capacity,
          ticketCount: ticketMap.get(event.eventId) ?? 0,
          priceField: event.priceField,
          pictureUrl: event.pictureUrl,
          addressLabel: decoded.addressLabel,
        };
      }),
    },
    { status: 200 }
  );
}
