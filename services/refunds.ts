/**
 * Refunds service -- processes event registration refunds and waitlist promotions.
 *
 * Handles balance restoration, attendee removal, and confirmation emails.
 */

import { prisma } from "@/lib/prisma";
import { PaymentProvider } from "@/generated/prisma/client";
import { resolveEventLocation } from "@/lib/location";
import {
  sendRefundConfirmationEmail,
  sendWaitlistSpotAvailableEmail,
} from "@/services/email";
import { REFUND_CUTOFF_HOURS } from "@/lib/constants";
import { logger } from "@/lib/logger";
import { getAuthUserEmails } from "@/lib/auth/userLookup";
import { PLATFORM_COMMISSION_PERCENT } from "./pitchOwner";

export type RefundResult = {
  ok: true;
  refundId: string | null;
  refundIds: string[];
  ticketCount: number;
  amountEtb: number;
  newBalance: number;
};

export type RefundQuoteResult = {
  ok: true;
  heldTicketCount: number;
  refundableTicketCount: number;
  ticketCount: number;
  amountEtb: number;
};

type RefundableAttendeeRow = {
  attendeeId: string;
  userId: string;
  paymentId: string | null;
};

type RefundSelectionEntry = {
  paymentId: string | null;
  paymentTicketCount: number;
  paymentRefundAmount: number;
  payment: {
    provider: PaymentProvider;
    amountEtb: number;
    unitPriceEtb: number;
    ownerRevenueEtb: number;
    quantity: number;
    chapaSubaccountId: string | null;
  } | null;
};

type RefundSelection = {
  heldTicketCount: number;
  refundableTicketCount: number;
  ticketCount: number;
  refundAmount: number;
  selectedTickets: RefundableAttendeeRow[];
  paymentSelections: RefundSelectionEntry[];
};

function roundCurrency(value: number) {
  return Math.round(value * 100) / 100;
}

function assertRefundWindow(event: {
  eventId: string;
  eventDatetime: Date;
  eventEndtime: Date;
}) {
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
}

function prioritizeHeldTickets(
  tickets: Array<{
    attendeeId: string;
    userId: string | null;
    paymentId: string | null;
  }>,
  userId: string,
) {
  return tickets
    .map((ticket) => ({
      attendeeId: ticket.attendeeId,
      userId: ticket.userId ?? userId,
      paymentId: ticket.paymentId ?? null,
    }))
    .sort((left, right) => {
      const leftOwned = left.userId === userId ? 0 : 1;
      const rightOwned = right.userId === userId ? 0 : 1;
      return leftOwned - rightOwned;
    });
}

async function listRefundableTickets(
  db: Pick<typeof prisma, "eventAttendee"> & { $queryRaw?: typeof prisma.$queryRaw },
  eventId: string,
  userId: string,
  forUpdate = false,
) {
  if (forUpdate && typeof db.$queryRaw === "function") {
    const lockedTickets = await db.$queryRaw<RefundableAttendeeRow[]>`
      SELECT
        attendee_id AS "attendeeId",
        user_id AS "userId",
        payment_id AS "paymentId"
      FROM eventattendees
      WHERE event_id = ${eventId}::uuid
        AND purchaser_user_id = ${userId}::uuid
      ORDER BY
        CASE WHEN user_id = ${userId}::uuid THEN 0 ELSE 1 END,
        created_at ASC
      FOR UPDATE
    `;
    return prioritizeHeldTickets(lockedTickets, userId);
  }

  const tickets = await db.eventAttendee.findMany({
    where: {
      eventId,
      purchaserUserId: userId,
    },
    select: {
      attendeeId: true,
      userId: true,
      paymentId: true,
    },
    orderBy: { createdAt: "asc" },
  });

  return prioritizeHeldTickets(tickets, userId);
}

async function getHeldTicketCount(
  db: Pick<typeof prisma, "eventAttendee">,
  eventId: string,
  userId: string,
) {
  return db.eventAttendee.count({
    where: { eventId, userId },
  });
}

async function buildRefundSelection(
  db: Pick<typeof prisma, "eventAttendee" | "payment"> & {
    $queryRaw?: typeof prisma.$queryRaw;
  },
  event: {
    eventId: string;
    priceField: number | null;
  },
  userId: string,
  requestedCount?: number,
  options?: {
    forUpdate?: boolean;
  },
): Promise<RefundSelection> {
  const refundableTickets = await listRefundableTickets(
    db,
    event.eventId,
    userId,
    options?.forUpdate ?? false,
  );
  const heldTicketCount = await getHeldTicketCount(db, event.eventId, userId);

  if (refundableTickets.length === 0) {
    if (heldTicketCount > 0) {
      throw new Error(
        "Transferred tickets can only be refunded by the original purchaser",
      );
    }
    throw new Error("You have no tickets for this event");
  }

  const ticketCount = requestedCount
    ? Math.min(requestedCount, refundableTickets.length)
    : refundableTickets.length;

  if (ticketCount < 1) {
    throw new Error("Invalid ticket count");
  }

  const selectedTickets = refundableTickets.slice(0, ticketCount);
  const paymentIds = [
    ...new Set(
      selectedTickets
        .map((ticket) => ticket.paymentId)
        .filter((paymentId): paymentId is string => Boolean(paymentId)),
    ),
  ];
  const payments = paymentIds.length
    ? await db.payment.findMany({
        where: { paymentId: { in: paymentIds } },
        select: {
      paymentId: true,
      provider: true,
      amountEtb: true,
      unitPriceEtb: true,
      ownerRevenueEtb: true,
      quantity: true,
      chapaSubaccountId: true,
    },
  })
    : [];
  const paymentMap = new Map(payments.map((payment) => [payment.paymentId, payment]));
  const ticketCountByPayment = new Map<string | null, number>();

  for (const ticket of selectedTickets) {
    ticketCountByPayment.set(
      ticket.paymentId,
      (ticketCountByPayment.get(ticket.paymentId) ?? 0) + 1,
    );
  }

  const paymentSelections: RefundSelectionEntry[] = [];
  let refundAmount = 0;

  for (const [paymentId, paymentTicketCount] of ticketCountByPayment) {
    const payment = paymentId ? paymentMap.get(paymentId) ?? null : null;
    const paymentRefundAmount =
      payment != null && payment.quantity > 0
        ? roundCurrency((Number(payment.amountEtb) / payment.quantity) * paymentTicketCount)
        : roundCurrency(Number(event.priceField ?? 0) * paymentTicketCount);

    refundAmount += paymentRefundAmount;
    paymentSelections.push({
      paymentId,
      paymentTicketCount,
      paymentRefundAmount,
      payment:
        payment == null
          ? null
          : {
              amountEtb: Number(payment.amountEtb),
              unitPriceEtb: Number(payment.unitPriceEtb),
              ownerRevenueEtb: Number(payment.ownerRevenueEtb),
              quantity: payment.quantity,
              provider: payment.provider,
              chapaSubaccountId: payment.chapaSubaccountId,
            },
    });
  }

  return {
    heldTicketCount,
    refundableTicketCount: refundableTickets.length,
    ticketCount,
    refundAmount: roundCurrency(refundAmount),
    selectedTickets,
    paymentSelections,
  };
}

export async function getRefundQuote(
  eventId: string,
  userId: string,
  requestedCount?: number,
): Promise<RefundQuoteResult> {
  const event = await prisma.event.findUnique({
    where: { eventId },
    select: {
      eventId: true,
      eventDatetime: true,
      eventEndtime: true,
      priceField: true,
    },
  });

  if (!event) throw new Error("Event not found");
  assertRefundWindow(event);

  const selection = await buildRefundSelection(prisma, event, userId, requestedCount);

  return {
    ok: true,
    heldTicketCount: selection.heldTicketCount,
    refundableTicketCount: selection.refundableTicketCount,
    ticketCount: selection.ticketCount,
    amountEtb: selection.refundAmount,
  };
}

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
      addressLabel: true,
      latitude: true,
      longitude: true,
      capacity: true,
      priceField: true,
      userId: true,
    },
  });

  if (!event) throw new Error("Event not found");
  assertRefundWindow(event);

  let newBalance = 0;
  let refundAmount = 0;
  let ticketCount = 0;
  const refundIds: string[] = [];

  await prisma.$transaction(async (tx) => {
    const selection = await buildRefundSelection(
      tx,
      {
        eventId: event.eventId,
        priceField: event.priceField ?? null,
      },
      userId,
      requestedCount,
      { forUpdate: true },
    );

    ticketCount = selection.ticketCount;
    refundAmount = selection.refundAmount;
    const selectedTickets = selection.selectedTickets;
    const attendeeIdsToDelete = selectedTickets.map((ticket) => ticket.attendeeId);

    await tx.ticketScan.deleteMany({
      where: { attendeeId: { in: attendeeIdsToDelete } },
    });

    const deletedAttendees = await tx.eventAttendee.deleteMany({
      where: {
        attendeeId: { in: attendeeIdsToDelete },
        purchaserUserId: userId,
      },
    });
    const deletedAttendeeCount =
      typeof deletedAttendees?.count === "number"
        ? deletedAttendees.count
        : attendeeIdsToDelete.length;
    if (deletedAttendeeCount !== attendeeIdsToDelete.length) {
      throw new Error("Refund conflict. Please try again.");
    }

    let balanceCreditTotal = 0;
    let ownerBalanceDebitTotal = 0;

    for (const selectionEntry of selection.paymentSelections) {
      const {
        paymentId,
        paymentTicketCount,
        paymentRefundAmount,
        payment,
      } = selectionEntry;
      if (paymentRefundAmount > 0) {
        balanceCreditTotal += paymentRefundAmount;
      }

      if (
        payment?.provider === PaymentProvider.balance &&
        payment.chapaSubaccountId &&
        event.userId !== userId
      ) {
        const ownerRevenuePerTicket =
          payment.quantity > 0
            ? roundCurrency(Number(payment.ownerRevenueEtb) / payment.quantity)
            : roundCurrency(
                Number(payment.unitPriceEtb) * (1 - PLATFORM_COMMISSION_PERCENT),
              );
        ownerBalanceDebitTotal += roundCurrency(
          ownerRevenuePerTicket * paymentTicketCount,
        );
      }

      const refund = await tx.refund.create({
        data: {
          eventId,
          userId,
          paymentId,
          amountEtb: paymentRefundAmount,
          ticketCount: paymentTicketCount,
        },
      });
      refundIds.push(refund.refundId);
    }

    if (balanceCreditTotal > 0) {
      const updatedBalance =
        typeof tx.userBalance.upsert === "function"
          ? await tx.userBalance.upsert({
              where: { userId },
              update: {
                balanceEtb: { increment: balanceCreditTotal },
              },
              create: {
                userId,
                balanceEtb: balanceCreditTotal,
              },
            })
          : await (async () => {
              const existingBalance = await tx.userBalance.findUnique({
                where: { userId },
              });
              if (existingBalance) {
                return tx.userBalance.update({
                  where: { userId },
                  data: {
                    balanceEtb: { increment: balanceCreditTotal },
                  },
                });
              }
              return tx.userBalance.create({
                data: {
                  userId,
                  balanceEtb: balanceCreditTotal,
                },
              });
            })();
      newBalance = Number(updatedBalance.balanceEtb);
    } else {
      const existingBalance = await tx.userBalance.findUnique({
        where: { userId },
      });
      newBalance = Number(existingBalance?.balanceEtb ?? 0);
    }

    if (ownerBalanceDebitTotal > 0) {
      await tx.userBalance.upsert({
        where: { userId: event.userId },
        update: {
          balanceEtb: { decrement: ownerBalanceDebitTotal },
        },
        create: {
          userId: event.userId,
          balanceEtb: -ownerBalanceDebitTotal,
        },
      });
    }
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
    const location = resolveEventLocation(event);

    for (const entry of waitlistEntries) {
      const user = waitlistUserMap.get(entry.userId);
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
    refundId: refundIds.length === 1 ? refundIds[0] ?? null : null,
    refundIds,
    ticketCount,
    amountEtb: refundAmount,
    newBalance,
  };
}
