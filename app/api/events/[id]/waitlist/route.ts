import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSessionUser } from "@/lib/auth/guards";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const sessionCheck = await requireSessionUser();
  if (sessionCheck.response) return sessionCheck.response;
  const user = sessionCheck.user!;

  const { id: eventId } = await params;

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

  const { id: eventId } = await params;

  const event = await prisma.event.findUnique({ where: { eventId } });
  if (!event) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  const capacity = event.capacity;
  if (capacity == null || capacity > 0) {
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

  const { id: eventId } = await params;

  await prisma.eventWaitlist.deleteMany({
    where: { eventId, userId: user.id },
  });

  return NextResponse.json({ ok: true });
}
