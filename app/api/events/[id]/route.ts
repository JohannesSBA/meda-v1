import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { decodeEventLocation } from "@/app/helpers/locationCodec";
import { requireSessionUser } from "@/lib/auth/guards";
import { sendTicketConfirmationEmail } from "@/services/email";
import { auth } from "@/lib/auth/server";
import { checkRateLimit, getClientId } from "@/lib/ratelimit";
import { MAX_TICKETS_PER_USER_PER_EVENT, MAX_SERIES_OCCURRENCES } from "@/lib/constants";
import { logger } from "@/lib/logger";
import { eventRegistrationSchema } from "@/lib/validations/events";

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

  // Only reveal ticket count for the currently authenticated user
  let myTickets: number | null = null;
  if (userId && /^[0-9a-fA-F-]{36}$/.test(userId)) {
    try {
      const { data: sessionData } = await auth.getSession();
      const sessionUserId = (sessionData?.user as { id?: string } | null)?.id;
      if (sessionUserId && sessionUserId === userId) {
        myTickets = await prisma.eventAttendee.count({
          where: { eventId: id, userId },
        });
      }
    } catch {
      // No session — myTickets stays null
    }
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
      take: MAX_SERIES_OCCURRENCES,
    });

    const myTicketCounts = new Map<string, number>();
    // myTickets in occurrences is only populated when userId matches the session user
    if (
      myTickets !== null &&
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
  const rl = await checkRateLimit(`register:${getClientId(request)}`, 10, 60_000);
  if (rl.limited) {
    return NextResponse.json(
      { error: "Too many requests. Please wait before registering again." },
      {
        status: 429,
        headers: { "Retry-After": String(Math.ceil(rl.retryAfterMs / 1000)) },
      },
    );
  }

  const session = await requireSessionUser();
  if (!session.user || session.response) return session.response!;

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = eventRegistrationSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request body", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const { quantity: qty, userId } = parsed.data;

  if (userId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const event = await prisma.event.findUnique({ where: { eventId: id } });
  if (!event)
    return NextResponse.json({ error: "Event not found" }, { status: 404 });

  if (event.eventEndtime <= new Date()) {
    return NextResponse.json({ error: "Event has ended" }, { status: 400 });
  }

  if (event.capacity != null && qty > event.capacity) {
    return NextResponse.json(
      { error: "Not enough seats available" },
      { status: 400 },
    );
  }

  const existingTickets = await prisma.eventAttendee.count({
    where: { eventId: id, userId },
  });
  if (existingTickets + qty > MAX_TICKETS_PER_USER_PER_EVENT) {
    return NextResponse.json(
      {
        error: `You can hold at most ${MAX_TICKETS_PER_USER_PER_EVENT} tickets for this event`,
      },
      { status: 400 },
    );
  }

  const rows = Array.from({ length: qty }).map(() => ({
    eventId: id,
    userId,
    status: "RSVPed" as const,
  }));

  try {
    await prisma.$transaction(async (tx) => {
      if (event.capacity != null) {
        const updated = await tx.event.updateMany({
          where: {
            eventId: id,
            capacity: { gte: qty },
          },
          data: {
            capacity: { decrement: qty },
          },
        });
        if (updated.count === 0) throw new Error("Not enough seats available");
      }

      await tx.eventAttendee.createMany({ data: rows });
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to register";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const updatedCount = await prisma.eventAttendee.count({
    where: { eventId: id },
  });

  revalidatePath(`/events/${id}`);
  revalidatePath("/events");

  if (session.user.email) {
    const decodedLocation = decodeEventLocation(event.eventLocation);
    const attendees = await prisma.eventAttendee.findMany({
      where: { eventId: id, userId },
      select: { attendeeId: true },
      orderBy: { createdAt: "desc" },
    });
    try {
      await sendTicketConfirmationEmail({
        to: session.user.email,
        buyerName: session.user.name ?? null,
        eventName: event.eventName,
        eventDateTime: event.eventDatetime,
        eventEndTime: event.eventEndtime,
        locationLabel: decodedLocation.addressLabel,
        quantity: qty,
        eventId: id,
        attendeeIds: attendees.map((a) => a.attendeeId),
        baseUrl: new URL(request.url).origin,
      });
    } catch (error) {
      logger.error("Failed to send ticket confirmation email", error);
    }
  }

  return NextResponse.json(
    { ok: true, attendeeCount: updatedCount },
    { status: 201 },
  );
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await requireSessionUser();
  if (!session.user || session.response) return session.response!;

  const { id } = await params;

  const { processRefund } = await import("@/services/refunds");

  try {
    const result = await processRefund(id, session.user.id);

    revalidatePath(`/events/${id}`);
    revalidatePath("/events");

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to cancel tickets";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
