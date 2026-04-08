import { NextResponse } from "next/server";
import { getAppBaseUrl } from "@/lib/env";
import { prisma } from "@/lib/prisma";
import { resolveEventLocation } from "@/lib/location";
import { BookingStatus } from "@/generated/prisma/client";
import { sendEventReminderEmail, sendHostReviewReminderEmail } from "@/services/email";
import { logger } from "@/lib/logger";
import { getAuthUserEmails } from "@/lib/auth/userLookup";
import { notifyUserById } from "@/services/actionNotifications";
import {
  bookingNotificationInclude,
  listBookingNotificationRecipients,
} from "@/services/bookingNotifications";

const REMINDER_WINDOWS = [
  { hours: 24, label: "24h" },
  { hours: 1, label: "1h" },
] as const;

const REVIEW_REMINDER_WINDOW = { hoursAfterEnd: 24, label: "review_24h" } as const;

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

async function getAlreadySentBookings(
  bookingIds: string[],
  userIds: string[],
  reminderType: string,
): Promise<Set<string>> {
  if (bookingIds.length === 0 || userIds.length === 0) return new Set();
  try {
    const rows = await prisma.$queryRaw<
      Array<{ booking_id: string; user_id: string }>
    >`
      SELECT booking_id, user_id FROM reminder_log
      WHERE booking_id = ANY(${bookingIds}::uuid[])
        AND user_id = ANY(${userIds}::uuid[])
        AND reminder_type = ${reminderType}
    `;
    return new Set(rows.map((row) => `${row.booking_id}:${row.user_id}`));
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

async function logBookingReminderSent(
  bookingId: string,
  userId: string,
  reminderType: string,
): Promise<void> {
  try {
    await prisma.$executeRawUnsafe(
      `INSERT INTO reminder_log (reminder_log_id, booking_id, user_id, reminder_type, sent_at)
       VALUES (gen_random_uuid(), $1::uuid, $2::uuid, $3, NOW())
       ON CONFLICT (booking_id, user_id, reminder_type) DO NOTHING`,
      bookingId,
      userId,
      reminderType,
    );
  } catch (err) {
    logger.error("Failed to log booking reminder", err);
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

  for (const { hours, label } of REMINDER_WINDOWS) {
    const reminderType = `booking_${label}`;
    const now = new Date();
    const windowStart = new Date(now.getTime() + (hours - 0.5) * 60 * 60 * 1000);
    const windowEnd = new Date(now.getTime() + (hours + 0.5) * 60 * 60 * 1000);

    const bookings = await prisma.booking.findMany({
      where: {
        status: BookingStatus.CONFIRMED,
        slot: {
          startsAt: {
            gte: windowStart,
            lte: windowEnd,
          },
        },
      },
      include: bookingNotificationInclude,
    });

    const bookingIds = bookings.map((booking) => booking.id);
    const recipientsByBooking = new Map<
      string,
      Awaited<ReturnType<typeof listBookingNotificationRecipients>>
    >();
    const allUserIds = new Set<string>();

    for (const booking of bookings) {
      const recipients = await listBookingNotificationRecipients(booking);
      recipientsByBooking.set(booking.id, recipients);
      for (const recipient of recipients) {
        if (recipient.userId && recipient.email) {
          allUserIds.add(recipient.userId);
        }
      }
    }

    const alreadySent = await getAlreadySentBookings(
      bookingIds,
      [...allUserIds],
      reminderType,
    );
    const tasks: Array<{
      booking: (typeof bookings)[number];
      userId: string;
    }> = [];

    for (const booking of bookings) {
      const recipients = recipientsByBooking.get(booking.id) ?? [];
      for (const recipient of recipients) {
        if (!recipient.userId || !recipient.email) continue;
        const key = `${booking.id}:${recipient.userId}`;
        if (alreadySent.has(key)) continue;
        tasks.push({
          booking,
          userId: recipient.userId,
        });
      }
    }

    const BATCH_SIZE = 10;
    for (let i = 0; i < tasks.length; i += BATCH_SIZE) {
      const batch = tasks.slice(i, i + BATCH_SIZE);
      const results = await Promise.allSettled(
        batch.map(async ({ booking, userId }) => {
          const delivered = await notifyUserById({
            userId,
            subject: `Reminder: your booking starts in ${hours} hour${hours === 1 ? "" : "s"}`,
            title: "Your booking is coming up",
            message:
              "Your Meda booking starts soon. Open Tickets to review the players and QR passes before arrival.",
            details: [
              { label: "Place", value: booking.slot.pitch.name },
              {
                label: "Time",
                value: `${booking.slot.startsAt.toLocaleString()} - ${booking.slot.endsAt.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`,
              },
              {
                label: "Type",
                value: booking.productType === "MONTHLY" ? "Monthly group booking" : "Single visit",
              },
            ],
            ctaLabel: "Open Tickets",
            ctaPath: "/tickets",
          });

          if (!delivered) {
            return null;
          }

          await logBookingReminderSent(booking.id, userId, reminderType);
          return { bookingId: booking.id, userId };
        }),
      );

      for (const result of results) {
        if (result.status === "fulfilled") {
          if (result.value) {
            sent++;
          }
        } else {
          logger.error("Booking reminder batch item failed", result.reason);
          errors++;
        }
      }
    }
  }

  {
    const now = new Date();
    const windowStart = new Date(
      now.getTime() - (REVIEW_REMINDER_WINDOW.hoursAfterEnd + 0.5) * 60 * 60 * 1000,
    );
    const windowEnd = new Date(
      now.getTime() - (REVIEW_REMINDER_WINDOW.hoursAfterEnd - 0.5) * 60 * 60 * 1000,
    );

    const events = await prisma.event.findMany({
      where: {
        eventEndtime: {
          gte: windowStart,
          lte: windowEnd,
        },
      },
      include: {
        attendees: {
          where: {
            ticketScan: {
              isNot: null,
            },
          },
          select: { userId: true },
        },
      },
    });

    const eventIds = events.map((event) => event.eventId);
    const allUserIds = [
      ...new Set(events.flatMap((event) => event.attendees.map((attendee) => attendee.userId))),
    ];
    const userMap = await getAuthUserEmails(allUserIds);
    const alreadySent = await getAlreadySent(eventIds, allUserIds, REVIEW_REMINDER_WINDOW.label);

    const existingReviews = eventIds.length
      ? await prisma.hostReview.findMany({
          where: {
            eventId: { in: eventIds },
            reviewerId: { in: allUserIds },
          },
          select: { eventId: true, reviewerId: true },
        })
      : [];
    const reviewedSet = new Set(
      existingReviews.map((review) => `${review.eventId}:${review.reviewerId}`),
    );

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
        if (alreadySent.has(key) || reviewedSet.has(key)) continue;
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
          const reviewUrl = `${baseUrl}/events/${event.eventId}`;
          await sendHostReviewReminderEmail({
            to: authUser.email!,
            attendeeName: authUser.name,
            eventName: event.eventName,
            eventDateTime: event.eventDatetime,
            eventEndTime: event.eventEndtime,
            locationLabel,
            reviewUrl,
          });
          await logReminderSent(event.eventId, userId, REVIEW_REMINDER_WINDOW.label);
          return { eventId: event.eventId, userId };
        }),
      );

      for (const result of results) {
        if (result.status === "fulfilled") {
          sent++;
        } else {
          logger.error("Review reminder batch item failed", result.reason);
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
