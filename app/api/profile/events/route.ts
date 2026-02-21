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
  const page = Math.max(Number(url.searchParams.get("page")) || 1, 1);
  const limit = Math.min(Math.max(Number(url.searchParams.get("limit")) || 10, 1), 50);
  const now = new Date();

  const datetimeFilter =
    status === "past"
      ? { lt: now }
      : status === "all"
        ? undefined
        : { gte: now };

  const where = {
    userId: user.id,
    ...(datetimeFilter ? { eventDatetime: datetimeFilter } : {}),
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

  return NextResponse.json({
    total,
    page,
    limit,
    items: events.map((event) => {
      const decoded = decodeEventLocation(event.eventLocation);
      return {
        eventId: event.eventId,
        eventName: event.eventName,
        eventDatetime: event.eventDatetime.toISOString(),
        eventEndtime: event.eventEndtime.toISOString(),
        attendeeCount: event._count.attendees,
        capacity: event.capacity,
        priceField: event.priceField,
        seriesId: event.seriesId,
        isRecurring: event.isRecurring,
        recurrenceKind: event.recurrenceKind,
        occurrenceIndex: event.occurrenceIndex,
        addressLabel: decoded.addressLabel,
      };
    }),
  });
}
