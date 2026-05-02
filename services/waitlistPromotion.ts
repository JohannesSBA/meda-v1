import { prisma } from "@/lib/prisma";
import { resolveEventLocation } from "@/lib/location";
import { getLockedAvailabilitySnapshot } from "@/lib/events/availability";
import { sendTicketConfirmationEmail, sendWaitlistSpotAvailableEmail } from "@/services/email";
import { logger } from "@/lib/logger";
import { getAuthUserEmails } from "@/lib/auth/userLookup";

/**
 * Promotes waitlisted users to attendees when the event has capacity > 0.
 * Promotes in FIFO order (by waitlist createdAt).
 * Returns the number of users promoted.
 */
export async function promoteWaitlistForEvent(eventId: string): Promise<number> {
  const event = await prisma.event.findUnique({
    where: { eventId },
    select: {
      eventId: true,
      eventName: true,
      eventDatetime: true,
      eventEndtime: true,
      eventLocation: true,
      addressLabel: true,
      latitude: true,
      longitude: true,
      priceField: true,
    },
  });

  if (!event) return 0;

  // Paid events: free-seat promotion is not possible because users must pay.
  // Notify waitlisted users about the newly-available capacity instead.
  if ((event.priceField ?? 0) > 0) {
    return notifyWaitlistForPaidEvent(event, eventId);
  }

  const location = resolveEventLocation(event);

  let promoted = 0;
  let waitlistSlice: Array<{ userId: string }> = [];

  await prisma.$transaction(async (tx) => {
    const snapshot = await getLockedAvailabilitySnapshot(eventId, tx);
    if (!snapshot || snapshot.spotsLeft == null || snapshot.spotsLeft <= 0) {
      return;
    }

    // Re-fetch the waitlist inside the transaction with a row lock so we
    // can't race against concurrent joins or removals.
    const freshWaitlist = await tx.$queryRaw<Array<{ userId: string }>>`
      SELECT user_id AS "userId"
      FROM event_waitlist
      WHERE event_id = ${eventId}::uuid
      ORDER BY created_at ASC
      LIMIT ${snapshot.spotsLeft}
      FOR UPDATE
    `;

    waitlistSlice = freshWaitlist;

    for (const w of waitlistSlice) {
      await tx.eventAttendee.create({
        data: {
          eventId,
          userId: w.userId,
          purchaserUserId: w.userId,
          paymentId: null,
          status: "RSVPed",
        },
      });
      await tx.eventWaitlist.delete({
        where: { eventId_userId: { eventId, userId: w.userId } },
      });
      promoted++;
    }
  });

  if (promoted === 0) {
    return 0;
  }

  const promotedUserIds = waitlistSlice.map((w) => w.userId);
  const [userMap, allNewAttendees] = await Promise.all([
    getAuthUserEmails(promotedUserIds),
    // Single batched query for all newly-created attendees
    prisma.eventAttendee.findMany({
      where: { eventId, userId: { in: promotedUserIds }, paymentId: null },
      select: { attendeeId: true, userId: true },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const attendeesByUser = new Map<string, string[]>();
  for (const attendee of allNewAttendees) {
    const list = attendeesByUser.get(attendee.userId) ?? [];
    list.push(attendee.attendeeId);
    attendeesByUser.set(attendee.userId, list);
  }

  for (const w of waitlistSlice) {
    const user = userMap.get(w.userId);
    if (user?.email) {
      try {
        await sendTicketConfirmationEmail({
          to: user.email,
          buyerName: user.name,
          eventName: event.eventName,
          eventDateTime: event.eventDatetime,
          eventEndTime: event.eventEndtime,
          locationLabel: location.addressLabel,
          quantity: 1,
          eventId,
          attendeeIds: attendeesByUser.get(w.userId) ?? [],
        });
      } catch (err) {
        logger.error(
          `Failed to send waitlist promotion email for ${eventId} / ${w.userId}`,
          err,
        );
      }
    }
  }

  return promoted;
}

/**
 * For paid events, capacity can only be filled by payment — we cannot create
 * free attendee rows.  Instead we notify each waitlisted user (FIFO, up to the
 * newly-available spots) so they can rush to checkout.
 * Returns the number of users notified.
 */
async function notifyWaitlistForPaidEvent(
  event: {
    eventName: string;
    eventDatetime: Date;
    eventLocation: string | null;
    addressLabel: string | null;
    latitude: number | null;
    longitude: number | null;
  },
  eventId: string,
): Promise<number> {
  // Count how many spots have just become available.
  const snapshot = await prisma.$transaction(async (tx) => getLockedAvailabilitySnapshot(eventId, tx));
  if (!snapshot || snapshot.spotsLeft == null || snapshot.spotsLeft <= 0) return 0;

  const waitlistEntries = await prisma.eventWaitlist.findMany({
    where: { eventId },
    orderBy: { createdAt: "asc" },
    take: snapshot.spotsLeft,
    select: { userId: true },
  });

  if (waitlistEntries.length === 0) return 0;

  const userIds = waitlistEntries.map((w) => w.userId);
  const userMap = await getAuthUserEmails(userIds);
  const location = resolveEventLocation(event);
  let notified = 0;

  for (const w of waitlistEntries) {
    const user = userMap.get(w.userId);
    if (user?.email) {
      try {
        await sendWaitlistSpotAvailableEmail({
          to: user.email,
          userName: user.name,
          eventName: event.eventName,
          eventDateTime: event.eventDatetime,
          locationLabel: location.addressLabel,
          eventId,
        });
        notified++;
      } catch (err) {
        logger.error(
          `Failed to send paid-waitlist spot-available email for ${eventId} / ${w.userId}`,
          err,
        );
      }
    }
  }

  return notified;
}
