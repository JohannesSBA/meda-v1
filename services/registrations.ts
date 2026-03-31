/**
 * Registrations service -- free event registration (no payment).
 *
 * Handles capacity check, attendee creation, and ticket confirmation email.
 */

import { prisma } from "@/lib/prisma";
import { resolveEventLocation } from "@/lib/location";
import { getLockedAvailabilitySnapshot } from "@/lib/events/availability";
import { sendTicketConfirmationEmail } from "@/services/email";
import { logger } from "@/lib/logger";
import { MAX_TICKETS_PER_USER_PER_EVENT } from "@/lib/constants";

export type RegisterForEventParams = {
  eventId: string;
  userId: string;
  quantity: number;
  userEmail?: string | null;
  userName?: string | null;
  baseUrl: string;
};

export type RegisterForEventResult = {
  ok: true;
  attendeeCount: number;
};

export async function registerForEvent(
  params: RegisterForEventParams,
): Promise<RegisterForEventResult> {
  const { eventId, userId, quantity, userEmail, userName, baseUrl } = params;

  const event = await prisma.$transaction(async (tx) => {
    const snapshot = await getLockedAvailabilitySnapshot(eventId, tx);
    if (!snapshot) throw new Error("Event not found");
    if (snapshot.event.eventEndtime <= new Date()) {
      throw new Error("Event has ended");
    }
    if (snapshot.spotsLeft != null && quantity > snapshot.spotsLeft) {
      throw new Error("Not enough seats available");
    }

    const existingTickets =
      typeof tx.eventAttendee?.count === "function"
        ? await tx.eventAttendee.count({ where: { eventId, userId } })
        : await prisma.eventAttendee.count({ where: { eventId, userId } });
    if (existingTickets + quantity > MAX_TICKETS_PER_USER_PER_EVENT) {
      throw new Error(
        `You can hold at most ${MAX_TICKETS_PER_USER_PER_EVENT} tickets for this event`,
      );
    }

    await tx.eventAttendee.createMany({
      data: Array.from({ length: quantity }).map(() => ({
        eventId,
        userId,
        purchaserUserId: userId,
        paymentId: null,
        status: "RSVPed" as const,
      })),
    });

    return snapshot.event;
  });

  const attendeeCount = await prisma.eventAttendee.count({
    where: { eventId },
  });

  if (userEmail) {
    const location = resolveEventLocation(event);
    const attendees = await prisma.eventAttendee.findMany({
      where: { eventId, userId },
      select: { attendeeId: true },
      orderBy: { createdAt: "desc" },
    });
    try {
      await sendTicketConfirmationEmail({
        to: userEmail,
        buyerName: userName ?? null,
        eventName: event.eventName,
        eventDateTime: event.eventDatetime,
        eventEndTime: event.eventEndtime,
        locationLabel: location.addressLabel,
        quantity,
        eventId,
        attendeeIds: attendees.map((a) => a.attendeeId),
        baseUrl,
      });
    } catch (error) {
      logger.error("Failed to send ticket confirmation email", error);
    }
  }

  return {
    ok: true,
    attendeeCount,
  };
}
