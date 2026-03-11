import { prisma } from "@/lib/prisma";
import { decodeEventLocation } from "@/app/helpers/locationCodec";
import {
  sendRefundConfirmationEmail,
  sendWaitlistSpotAvailableEmail,
} from "@/services/email";

const REFUND_CUTOFF_HOURS = 24;

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
    console.error("Failed to fetch auth users for refund:", err);
  }
  return map;
}

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
    await tx.eventAttendee.deleteMany({
      where: { attendeeId: { in: attendeeIdsToDelete } },
    });

    await tx.$queryRawUnsafe(
      `DELETE FROM ticket_scan WHERE attendee_id = ANY($1::uuid[])`,
      attendeeIdsToDelete,
    );

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
      console.error("Failed to send refund confirmation email:", err);
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
          console.error(
            `Failed to send waitlist notification for ${eventId} / ${entry.userId}:`,
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
