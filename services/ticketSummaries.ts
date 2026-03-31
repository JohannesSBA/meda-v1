import { prisma } from "@/lib/prisma";

type TicketSummaryDbClient = Pick<typeof prisma, "event" | "eventAttendee" | "payment">;

export type UserEventTicketSummary = {
  eventId: string;
  heldTicketCount: number;
  refundableTicketCount: number;
  refundableAmountEtb: number;
};

function roundCurrency(value: number) {
  return Math.round(value * 100) / 100;
}

export async function getUserEventTicketSummaryMap(
  userId: string,
  eventIds: string[],
  db: TicketSummaryDbClient = prisma,
) {
  if (eventIds.length === 0) {
    return new Map<string, UserEventTicketSummary>();
  }

  const [attendees, events] = await Promise.all([
    db.eventAttendee.findMany({
      where: {
        eventId: { in: eventIds },
        OR: [{ userId }, { purchaserUserId: userId }],
      },
      select: {
        eventId: true,
        userId: true,
        purchaserUserId: true,
        paymentId: true,
      },
    }),
    db.event.findMany({
      where: { eventId: { in: eventIds } },
      select: {
        eventId: true,
        priceField: true,
      },
    }),
  ]);

  const paymentIds = [
    ...new Set(
      attendees
        .map((attendee) => attendee.paymentId)
        .filter((paymentId): paymentId is string => Boolean(paymentId)),
    ),
  ];
  const payments = paymentIds.length
    ? await db.payment.findMany({
        where: { paymentId: { in: paymentIds } },
        select: {
          paymentId: true,
          unitPriceEtb: true,
        },
      })
    : [];

  const paymentAmountMap = new Map(
    payments.map((payment) => [payment.paymentId, Number(payment.unitPriceEtb)]),
  );
  const eventPriceMap = new Map(
    events.map((event) => [event.eventId, Number(event.priceField ?? 0)]),
  );
  const summaryMap = new Map<string, UserEventTicketSummary>(
    eventIds.map((eventId) => [
      eventId,
      {
        eventId,
        heldTicketCount: 0,
        refundableTicketCount: 0,
        refundableAmountEtb: 0,
      },
    ]),
  );

  for (const attendee of attendees) {
    const summary = summaryMap.get(attendee.eventId);
    if (!summary) continue;

    if (attendee.userId === userId) {
      summary.heldTicketCount += 1;
    }

    if (attendee.purchaserUserId === userId) {
      summary.refundableTicketCount += 1;
      summary.refundableAmountEtb +=
        paymentAmountMap.get(attendee.paymentId ?? "") ??
        eventPriceMap.get(attendee.eventId) ??
        0;
    }
  }

  for (const summary of summaryMap.values()) {
    summary.refundableAmountEtb = roundCurrency(summary.refundableAmountEtb);
  }

  return summaryMap;
}
