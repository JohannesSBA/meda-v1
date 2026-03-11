import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { decodeEventLocation } from "@/app/helpers/locationCodec";
import { requireSessionUser } from "@/lib/auth/guards";
import { auth } from "@/lib/auth/server";
import { checkRateLimit, getClientId } from "@/lib/ratelimit";
import { MAX_SERIES_OCCURRENCES } from "@/lib/constants";
import { eventRegistrationSchema } from "@/lib/validations/events";
import { registerForEvent } from "@/services/registrations";

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

  try {
    const result = await registerForEvent({
      eventId: id,
      userId,
      quantity: qty,
      userEmail: session.user.email ?? null,
      userName: session.user.name ?? null,
      baseUrl: new URL(request.url).origin,
    });

    revalidatePath(`/events/${id}`);
    revalidatePath("/events");

    return NextResponse.json(
      { ok: result.ok, attendeeCount: result.attendeeCount },
      { status: 201 },
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to register";
    const status =
      message.includes("Event not found")
        ? 404
        : message.includes("ended") ||
            message.includes("seats") ||
            message.includes("hold at most")
          ? 400
          : 400;
    return NextResponse.json({ error: message }, { status });
  }
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
