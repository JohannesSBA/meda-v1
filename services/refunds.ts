/**
 * Refunds service -- processes event registration refunds and waitlist promotions.
 *
 * Handles balance restoration, attendee removal, and confirmation emails.
 */

import { prisma } from "@/lib/prisma";
import { decodeEventLocation } from "@/app/helpers/locationCodec";
import {
  sendRefundConfirmationEmail,
  sendWaitlistSpotAvailableEmail,
} from "@/services/email";
import { REFUND_CUTOFF_HOURS } from "@/lib/constants";
import { logger } from "@/lib/logger";
import { getAuthUserEmails } from "@/lib/auth/userLookup";

export type RefundResult = {
  ok: true;
  refundId: string;
  ticketCount: number;
  amountEtb: number;
  newBalance: number;
};

export async function processRefund(
  eventId: string,
  userId: string,
  requestedCount?: number,
): Promise<RefundResult> {
  const event = await prisma.event.findUnique({
    where: { eventId },
    select: {
      eventId: true,
      eventName: true,
      eventDatetime: true,
      eventEndtime: true,
      eventLocation: true,
      capacity: true,
      priceField: true,
    },
  });

  if (!event) throw new Error("Event not found");

  const now = new Date();
  const msUntilEvent = event.eventDatetime.getTime() - now.getTime();
  const hoursUntilEvent = msUntilEvent / (1000 * 60 * 60);

  if (hoursUntilEvent < REFUND_CUTOFF_HOURS) {
    throw new Error(
      "Refunds are not available within 24 hours of the event start time",
    );
  }

  if (event.eventEndtime <= now) {
    throw new Error("This event has already ended");
  }

  const userTickets = await prisma.eventAttendee.findMany({
    where: { eventId, userId },
    select: { attendeeId: true },
    orderBy: { createdAt: "asc" },
  });

  if (userTickets.length === 0) {
    throw new Error("You have no tickets for this event");
  }

  const ticketCount = requestedCount
    ? Math.min(requestedCount, userTickets.length)
    : userTickets.length;

  if (ticketCount < 1) {
    throw new Error("Invalid ticket count");
  }

  const perTicketPrice = event.priceField ?? 0;
  const refundAmount = perTicketPrice * ticketCount;

  const attendeeIdsToDelete = userTickets
    .slice(0, ticketCount)
    .map((t) => t.attendeeId);

  let newBalance = 0;
  let refundId = "";

  await prisma.$transaction(async (tx) => {
    await tx.ticketScan.deleteMany({
      where: { attendeeId: { in: attendeeIdsToDelete } },
    });

    await tx.eventAttendee.deleteMany({
      where: { attendeeId: { in: attendeeIdsToDelete } },
    });

    if (event.capacity != null) {
      await tx.event.update({
        where: { eventId },
        data: { capacity: { increment: ticketCount } },
      });
    }

    if (refundAmount > 0) {
      const existing = await tx.userBalance.findUnique({
        where: { userId },
      });

      if (existing) {
        const updated = await tx.userBalance.update({
          where: { userId },
          data: {
            balanceEtb: { increment: refundAmount },
          },
        });
        newBalance = Number(updated.balanceEtb);
      } else {
        const created = await tx.userBalance.create({
          data: {
            userId,
            balanceEtb: refundAmount,
          },
        });
        newBalance = Number(created.balanceEtb);
      }
    }

    const refund = await tx.refund.create({
      data: {
        eventId,
        userId,
        amountEtb: refundAmount,
        ticketCount,
      },
    });
    refundId = refund.refundId;
  });

  // Post-transaction: send emails (fire-and-forget)
  const userMap = await getAuthUserEmails([userId]);
  const refundUser = userMap.get(userId);

  if (refundUser?.email) {
    try {
      await sendRefundConfirmationEmail({
        to: refundUser.email,
        userName: refundUser.name,
        eventName: event.eventName,
        eventDateTime: event.eventDatetime,
        ticketCount,
        amountCredited: refundAmount,
        newBalance,
      });
    } catch (err) {
      logger.error("Failed to send refund confirmation email", err);
    }
  }

  // Notify waitlisted users that a spot is available
  const waitlistEntries = await prisma.eventWaitlist.findMany({
    where: { eventId },
    orderBy: { createdAt: "asc" },
    take: ticketCount,
  });

  if (waitlistEntries.length > 0) {
    const waitlistUserIds = waitlistEntries.map((w) => w.userId);
    const waitlistUserMap = await getAuthUserEmails(waitlistUserIds);
    const decoded = decodeEventLocation(event.eventLocation);

    for (const entry of waitlistEntries) {
      const user = waitlistUserMap.get(entry.userId);
      if (user?.email) {
        try {
          await sendWaitlistSpotAvailableEmail({
            to: user.email,
            userName: user.name,
            eventName: event.eventName,
            eventDateTime: event.eventDatetime,
            locationLabel: decoded.addressLabel,
            eventId,
          });
        } catch (err) {
          logger.error(
            `Failed to send waitlist notification for ${eventId} / ${entry.userId}`,
            err,
          );
        }
      }
    }
  }

  return {
    ok: true,
    refundId,
    ticketCount,
    amountEtb: refundAmount,
    newBalance,
  };
}
