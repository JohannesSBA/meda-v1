import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { NextResponse } from "next/server";
import { decodeEventLocation, haversineDistanceKm } from "@/app/helpers/locationCodec";

const DEFAULT_LIMIT = 8;
const DEFAULT_RADIUS_KM = 50;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  const page = Math.max(Number(searchParams.get("page")) || 1, 1);
  const limit = Math.max(Number(searchParams.get("limit")) || DEFAULT_LIMIT, 1);
  const search = searchParams.get("search")?.trim() || "";
  const sort = searchParams.get("sort") === "price" ? "price" : "date";
  const order = searchParams.get("order") === "desc" ? "desc" : "asc";
  const nearLat = Number(searchParams.get("nearLat"));
  const nearLng = Number(searchParams.get("nearLng"));
  const radiusKm = Number(searchParams.get("radiusKm")) || DEFAULT_RADIUS_KM;

  const predicates: Prisma.EventWhereInput[] = [
    { eventDatetime: { gte: new Date() } }, // only upcoming events
  ];

  if (search) {
    predicates.push({
      OR: [
        { eventName: { contains: search, mode: Prisma.QueryMode.insensitive } },
        { description: { contains: search, mode: Prisma.QueryMode.insensitive } },
        { eventLocation: { contains: search, mode: Prisma.QueryMode.insensitive } },
      ],
    });
  }

  const where: Prisma.EventWhereInput = { AND: predicates };

  const orderBy =
    sort === "price"
      ? { priceField: order as Prisma.SortOrder }
      : { eventDatetime: order as Prisma.SortOrder };

  const allEvents = await prisma.event.findMany({ where, orderBy });

  const shaped = allEvents.map((e) => {
    const decoded = decodeEventLocation(e.eventLocation);
    return {
      eventId: e.eventId,
      eventName: e.eventName,
      eventDatetime: e.eventDatetime.toISOString(),
      eventEndtime: e.eventEndtime.toISOString(),
      eventLocation: e.eventLocation,
      description: e.description,
      pictureUrl: e.pictureUrl,
      capacity: e.capacity,
      priceField: e.priceField,
      userId: e.userId,
      categoryId: e.categoryId,
      createdAt: e.createdAt.toISOString(),
      updatedAt: e.updatedAt.toISOString(),
      attendeeCount: undefined,
      addressLabel: decoded.addressLabel,
      latitude: decoded.latitude,
      longitude: decoded.longitude,
    };
  });

  const filtered =
    Number.isFinite(nearLat) && Number.isFinite(nearLng)
      ? shaped.filter((e) => {
          if (e.latitude == null || e.longitude == null) return false;
          const dist = haversineDistanceKm(
            { lat: nearLat, lng: nearLng },
            { lat: e.latitude, lng: e.longitude }
          );
          return dist <= radiusKm;
        })
      : shaped;

  const total = filtered.length;
  const offset = (page - 1) * limit;
  const items = filtered.slice(offset, offset + limit);

  return NextResponse.json({ items, total, offset, limit }, { status: 200 });
}
