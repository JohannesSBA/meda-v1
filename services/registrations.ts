/**
 * Registrations service -- free event registration (no payment).
 *
 * Handles capacity check, attendee creation, and ticket confirmation email.
 */

import { prisma } from "@/lib/prisma";
import { decodeEventLocation } from "@/app/helpers/locationCodec";
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

  const event = await prisma.event.findUnique({
    where: { eventId },
    select: {
      eventId: true,
      eventName: true,
      eventDatetime: true,
      eventEndtime: true,
      eventLocation: true,
      capacity: true,
    },
  });

  if (!event) throw new Error("Event not found");
  if (event.eventEndtime <= new Date()) throw new Error("Event has ended");
  if (event.capacity != null && quantity > event.capacity) {
    throw new Error("Not enough seats available");
  }

  const existingTickets = await prisma.eventAttendee.count({
    where: { eventId, userId },
  });
  if (existingTickets + quantity > MAX_TICKETS_PER_USER_PER_EVENT) {
    throw new Error(
      `You can hold at most ${MAX_TICKETS_PER_USER_PER_EVENT} tickets for this event`,
    );
  }

  const rows = Array.from({ length: quantity }).map(() => ({
    eventId,
    userId,
    status: "RSVPed" as const,
  }));

  await prisma.$transaction(async (tx) => {
    if (event.capacity != null) {
      const updated = await tx.event.updateMany({
        where: { eventId, capacity: { gte: quantity } },
        data: { capacity: { decrement: quantity } },
      });
      if (updated.count === 0) throw new Error("Not enough seats available");
    }

    await tx.eventAttendee.createMany({ data: rows });
  });

  const attendeeCount = await prisma.eventAttendee.count({
    where: { eventId },
  });

  if (userEmail) {
    const decodedLocation = decodeEventLocation(event.eventLocation);
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
        locationLabel: decodedLocation.addressLabel,
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
