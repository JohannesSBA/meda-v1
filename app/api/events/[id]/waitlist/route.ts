import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSessionUser } from "@/lib/auth/guards";
import {
  computeSpotsLeft,
  getActiveReservationCountForEvent,
} from "@/lib/events/availability";
import { eventIdParamSchema } from "@/lib/validations/events";
import { parseParams, validationErrorResponse } from "@/lib/validations/http";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const sessionCheck = await requireSessionUser();
  if (sessionCheck.response) return sessionCheck.response;
  const user = sessionCheck.user!;

  const parsed = parseParams(eventIdParamSchema, await params);
  if (!parsed.success) {
    return validationErrorResponse(parsed.error, "Invalid event id");
  }
  const { id: eventId } = parsed.data;

  const entry = await prisma.eventWaitlist.findUnique({
    where: {
      eventId_userId: { eventId, userId: user.id },
    },
  });

  return NextResponse.json({ onWaitlist: !!entry });
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const sessionCheck = await requireSessionUser();
  if (sessionCheck.response) return sessionCheck.response;
  const user = sessionCheck.user!;

  const parsed = parseParams(eventIdParamSchema, await params);
  if (!parsed.success) {
    return validationErrorResponse(parsed.error, "Invalid event id");
  }
  const { id: eventId } = parsed.data;

  const event = await prisma.event.findUnique({ where: { eventId } });
  if (!event) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }
  if (event.eventDatetime <= new Date()) {
    return NextResponse.json(
      { error: "This event has already started." },
      { status: 400 },
    );
  }

  const [attendeeCount, reservedCount] = await Promise.all([
    prisma.eventAttendee.count({ where: { eventId } }),
    getActiveReservationCountForEvent(eventId),
  ]);
  const spotsLeft = computeSpotsLeft(event.capacity, attendeeCount, reservedCount);
  if (spotsLeft == null || spotsLeft > 0) {
    return NextResponse.json(
      { error: "Event is not sold out. You can register directly." },
      { status: 400 },
    );
  }

  const existingAttendee = await prisma.eventAttendee.findFirst({
    where: { eventId, userId: user.id },
  });
  if (existingAttendee) {
    return NextResponse.json(
      { error: "You already have a ticket for this event." },
      { status: 400 },
    );
  }

  await prisma.eventWaitlist.upsert({
    where: {
      eventId_userId: { eventId, userId: user.id },
    },
    create: { eventId, userId: user.id },
    update: {},
  });

  return NextResponse.json({ ok: true, message: "You're on the waitlist" });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const sessionCheck = await requireSessionUser();
  if (sessionCheck.response) return sessionCheck.response;
  const user = sessionCheck.user!;

  const parsed = parseParams(eventIdParamSchema, await params);
  if (!parsed.success) {
    return validationErrorResponse(parsed.error, "Invalid event id");
  }
  const { id: eventId } = parsed.data;

  await prisma.eventWaitlist.deleteMany({
    where: { eventId, userId: user.id },
  });

  return NextResponse.json({ ok: true });
}
