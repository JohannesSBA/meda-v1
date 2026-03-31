import {
  BookingStatus,
  PartyMemberStatus,
  PaymentStatus,
  PaymentPoolStatus,
  TicketStatus,
} from "@/generated/prisma/client";
import { getAuthUserEmails } from "@/lib/auth/userLookup";
import { prisma } from "@/lib/prisma";
import { getOwnerCalendar } from "@/services/calendar";
import { listOwnerSlots } from "@/services/slots";
import { getCurrentOwnerSubscription } from "@/services/subscriptions";

function asNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeDateRange(args: { from?: Date; to?: Date }) {
  const now = new Date();
  const from = args.from ?? new Date(now.getFullYear(), now.getMonth(), 1);
  const to =
    args.to ??
    new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
  return { from, to };
}

function toCsvValue(value: unknown) {
  if (value == null) return "";
  const stringValue = String(value);
  if (/[",\n]/.test(stringValue)) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }
  return stringValue;
}

function buildCsv(headers: string[], rows: Array<Record<string, unknown>>) {
  const csvRows = [headers.join(",")];
  for (const row of rows) {
    csvRows.push(headers.map((header) => toCsvValue(row[header])).join(","));
  }
  return csvRows.join("\n");
}

const CONFIRMED_BOOKING_STATUSES = [
  BookingStatus.CONFIRMED,
  BookingStatus.COMPLETED,
] as const;

const ASSIGNED_TICKET_STATUSES = [
  TicketStatus.ASSIGNED,
  TicketStatus.VALID,
  TicketStatus.CHECKED_IN,
] as const;

async function getOwnerPitchScope(args: {
  ownerId: string;
  pitchId?: string;
}) {
  const pitches = await prisma.pitch.findMany({
    where: {
      ownerId: args.ownerId,
      ...(args.pitchId ? { id: args.pitchId } : {}),
    },
    select: {
      id: true,
      name: true,
    },
    orderBy: [{ name: "asc" }],
  });

  if (args.pitchId && pitches.length === 0) {
    throw new Error("Pitch not found");
  }

  return {
    pitches,
    pitchIds: pitches.map((pitch) => pitch.id),
  };
}

async function getOwnerBookings(args: {
  ownerId: string;
  pitchId?: string;
  from?: Date;
  to?: Date;
}) {
  const { from, to } = normalizeDateRange(args);
  const bookings = await prisma.booking.findMany({
    where: {
      slot: {
        pitch: {
          ownerId: args.ownerId,
        },
        ...(args.pitchId ? { pitchId: args.pitchId } : {}),
      },
      createdAt: {
        gte: from,
        lte: to,
      },
    },
    include: {
      slot: {
        include: {
          pitch: {
            select: {
              id: true,
              ownerId: true,
              name: true,
            },
          },
          category: {
            select: {
              categoryName: true,
            },
          },
        },
      },
      party: {
        include: {
          members: true,
        },
      },
      tickets: true,
      paymentPool: {
        include: {
          contributions: {
            include: {
              partyMember: true,
            },
          },
        },
      },
    },
    orderBy: [{ createdAt: "desc" }],
  });

  return bookings;
}

async function getOwnerEventPayments(args: {
  ownerId: string;
  pitchId?: string;
  from?: Date;
  to?: Date;
}) {
  if (args.pitchId) {
    return [];
  }

  const { from, to } = normalizeDateRange(args);
  return prisma.payment.findMany({
    where: {
      event: {
        userId: args.ownerId,
      },
      createdAt: {
        gte: from,
        lte: to,
      },
    },
    include: {
      event: {
        select: {
          eventId: true,
          eventName: true,
          eventDatetime: true,
          eventEndtime: true,
        },
      },
      attendees: {
        select: {
          attendeeId: true,
          userId: true,
          purchaserUserId: true,
          ticketScan: {
            select: {
              scanId: true,
            },
          },
        },
      },
    },
    orderBy: [{ createdAt: "desc" }],
  });
}

async function getOwnerEventRefunds(args: {
  ownerId: string;
  pitchId?: string;
  from?: Date;
  to?: Date;
}) {
  if (args.pitchId) {
    return [];
  }

  const { from, to } = normalizeDateRange(args);
  return prisma.refund.findMany({
    where: {
      event: {
        userId: args.ownerId,
      },
      createdAt: {
        gte: from,
        lte: to,
      },
    },
    include: {
      event: {
        select: {
          eventId: true,
          eventName: true,
          eventDatetime: true,
          eventEndtime: true,
        },
      },
    },
    orderBy: [{ createdAt: "desc" }],
  });
}

export async function getOwnerDashboardOverview(args: {
  ownerId: string;
  pitchId?: string;
  from?: Date;
  to?: Date;
}) {
  const { from, to } = normalizeDateRange(args);
  const [{ pitchIds }, bookings, slots, subscription, eventPayments, eventRefunds] =
    await Promise.all([
    getOwnerPitchScope(args),
    getOwnerBookings(args),
    listOwnerSlots({
      ownerId: args.ownerId,
      pitchId: args.pitchId,
      from,
      to,
    }),
    getCurrentOwnerSubscription(args.ownerId),
    getOwnerEventPayments(args),
    getOwnerEventRefunds(args),
  ]);

  const confirmedBookings = bookings.filter((booking) =>
    CONFIRMED_BOOKING_STATUSES.includes(
      booking.status as (typeof CONFIRMED_BOOKING_STATUSES)[number],
    ),
  );
  const dailyBookings = confirmedBookings.filter(
    (booking) => booking.productType === "DAILY",
  );
  const monthlyBookings = confirmedBookings.filter(
    (booking) => booking.productType === "MONTHLY",
  );
  const ticketRows = confirmedBookings.flatMap((booking) => booking.tickets);
  const expiredPools = bookings.filter(
    (booking) => booking.paymentPool?.status === PaymentPoolStatus.EXPIRED,
  ).length;

  const monthlyPassCustomerIds = new Set(
    monthlyBookings.flatMap((booking) =>
      booking.party?.members
        .filter(
          (member) =>
            member.status !== PartyMemberStatus.REMOVED && Boolean(member.userId),
        )
        .map((member) => member.userId as string) ?? [],
    ),
  );

  const refunds = await prisma.hostActivityLog.findMany({
    where: {
      ownerId: args.ownerId,
      action: "booking.refunded",
      createdAt: {
        gte: from,
        lte: to,
      },
    },
    select: {
      metadataJson: true,
    },
  });

  const refundedAmount = refunds.reduce((sum, refund) => {
    const metadata =
      refund.metadataJson && typeof refund.metadataJson === "object"
        ? (refund.metadataJson as Record<string, unknown>)
        : null;
    return sum + asNumber(metadata?.totalAmount);
  }, 0);
  const eventRevenue = eventPayments
    .filter((payment) => payment.status === PaymentStatus.succeeded)
    .reduce((sum, payment) => sum + asNumber(payment.amountEtb), 0);
  const eventRefundedAmount = eventRefunds.reduce(
    (sum, refund) => sum + asNumber(refund.amountEtb),
    0,
  );

  return {
    dateRange: {
      from: from.toISOString(),
      to: to.toISOString(),
    },
    pitchCount: pitchIds.length,
    activeSlotCount: slots.filter((slot) => slot.status !== "CANCELLED").length,
    revenueTotalEtb:
      confirmedBookings.reduce(
        (sum, booking) => sum + asNumber(booking.totalAmount),
        0,
      ) + eventRevenue,
    refundedAmountEtb: refundedAmount + eventRefundedAmount,
    bookingsTotal: bookings.length,
    bookingsConfirmed: confirmedBookings.length,
    slotsCreated: slots.length,
    utilization:
      slots.length > 0
        ? Number(
            (
              slots.reduce((sum, slot) => sum + slot.utilization, 0) / slots.length
            ).toFixed(4),
          )
        : 0,
    dailySalesCount: dailyBookings.length,
    monthlySalesCount: monthlyBookings.length,
    expiredPools,
    partyCompletion:
      bookings.filter((booking) => booking.paymentPool).length > 0
        ? Number(
            (
              bookings.filter(
                (booking) =>
                  booking.paymentPool?.status === PaymentPoolStatus.FULFILLED,
              ).length /
              bookings.filter((booking) => booking.paymentPool).length
            ).toFixed(4),
          )
        : 0,
    assignedTicketCount: ticketRows.filter((ticket) =>
      ASSIGNED_TICKET_STATUSES.includes(
        ticket.status as (typeof ASSIGNED_TICKET_STATUSES)[number],
      ),
    ).length,
    unassignedTicketCount: ticketRows.filter(
      (ticket) => ticket.status === TicketStatus.ASSIGNMENT_PENDING,
    ).length,
    checkedInTicketCount: ticketRows.filter(
      (ticket) => ticket.status === TicketStatus.CHECKED_IN,
    ).length,
    monthlyPassCustomers: monthlyPassCustomerIds.size,
    subscription,
  };
}

export async function listOwnerDashboardBookings(args: {
  ownerId: string;
  pitchId?: string;
  from?: Date;
  to?: Date;
}) {
  const bookings = await getOwnerBookings(args);
  const userIds = [
    ...new Set(
      bookings
        .flatMap((booking) => [
          booking.userId,
          ...booking.tickets.map((ticket) => ticket.assignedUserId),
          ...booking.party?.members.map((member) => member.userId) ?? [],
        ])
        .filter((userId): userId is string => Boolean(userId)),
    ),
  ];
  const authUsers = await getAuthUserEmails(userIds);

  return bookings.map((booking) => ({
    id: booking.id,
    status: booking.status,
    productType: booking.productType,
    pitchId: booking.slot.pitchId,
    pitchName: booking.slot.pitch.name,
    categoryName: booking.slot.category.categoryName,
    startsAt: booking.slot.startsAt.toISOString(),
    endsAt: booking.slot.endsAt.toISOString(),
    quantity: booking.quantity,
    totalAmount: asNumber(booking.totalAmount),
    currency: booking.currency,
    customerId: booking.userId,
    customerName: booking.userId
      ? authUsers.get(booking.userId)?.name ?? authUsers.get(booking.userId)?.email ?? "Customer"
      : "Customer",
    customerEmail: booking.userId ? authUsers.get(booking.userId)?.email ?? null : null,
    partyId: booking.partyId,
    partyName: booking.party?.name ?? null,
    partyStatus: booking.party?.status ?? null,
    partyMemberCount:
      booking.party?.members.filter(
        (member) => member.status !== PartyMemberStatus.REMOVED,
      ).length ?? 0,
    poolStatus: booking.paymentPool?.status ?? null,
    poolAmountPaid: booking.paymentPool ? asNumber(booking.paymentPool.amountPaid) : null,
    poolTotalAmount: booking.paymentPool ? asNumber(booking.paymentPool.totalAmount) : null,
    poolOutstandingAmount: booking.paymentPool
      ? Math.max(
          0,
          asNumber(booking.paymentPool.totalAmount) -
            asNumber(booking.paymentPool.amountPaid),
        )
      : null,
    poolExpiresAt: booking.paymentPool?.expiresAt.toISOString() ?? null,
    soldTickets: booking.tickets.length,
    assignedTickets: booking.tickets.filter((ticket) =>
      ASSIGNED_TICKET_STATUSES.includes(
        ticket.status as (typeof ASSIGNED_TICKET_STATUSES)[number],
      ),
    ).length,
    checkedInTickets: booking.tickets.filter(
      (ticket) => ticket.status === TicketStatus.CHECKED_IN,
    ).length,
    createdAt: booking.createdAt.toISOString(),
  }));
}

export async function listOwnerDashboardPayments(args: {
  ownerId: string;
  pitchId?: string;
  from?: Date;
  to?: Date;
}) {
  const { from, to } = normalizeDateRange(args);
  const [bookings, eventPayments, eventRefunds] = await Promise.all([
    getOwnerBookings(args),
    getOwnerEventPayments(args),
    getOwnerEventRefunds(args),
  ]);
  const contributionRows = bookings.flatMap((booking) =>
    booking.paymentPool?.contributions.map((contribution) => ({
      type: "pool_contribution" as const,
      id: contribution.id,
      bookingId: booking.id,
      pitchName: booking.slot.pitch.name,
      productType: booking.productType,
      amount: asNumber(contribution.paidAmount),
      expectedAmount: asNumber(contribution.expectedAmount),
      currency: booking.paymentPool?.currency ?? booking.currency,
      status: contribution.status,
      providerReference: contribution.providerRef ?? null,
      paidAt: contribution.paidAt?.toISOString() ?? null,
      createdAt: contribution.createdAt.toISOString(),
    })) ?? [],
  );

  const bookingRows = bookings.map((booking) => ({
    type: "booking" as const,
    id: booking.id,
    bookingId: booking.id,
    pitchName: booking.slot.pitch.name,
    productType: booking.productType,
    amount: asNumber(booking.totalAmount),
    expectedAmount: asNumber(booking.totalAmount),
    currency: booking.currency,
    status: booking.status,
    providerReference: booking.providerReference ?? null,
    paidAt: booking.paidAt?.toISOString() ?? null,
    createdAt: booking.createdAt.toISOString(),
  }));

  const refunds = await prisma.hostActivityLog.findMany({
    where: {
      ownerId: args.ownerId,
      action: "booking.refunded",
      createdAt: {
        gte: from,
        lte: to,
      },
    },
    orderBy: [{ createdAt: "desc" }],
  });

  const refundRows = refunds.map((refund) => {
    const metadata =
      refund.metadataJson && typeof refund.metadataJson === "object"
        ? (refund.metadataJson as Record<string, unknown>)
        : null;
    return {
      type: "refund" as const,
      id: refund.id,
      bookingId: typeof metadata?.bookingId === "string" ? metadata.bookingId : null,
      pitchName: null,
      productType: null,
      amount: asNumber(metadata?.totalAmount),
      expectedAmount: asNumber(metadata?.totalAmount),
      currency: "ETB",
      status: "REFUNDED",
      providerReference: null,
      paidAt: refund.createdAt.toISOString(),
      createdAt: refund.createdAt.toISOString(),
    };
  });

  const eventPaymentRows = eventPayments.map((payment) => ({
    type: "event_payment" as const,
    id: payment.paymentId,
    bookingId: payment.eventId,
    pitchName: payment.event.eventName,
    productType: "EVENT",
    amount: asNumber(payment.amountEtb),
    expectedAmount: asNumber(payment.amountEtb),
    currency: payment.currency,
    status: payment.status,
    providerReference: payment.providerReference ?? null,
    paidAt: payment.verifiedAt?.toISOString() ?? payment.createdAt.toISOString(),
    createdAt: payment.createdAt.toISOString(),
  }));

  const eventRefundRows = eventRefunds.map((refund) => ({
    type: "event_refund" as const,
    id: refund.refundId,
    bookingId: refund.eventId,
    pitchName: refund.event.eventName,
    productType: "EVENT",
    amount: asNumber(refund.amountEtb),
    expectedAmount: asNumber(refund.amountEtb),
    currency: "ETB",
    status: "REFUNDED",
    providerReference: refund.paymentId ?? null,
    paidAt: refund.createdAt.toISOString(),
    createdAt: refund.createdAt.toISOString(),
  }));

  return [
    ...bookingRows,
    ...contributionRows,
    ...refundRows,
    ...eventPaymentRows,
    ...eventRefundRows,
  ].sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}

export async function listOwnerDashboardCustomers(args: {
  ownerId: string;
  pitchId?: string;
  from?: Date;
  to?: Date;
  customerId?: string;
}) {
  const { from, to } = normalizeDateRange(args);
  const [bookings, eventPayments, eventRefunds] = await Promise.all([
    getOwnerBookings(args),
    getOwnerEventPayments(args),
    getOwnerEventRefunds(args),
  ]);
  const userIds = [
    ...new Set(
      [
        ...bookings.flatMap((booking) => [
          booking.userId,
          ...booking.tickets.map((ticket) => ticket.assignedUserId),
          ...(booking.party?.members.map((member) => member.userId) ?? []),
        ]),
        ...eventPayments.flatMap((payment) => [
          payment.userId,
          ...payment.attendees.map((attendee) => attendee.userId),
        ]),
        ...eventRefunds.map((refund) => refund.userId),
      ]
        .filter((userId): userId is string => Boolean(userId)),
    ),
  ];
  const authUsers = await getAuthUserEmails(userIds);

  const aggregates = new Map<
    string,
    {
      customerId: string;
      customerName: string;
      customerEmail: string | null;
      bookings: number;
      ticketsAssigned: number;
      ticketsCheckedIn: number;
      totalPaidEtb: number;
      monthlyPassUsage: number;
        history: Array<{
        referenceId: string;
        sourceType: "SLOT" | "EVENT";
        title: string;
        startsAt: string;
        amountEtb: number;
        checkedInCount: number;
        assignedCount: number;
        refundAmountEtb: number;
      }>;
    }
  >();

  for (const booking of bookings) {
    const relatedUserIds = new Set<string>();
    if (booking.userId) relatedUserIds.add(booking.userId);
    for (const ticket of booking.tickets) {
      if (ticket.assignedUserId) relatedUserIds.add(ticket.assignedUserId);
    }
    for (const member of booking.party?.members ?? []) {
      if (member.userId) relatedUserIds.add(member.userId);
    }

    for (const userId of relatedUserIds) {
      const authUser = authUsers.get(userId);
      const current = aggregates.get(userId) ?? {
        customerId: userId,
        customerName: authUser?.name ?? authUser?.email ?? "Customer",
        customerEmail: authUser?.email ?? null,
        bookings: 0,
        ticketsAssigned: 0,
        ticketsCheckedIn: 0,
        totalPaidEtb: 0,
        monthlyPassUsage: 0,
        history: [],
      };

      const assignedCount = booking.tickets.filter(
        (ticket) => ticket.assignedUserId === userId,
      ).length;
      const checkedInCount = booking.tickets.filter(
        (ticket) =>
          ticket.assignedUserId === userId &&
          ticket.status === TicketStatus.CHECKED_IN,
      ).length;
      current.bookings += 1;
      current.ticketsAssigned += assignedCount;
      current.ticketsCheckedIn += checkedInCount;
      current.totalPaidEtb += booking.userId === userId ? asNumber(booking.totalAmount) : 0;
      current.monthlyPassUsage += booking.productType === "MONTHLY" ? 1 : 0;
      current.history.push({
        referenceId: booking.id,
        sourceType: "SLOT",
        title: booking.slot.pitch.name,
        startsAt: booking.slot.startsAt.toISOString(),
        amountEtb: booking.userId === userId ? asNumber(booking.totalAmount) : 0,
        checkedInCount,
        assignedCount,
        refundAmountEtb: 0,
      });

      aggregates.set(userId, current);
    }
  }

  const bookingRefunds = await prisma.hostActivityLog.findMany({
    where: {
      ownerId: args.ownerId,
      action: "booking.refunded",
      createdAt: {
        gte: from,
        lte: to,
      },
    },
    select: {
      metadataJson: true,
    },
  });

  const bookingRefundsByBookingId = new Map<string, number>();
  for (const refund of bookingRefunds) {
    const metadata =
      refund.metadataJson && typeof refund.metadataJson === "object"
        ? (refund.metadataJson as Record<string, unknown>)
        : null;
    const bookingId =
      typeof metadata?.bookingId === "string" ? metadata.bookingId : null;
    if (!bookingId) continue;
    bookingRefundsByBookingId.set(
      bookingId,
      (bookingRefundsByBookingId.get(bookingId) ?? 0) + asNumber(metadata?.totalAmount),
    );
  }

  for (const aggregate of aggregates.values()) {
    aggregate.history = aggregate.history.map((entry) =>
      entry.sourceType === "SLOT"
        ? {
            ...entry,
            refundAmountEtb:
              entry.amountEtb > 0
                ? bookingRefundsByBookingId.get(entry.referenceId) ?? 0
                : entry.refundAmountEtb,
          }
        : entry,
    );
  }

  const eventRefundsByUserAndEvent = new Map<string, number>();
  for (const refund of eventRefunds) {
    const key = `${refund.userId}:${refund.eventId}`;
    eventRefundsByUserAndEvent.set(
      key,
      (eventRefundsByUserAndEvent.get(key) ?? 0) + asNumber(refund.amountEtb),
    );
  }

  for (const payment of eventPayments) {
    const attendeeUserIds = new Set<string>([
      payment.userId,
      ...payment.attendees.map((attendee) => attendee.userId),
    ]);

    for (const userId of attendeeUserIds) {
      const authUser = authUsers.get(userId) ?? null;
      const current = aggregates.get(userId) ?? {
        customerId: userId,
        customerName: authUser?.name ?? authUser?.email ?? "Customer",
        customerEmail: authUser?.email ?? null,
        bookings: 0,
        ticketsAssigned: 0,
        ticketsCheckedIn: 0,
        totalPaidEtb: 0,
        monthlyPassUsage: 0,
        history: [],
      };

      const assignedCount = payment.attendees.filter(
        (attendee) => attendee.userId === userId,
      ).length;
      const checkedInCount = payment.attendees.filter(
        (attendee) => attendee.userId === userId && Boolean(attendee.ticketScan),
      ).length;
      current.bookings += assignedCount > 0 || payment.userId === userId ? 1 : 0;
      current.ticketsAssigned += assignedCount;
      current.ticketsCheckedIn += checkedInCount;
      current.totalPaidEtb += payment.userId === userId ? asNumber(payment.amountEtb) : 0;
      current.history.push({
        referenceId: payment.event.eventId,
        sourceType: "EVENT",
        title: payment.event.eventName,
        startsAt: payment.event.eventDatetime.toISOString(),
        amountEtb: payment.userId === userId ? asNumber(payment.amountEtb) : 0,
        checkedInCount,
        assignedCount,
        refundAmountEtb:
          payment.userId === userId
            ? eventRefundsByUserAndEvent.get(`${userId}:${payment.eventId}`) ?? 0
            : 0,
      });

      aggregates.set(userId, current);
    }
  }

  const rows = [...aggregates.values()]
    .map((row) => ({
      ...row,
      history: [...row.history].sort((left, right) => right.startsAt.localeCompare(left.startsAt)),
    }))
    .sort((left, right) => right.totalPaidEtb - left.totalPaidEtb);

  if (args.customerId) {
    return rows.find((row) => row.customerId === args.customerId) ?? null;
  }

  return rows;
}

export async function getOwnerDashboardCalendar(args: {
  ownerId: string;
  pitchId?: string;
  from: Date;
  to: Date;
  view: "month" | "week" | "day";
}) {
  return getOwnerCalendar(args);
}

export async function getOwnerDashboardUtilization(args: {
  ownerId: string;
  pitchId?: string;
  from?: Date;
  to?: Date;
}) {
  const { from, to } = normalizeDateRange(args);
  const [slots, bookings] = await Promise.all([
    listOwnerSlots({
      ownerId: args.ownerId,
      pitchId: args.pitchId,
      from,
      to,
    }),
    getOwnerBookings(args),
  ]);

  return {
    totals: {
      slotCount: slots.length,
      bookingCount: bookings.length,
      utilization:
        slots.length > 0
          ? Number(
              (
                slots.reduce((sum, slot) => sum + slot.utilization, 0) / slots.length
              ).toFixed(4),
            )
          : 0,
      revenueTotalEtb: bookings
        .filter((booking) =>
          CONFIRMED_BOOKING_STATUSES.includes(
            booking.status as (typeof CONFIRMED_BOOKING_STATUSES)[number],
          ),
        )
        .reduce((sum, booking) => sum + asNumber(booking.totalAmount), 0),
    },
    slots: slots.map((slot) => ({
      id: slot.id,
      pitchName: slot.pitchName,
      startsAt: slot.startsAt,
      endsAt: slot.endsAt,
      status: slot.status,
      capacity: slot.capacity,
      soldQuantity: slot.soldQuantity,
      remainingCapacity: slot.remainingCapacity,
      bookingCount: slot.bookingCount,
      utilization: slot.utilization,
      revenueSummaryEtb: slot.revenueSummaryEtb,
      productType: slot.productType,
    })),
  };
}

export async function exportOwnerDashboardCsv(args: {
  ownerId: string;
  pitchId?: string;
  from?: Date;
  to?: Date;
  type: "bookings" | "payments" | "attendees";
}) {
  if (args.type === "bookings") {
    const rows = await listOwnerDashboardBookings(args);
    return buildCsv(
      [
        "id",
        "status",
        "productType",
        "pitchName",
        "startsAt",
        "endsAt",
        "quantity",
        "totalAmount",
        "currency",
        "customerName",
        "customerEmail",
        "partyName",
        "poolStatus",
        "soldTickets",
        "assignedTickets",
        "checkedInTickets",
        "createdAt",
      ],
      rows,
    );
  }

  if (args.type === "payments") {
    const rows = await listOwnerDashboardPayments(args);
    return buildCsv(
      [
        "type",
        "id",
        "bookingId",
        "pitchName",
        "productType",
        "amount",
        "expectedAmount",
        "currency",
        "status",
        "providerReference",
        "paidAt",
        "createdAt",
      ],
      rows,
    );
  }

  const bookings = await getOwnerBookings(args);
  const rows = bookings.flatMap((booking) =>
    booking.tickets.map((ticket) => ({
      bookingId: booking.id,
      ticketId: ticket.id,
      pitchName: booking.slot.pitch.name,
      slotStartsAt: booking.slot.startsAt.toISOString(),
      slotEndsAt: booking.slot.endsAt.toISOString(),
      productType: booking.productType,
      purchaserId: ticket.purchaserId,
      assignedUserId: ticket.assignedUserId,
      assignedEmail: ticket.assignedEmail,
      assignedName: ticket.assignedName,
      status: ticket.status,
      checkedInAt: ticket.checkedInAt?.toISOString() ?? null,
    })),
  );
  return buildCsv(
    [
      "bookingId",
      "ticketId",
      "pitchName",
      "slotStartsAt",
      "slotEndsAt",
      "productType",
      "purchaserId",
      "assignedUserId",
      "assignedEmail",
      "assignedName",
      "status",
      "checkedInAt",
    ],
    rows,
  );
}
