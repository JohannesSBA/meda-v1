import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { decodeEventLocation } from "@/app/helpers/locationCodec";
import { requireAdminUser } from "@/lib/auth/guards";

export async function GET(request: Request) {
  const adminCheck = await requireAdminUser();
  if (adminCheck.response) return adminCheck.response;

  const url = new URL(request.url);
  const page = Math.max(Number(url.searchParams.get("page")) || 1, 1);
  const limit = Math.min(Math.max(Number(url.searchParams.get("limit")) || 20, 1), 100);
  const search = url.searchParams.get("search")?.trim() ?? "";

  const where = search
    ? {
        OR: [
          { eventName: { contains: search, mode: "insensitive" as const } },
          { description: { contains: search, mode: "insensitive" as const } },
          { eventLocation: { contains: search, mode: "insensitive" as const } },
        ],
      }
    : undefined;

  const [total, events] = await Promise.all([
    prisma.event.count({ where }),
    prisma.event.findMany({
      where,
      include: { _count: { select: { attendees: true } } },
      orderBy: { createdAt: "desc" },
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
        userId: event.userId,
        attendeeCount: event._count.attendees,
        isRecurring: event.isRecurring,
        seriesId: event.seriesId,
        addressLabel: decoded.addressLabel,
      };
    }),
  });
}
