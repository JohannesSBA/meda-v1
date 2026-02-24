import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { decodeEventLocation } from "@/app/helpers/locationCodec";
import { requireSessionUser } from "@/lib/auth/guards";

async function ensureSavedEventsTable() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS saved_events (
      saved_event_id UUID PRIMARY KEY,
      event_id UUID NOT NULL REFERENCES events(event_id) ON DELETE CASCADE,
      user_id UUID NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(event_id, user_id)
    )
  `);
}

export async function GET() {
  const sessionCheck = await requireSessionUser();
  if (sessionCheck.response) return sessionCheck.response;
  const user = sessionCheck.user!;

  await ensureSavedEventsTable();

  const savedRows = await prisma.$queryRaw<Array<{ event_id: string; created_at: Date }>>`
    SELECT event_id, created_at
    FROM saved_events
    WHERE user_id = ${user.id}::uuid
    ORDER BY created_at DESC
  `;

  const eventIds = savedRows.map((row) => row.event_id);
  if (eventIds.length === 0) {
    return NextResponse.json({ items: [] }, { status: 200 });
  }

  const events = await prisma.event.findMany({
    where: { eventId: { in: eventIds } },
    include: { _count: { select: { attendees: true } } },
  });
  const eventMap = new Map(events.map((event) => [event.eventId, event]));

  return NextResponse.json(
    {
      items: savedRows
        .map((saved) => {
          const event = eventMap.get(saved.event_id);
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
            savedAt: saved.created_at.toISOString(),
          };
        })
        .filter(Boolean),
    },
    { status: 200 }
  );
}

export async function POST(request: Request) {
  const sessionCheck = await requireSessionUser();
  if (sessionCheck.response) return sessionCheck.response;
  const user = sessionCheck.user!;

  await ensureSavedEventsTable();
  const body = (await request.json().catch(() => null)) as { eventId?: string } | null;
  const eventId = body?.eventId;
  if (!eventId || !/^[0-9a-fA-F-]{36}$/.test(eventId)) {
    return NextResponse.json({ error: "Valid eventId required" }, { status: 400 });
  }

  const event = await prisma.event.findUnique({ where: { eventId } });
  if (!event) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  await prisma.$executeRawUnsafe(
    `
      INSERT INTO saved_events (saved_event_id, event_id, user_id, created_at, updated_at)
      VALUES ($1::uuid, $2::uuid, $3::uuid, NOW(), NOW())
      ON CONFLICT (event_id, user_id)
      DO UPDATE SET updated_at = NOW()
    `,
    randomUUID(),
    eventId,
    user.id
  );

  return NextResponse.json({ ok: true }, { status: 200 });
}

export async function DELETE(request: Request) {
  const sessionCheck = await requireSessionUser();
  if (sessionCheck.response) return sessionCheck.response;
  const user = sessionCheck.user!;

  await ensureSavedEventsTable();
  const body = (await request.json().catch(() => null)) as { eventId?: string } | null;
  const eventId = body?.eventId;
  if (!eventId || !/^[0-9a-fA-F-]{36}$/.test(eventId)) {
    return NextResponse.json({ error: "Valid eventId required" }, { status: 400 });
  }

  await prisma.$executeRawUnsafe(
    `DELETE FROM saved_events WHERE event_id = $1::uuid AND user_id = $2::uuid`,
    eventId,
    user.id
  );

  return NextResponse.json({ ok: true }, { status: 200 });
}
