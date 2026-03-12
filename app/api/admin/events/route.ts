import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminUser } from "@/lib/auth/guards";
import {
  computeSpotsLeft,
  getActiveReservationCountMap,
} from "@/lib/events/availability";
import { resolveEventLocation } from "@/lib/location";
import { parseSearchParams, validationErrorResponse } from "@/lib/validations/http";
import { adminEventListQuerySchema } from "@/lib/validations/admin";

export async function GET(request: Request) {
  const adminCheck = await requireAdminUser();
  if (adminCheck.response) return adminCheck.response;

  const url = new URL(request.url);
  const parsed = parseSearchParams(adminEventListQuerySchema, url.searchParams);
  if (!parsed.success) {
    return validationErrorResponse(parsed.error, "Invalid admin event query");
  }

  const { page, limit, search } = parsed.data;

  const where = search
    ? {
        OR: [
          { eventName: { contains: search, mode: "insensitive" as const } },
          { description: { contains: search, mode: "insensitive" as const } },
          { addressLabel: { contains: search, mode: "insensitive" as const } },
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
  const reservationCounts = await getActiveReservationCountMap(
    events.map((event) => event.eventId),
  );

  return NextResponse.json({
    total,
    page,
    limit,
    items: events.map((event) => {
      const location = resolveEventLocation(event);
      return {
        eventId: event.eventId,
        eventName: event.eventName,
        eventDatetime: event.eventDatetime.toISOString(),
        eventEndtime: event.eventEndtime.toISOString(),
        userId: event.userId,
        attendeeCount: event._count.attendees,
        isRecurring: event.isRecurring,
        seriesId: event.seriesId,
        description: event.description,
        pictureUrl: event.pictureUrl,
        priceField: event.priceField,
        capacity: event.capacity,
        spotsLeft: computeSpotsLeft(
          event.capacity,
          event._count.attendees,
          reservationCounts.get(event.eventId) ?? 0,
        ),
        reservedCount: reservationCounts.get(event.eventId) ?? 0,
        categoryId: event.categoryId,
        eventLocation: event.eventLocation,
        updatedAt: event.updatedAt.toISOString(),
        addressLabel: location.addressLabel,
        latitude: location.latitude,
        longitude: location.longitude,
      };
    }),
  });
}
