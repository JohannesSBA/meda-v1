import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSessionUser } from "@/lib/auth/guards";
import { getActiveReservationCountMap } from "@/lib/events/availability";
import { serializePublicEvent } from "@/lib/events/serializers";
import { parseJsonBody, validationErrorResponse } from "@/lib/validations/http";
import { savedEventMutationSchema } from "@/lib/validations/profile";

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
  const reservationCounts = await getActiveReservationCountMap(eventIds);

  const savedOrder = new Map(savedRows.map((saved, index) => [saved.eventId, index]));
  const items = savedRows
    .map((saved) => {
      const event = eventMap.get(saved.eventId);
      if (!event) return null;
      return {
        ...serializePublicEvent(event, {
          attendeeCount: event._count.attendees,
          reservedCount: reservationCounts.get(event.eventId) ?? 0,
        }),
        savedAt: saved.createdAt.toISOString(),
      };
    })
    .filter(Boolean)
    .sort(
      (a, b) =>
        (savedOrder.get(a!.eventId) ?? 0) - (savedOrder.get(b!.eventId) ?? 0),
    );

  return NextResponse.json({ items }, { status: 200 });
}

export async function POST(request: Request) {
  const sessionCheck = await requireSessionUser();
  if (sessionCheck.response) return sessionCheck.response;
  const user = sessionCheck.user!;

  const parsed = await parseJsonBody(savedEventMutationSchema, request);
  if (!parsed.success) {
    return validationErrorResponse(parsed.error, "Valid eventId required");
  }

  const event = await prisma.event.findUnique({ where: { eventId: parsed.data.eventId } });
  if (!event) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  await prisma.savedEvent.upsert({
    where: {
      eventId_userId: { eventId: parsed.data.eventId, userId: user.id },
    },
    create: { eventId: parsed.data.eventId, userId: user.id },
    update: { updatedAt: new Date() },
  });

  return NextResponse.json({ ok: true }, { status: 200 });
}

export async function DELETE(request: Request) {
  const sessionCheck = await requireSessionUser();
  if (sessionCheck.response) return sessionCheck.response;
  const user = sessionCheck.user!;

  const parsed = await parseJsonBody(savedEventMutationSchema, request);
  if (!parsed.success) {
    return validationErrorResponse(parsed.error, "Valid eventId required");
  }

  await prisma.savedEvent.deleteMany({
    where: { eventId: parsed.data.eventId, userId: user.id },
  });

  return NextResponse.json({ ok: true }, { status: 200 });
}
