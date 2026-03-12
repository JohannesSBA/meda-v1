import { NextResponse } from "next/server";
import { getAppBaseUrl } from "@/lib/env";
import { prisma } from "@/lib/prisma";
import { resolveEventLocation } from "@/lib/location";
import { sendEventReminderEmail } from "@/services/email";
import { logger } from "@/lib/logger";
import { getAuthUserEmails } from "@/lib/auth/userLookup";

const REMINDER_WINDOWS = [
  { hours: 24, label: "24h" },
  { hours: 1, label: "1h" },
] as const;

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
    logger.error("Failed to log reminder", err);
  }
}

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const baseUrl = getAppBaseUrl();
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

    const BATCH_SIZE = 10;
    const tasks: Array<{
      event: typeof events[number];
      userId: string;
      locationLabel: string | null;
    }> = [];

    for (const event of events) {
      const location = resolveEventLocation(event);
      for (const attendee of event.attendees) {
        const key = `${event.eventId}:${attendee.userId}`;
        if (alreadySent.has(key)) continue;
        const authUser = userMap.get(attendee.userId);
        if (!authUser?.email) continue;
        tasks.push({
          event,
          userId: attendee.userId,
          locationLabel: location.addressLabel,
        });
      }
    }

    for (let i = 0; i < tasks.length; i += BATCH_SIZE) {
      const batch = tasks.slice(i, i + BATCH_SIZE);
      const results = await Promise.allSettled(
        batch.map(async ({ event, userId, locationLabel }) => {
          const authUser = userMap.get(userId)!;
          const eventUrl = `${baseUrl}/events/${event.eventId}`;
          await sendEventReminderEmail({
            to: authUser.email!,
            attendeeName: authUser.name,
            eventName: event.eventName,
            eventDateTime: event.eventDatetime,
            eventEndTime: event.eventEndtime,
            locationLabel,
            hoursUntil: hours,
            eventUrl,
          });
          await logReminderSent(event.eventId, userId, label);
          return { eventId: event.eventId, userId };
        }),
      );
      for (const result of results) {
        if (result.status === "fulfilled") {
          sent++;
        } else {
          logger.error("Reminder batch item failed", result.reason);
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
