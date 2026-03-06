import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { decodeEventLocation } from "@/app/helpers/locationCodec";
import { requireSessionUser } from "@/lib/auth/guards";

export async function GET() {
  const sessionCheck = await requireSessionUser();
  if (sessionCheck.response) return sessionCheck.response;
  const user = sessionCheck.user!;

  const savedRows = await prisma.savedEvent.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    select: { eventId: true, createdAt: true },
  });

  const eventIds = savedRows.map((row) => row.eventId);
  if (eventIds.length === 0) {
    return NextResponse.json({ items: [] }, { status: 200 });
  }

  const events = await prisma.event.findMany({
    where: { eventId: { in: eventIds } },
    include: { _count: { select: { attendees: true } } },
  });
  const eventMap = new Map(events.map((event) => [event.eventId, event]));

  const savedOrder = new Map(savedRows.map((s, i) => [s.eventId, i]));
  const items = savedRows
    .map((saved) => {
      const event = eventMap.get(saved.eventId);
      if (!event) return null;
      const decoded = decodeEventLocation(event.eventLocation);
      return {
        eventId: event.eventId,
        eventName: event.eventName,
        eventDatetime: event.eventDatetime.toISOString(),
        eventEndtime: event.eventEndtime.toISOString(),
        attendeeCount: event._count.attendees,
        capacity: event.capacity,
        pictureUrl: event.pictureUrl,
        priceField: event.priceField,
        addressLabel: decoded.addressLabel,
        savedAt: saved.createdAt.toISOString(),
      };
    })
    .filter(Boolean)
    .sort((a, b) => (savedOrder.get(a!.eventId) ?? 0) - (savedOrder.get(b!.eventId) ?? 0));

  return NextResponse.json({ items }, { status: 200 });
}

export async function POST(request: Request) {
  const sessionCheck = await requireSessionUser();
  if (sessionCheck.response) return sessionCheck.response;
  const user = sessionCheck.user!;

  const body = (await request.json().catch(() => null)) as { eventId?: string } | null;
  const eventId = body?.eventId;
  if (!eventId || !/^[0-9a-fA-F-]{36}$/.test(eventId)) {
    return NextResponse.json({ error: "Valid eventId required" }, { status: 400 });
  }

  const event = await prisma.event.findUnique({ where: { eventId } });
  if (!event) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  await prisma.savedEvent.upsert({
    where: {
      eventId_userId: { eventId, userId: user.id },
    },
    create: { eventId, userId: user.id },
    update: { updatedAt: new Date() },
  });

  return NextResponse.json({ ok: true }, { status: 200 });
}

export async function DELETE(request: Request) {
  const sessionCheck = await requireSessionUser();
  if (sessionCheck.response) return sessionCheck.response;
  const user = sessionCheck.user!;

  const body = (await request.json().catch(() => null)) as { eventId?: string } | null;
  const eventId = body?.eventId;
  if (!eventId || !/^[0-9a-fA-F-]{36}$/.test(eventId)) {
    return NextResponse.json({ error: "Valid eventId required" }, { status: 400 });
  }

  await prisma.savedEvent.deleteMany({
    where: { eventId, userId: user.id },
  });

  return NextResponse.json({ ok: true }, { status: 200 });
}
