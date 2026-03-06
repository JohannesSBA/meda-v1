import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { decodeEventLocation } from "@/app/helpers/locationCodec";
import { sendEventReminderEmail } from "@/services/email";

const REMINDER_WINDOWS = [
  { hours: 24, label: "24h" },
  { hours: 1, label: "1h" },
] as const;

const ALLOWED_SCHEMAS = ["neon_auth", "public"];
const ALLOWED_TABLES = ["user"];

type AuthUser = { id: string; email: string | null; name: string | null };

async function getAuthUserEmails(
  userIds: string[],
): Promise<Map<string, AuthUser>> {
  const map = new Map<string, AuthUser>();
  if (userIds.length === 0) return map;

  const schema =
    process.env.AUTH_SCHEMA && ALLOWED_SCHEMAS.includes(process.env.AUTH_SCHEMA)
      ? process.env.AUTH_SCHEMA
      : "neon_auth";
  const table =
    process.env.AUTH_USER_TABLE && ALLOWED_TABLES.includes(process.env.AUTH_USER_TABLE)
      ? process.env.AUTH_USER_TABLE
      : "user";

  try {
    const qualifiedTable = `"${schema}"."${table}"`;
    const rows = await prisma.$queryRawUnsafe<AuthUser[]>(
      `SELECT id, email, name FROM ${qualifiedTable} WHERE id = ANY($1::uuid[]) AND email IS NOT NULL`,
      userIds,
    );
    for (const row of rows ?? []) {
      if (row.email) map.set(row.id, row);
    }
  } catch (err) {
    console.error("Failed to fetch auth users for reminders:", err);
  }
  return map;
}

async function getAlreadySent(
  eventIds: string[],
  userIds: string[],
  reminderType: string,
): Promise<Set<string>> {
  if (eventIds.length === 0 || userIds.length === 0) return new Set();
  try {
    const rows = await prisma.$queryRaw<
      Array<{ event_id: string; user_id: string }>
    >`
      SELECT event_id, user_id FROM reminder_log
      WHERE event_id = ANY(${eventIds}::uuid[])
        AND user_id = ANY(${userIds}::uuid[])
        AND reminder_type = ${reminderType}
    `;
    return new Set(rows.map((r) => `${r.event_id}:${r.user_id}`));
  } catch {
    return new Set();
  }
}

async function logReminderSent(
  eventId: string,
  userId: string,
  reminderType: string,
): Promise<void> {
  try {
    await prisma.$executeRawUnsafe(
      `INSERT INTO reminder_log (reminder_log_id, event_id, user_id, reminder_type, sent_at)
       VALUES (gen_random_uuid(), $1::uuid, $2::uuid, $3, NOW())
       ON CONFLICT (event_id, user_id, reminder_type) DO NOTHING`,
      eventId,
      userId,
      reminderType,
    );
  } catch (err) {
    console.error("Failed to log reminder:", err);
  }
}

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? "https://meda.app";
  let sent = 0;
  let errors = 0;

  for (const { hours, label } of REMINDER_WINDOWS) {
    const now = new Date();
    const windowStart = new Date(now.getTime() + (hours - 0.5) * 60 * 60 * 1000);
    const windowEnd = new Date(now.getTime() + (hours + 0.5) * 60 * 60 * 1000);

    const events = await prisma.event.findMany({
      where: {
        eventDatetime: {
          gte: windowStart,
          lte: windowEnd,
        },
      },
      include: {
        attendees: { select: { userId: true } },
      },
    });

    const eventIds = events.map((e) => e.eventId);
    const allUserIds = [...new Set(events.flatMap((e) => e.attendees.map((a) => a.userId)))];

    const userMap = await getAuthUserEmails(allUserIds);
    const alreadySent = await getAlreadySent(eventIds, allUserIds, label);

    for (const event of events) {
      const decoded = decodeEventLocation(event.eventLocation);
      const eventUrl = `${baseUrl}/events/${event.eventId}`;

      for (const attendee of event.attendees) {
        const key = `${event.eventId}:${attendee.userId}`;
        if (alreadySent.has(key)) continue;

        const authUser = userMap.get(attendee.userId);
        if (!authUser?.email) continue;

        try {
          await sendEventReminderEmail({
            to: authUser.email,
            attendeeName: authUser.name,
            eventName: event.eventName,
            eventDateTime: event.eventDatetime,
            eventEndTime: event.eventEndtime,
            locationLabel: decoded.addressLabel,
            hoursUntil: hours,
            eventUrl,
          });
          await logReminderSent(event.eventId, attendee.userId, label);
          sent++;
        } catch (err) {
          console.error(`Reminder failed for ${event.eventId} / ${attendee.userId}:`, err);
          errors++;
        }
      }
    }
  }

  return NextResponse.json({
    ok: true,
    sent,
    errors,
  });
}
