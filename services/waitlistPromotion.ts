import { prisma } from "@/lib/prisma";
import { resolveEventLocation } from "@/lib/location";
import { getLockedAvailabilitySnapshot } from "@/lib/events/availability";
import { sendTicketConfirmationEmail } from "@/services/email";
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
    include: {
      waitlist: { orderBy: { createdAt: "asc" } },
    },
  });

  if (!event || event.waitlist.length === 0) {
    return 0;
  }
  const location = resolveEventLocation(event);

  let promoted = 0;
  let waitlistSlice: typeof event.waitlist = [];

  await prisma.$transaction(async (tx) => {
    const snapshot = await getLockedAvailabilitySnapshot(eventId, tx);
    if (!snapshot || snapshot.spotsLeft == null || snapshot.spotsLeft <= 0) {
      return;
    }

    waitlistSlice = event.waitlist.slice(
      0,
      Math.min(snapshot.spotsLeft, event.waitlist.length),
    );

    for (const w of waitlistSlice) {
      await tx.eventAttendee.create({
        data: {
          eventId,
          userId: w.userId,
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

  const userIds = waitlistSlice.slice(0, promoted).map((w) => w.userId);
  const userMap = await getAuthUserEmails(userIds);

  for (let i = 0; i < promoted; i++) {
    const w = waitlistSlice[i];
    const user = userMap.get(w.userId);
    if (user?.email) {
      const attendees = await prisma.eventAttendee.findMany({
        where: { eventId, userId: w.userId },
        select: { attendeeId: true },
        orderBy: { createdAt: "desc" },
      });
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
          attendeeIds: attendees.map((a) => a.attendeeId),
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
