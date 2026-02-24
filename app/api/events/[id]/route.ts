"use server";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { decodeEventLocation } from "@/app/helpers/locationCodec";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const url = new URL(request.url);
  const userId = url.searchParams.get("userId");

  const event = await prisma.event.findUnique({
    where: { eventId: id },
    include: {
      category: true,
      _count: { select: { attendees: true } },
    },
  });

  if (!event)
    return NextResponse.json({ error: "Event not found" }, { status: 404 });

  const decoded = decodeEventLocation(event.eventLocation);

  let myTickets: number | null = null;
  if (userId && /^[0-9a-fA-F-]{36}$/.test(userId)) {
    myTickets = await prisma.eventAttendee.count({
      where: { eventId: id, userId },
    });
  }

  let occurrences:
    | Array<{
        eventId: string;
        eventDatetime: string;
        eventEndtime: string;
        attendeeCount: number;
        capacity: number | null;
        myTickets: number;
        occurrenceIndex: number | null;
      }>
    | undefined;
  if (event.seriesId) {
    const seriesEvents = await prisma.event.findMany({
      where: {
        seriesId: event.seriesId,
        eventEndtime: { gte: new Date() },
      },
      include: {
        _count: { select: { attendees: true } },
      },
      orderBy: { eventDatetime: "asc" },
      take: 120,
    });

    const myTicketCounts = new Map<string, number>();
    if (
      userId &&
      /^[0-9a-fA-F-]{36}$/.test(userId) &&
      seriesEvents.length > 0
    ) {
      const grouped = await prisma.eventAttendee.groupBy({
        by: ["eventId"],
        where: {
          userId,
          eventId: { in: seriesEvents.map((entry) => entry.eventId) },
        },
        _count: { _all: true },
      });
      grouped.forEach((entry) =>
        myTicketCounts.set(entry.eventId, entry._count._all),
      );
    }

    occurrences = seriesEvents.map((entry) => ({
      eventId: entry.eventId,
      eventDatetime: entry.eventDatetime.toISOString(),
      eventEndtime: entry.eventEndtime.toISOString(),
      attendeeCount: entry._count.attendees,
      capacity: entry.capacity,
      myTickets: myTicketCounts.get(entry.eventId) ?? 0,
      occurrenceIndex: entry.occurrenceIndex,
    }));
  }

  return NextResponse.json(
    {
      event: {
        ...event,
        attendeeCount: event._count.attendees,
        addressLabel: decoded.addressLabel,
        latitude: decoded.latitude,
        longitude: decoded.longitude,
        myTickets,
        occurrences,
      },
    },
    { status: 200 },
  );
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const { quantity, userId } = await request.json();
  const qty = Number(quantity) || 1;

  const isUuid =
    typeof userId === "string" && /^[0-9a-fA-F-]{36}$/.test(userId);
  if (!isUuid)
    return NextResponse.json(
      { error: "Valid userId required" },
      { status: 400 },
    );
  if (qty < 1 || qty > 20)
    return NextResponse.json(
      { error: "Quantity must be between 1 and 20" },
      { status: 400 },
    );

  const event = await prisma.event.findUnique({ where: { eventId: id } });
  if (!event)
    return NextResponse.json({ error: "Event not found" }, { status: 404 });

  if (event.eventEndtime <= new Date()) {
    return NextResponse.json({ error: "Event has ended" }, { status: 400 });
  }

  const currentCount = await prisma.eventAttendee.count({
    where: { eventId: id },
  });
  if (event.capacity != null && currentCount + qty > event.capacity) {
    return NextResponse.json(
      { error: "Not enough seats available" },
      { status: 400 },
    );
  }

  const rows = Array.from({ length: qty }).map(() => ({
    eventId: id,
    userId,
    status: "RSVPed" as const,
  }));

  await prisma.eventAttendee.createMany({ data: rows });

  const updatedCount = currentCount + qty;

  return NextResponse.json(
    { ok: true, attendeeCount: updatedCount },
    { status: 201 },
  );
}

export async function DELETE() {
  return NextResponse.json(
    { error: "Reservations are final and cannot be canceled." },
    { status: 405 },
  );
}
