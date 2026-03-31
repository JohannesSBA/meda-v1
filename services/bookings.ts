import {
  BookingStatus,
  ContributionStatus,
  PartyMemberStatus,
  PartyStatus,
  PaymentPoolStatus,
  PaymentProvider,
  Prisma,
  ProductType,
  SlotStatus,
  TicketStatus,
} from "@/generated/prisma/client";
import {
  ASSIGNED_TICKET_STATUSES,
  asNumber,
  buildDailyTicketSeeds,
  buildMonthlyTicketSeedsFromResolvedMembers,
  buildReservedPitchContributionAmounts,
  getOutstandingAmount,
  isCapacityActiveBooking,
  normalizeEmail,
  roundCurrency,
  type TicketSeed,
} from "@/services/bookingDomain";
import {
  getRemainingCapacityTx,
  recomputeSlotStatusTx,
} from "@/services/bookingCapacity";
import {
  getChapaClient,
  initializeChapaTransaction,
  verifyChapaTransactionWithRetry,
} from "@/lib/chapa";
import { acquireTransactionLock } from "@/lib/dbLocks";
import { getAppBaseUrl } from "@/lib/env";
import { getAuthUserByEmail, getAuthUserEmails } from "@/lib/auth/userLookup";
import { computeTicketChargeBreakdown } from "@/lib/ticketPricing";
import { logger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import {
  notifyUserById,
} from "@/services/actionNotifications";
import { sendBookingTicketInviteEmail } from "@/services/email";

const DAILY_BOOKING_HOLD_WINDOW_MS = 15 * 60 * 1000;
export const MONTHLY_POOL_WINDOW_MS = 60 * 60 * 1000;

const bookingInclude = {
  slot: {
    include: {
      pitch: {
        select: {
          id: true,
          ownerId: true,
          name: true,
          addressLabel: true,
          latitude: true,
          longitude: true,
        },
      },
      category: {
        select: {
          categoryName: true,
        },
      },
      bookings: {
        select: {
          id: true,
          status: true,
          quantity: true,
          expiresAt: true,
        },
      },
    },
  },
  party: {
    include: {
      members: {
        orderBy: [{ createdAt: "asc" }],
      },
    },
  },
  tickets: {
    orderBy: [{ createdAt: "asc" }],
  },
  paymentPool: {
    include: {
      contributions: {
        include: {
          partyMember: true,
        },
        orderBy: [{ createdAt: "asc" }],
      },
    },
  },
} satisfies Prisma.BookingInclude;

type BookingRecord = Prisma.BookingGetPayload<{
  include: typeof bookingInclude;
}>;

type TransactionClient = Prisma.TransactionClient;

export type BookingActor = {
  userId: string;
  role?: string | null;
  email?: string | null;
  parentPitchOwnerUserId?: string | null;
};

export type SerializedBooking = Awaited<ReturnType<typeof serializeBooking>>;

function isAdmin(actor: Pick<BookingActor, "role">) {
  return actor.role === "admin";
}

function isOwnerStaff(
  actor: Pick<BookingActor, "userId" | "role" | "parentPitchOwnerUserId">,
  ownerId: string,
) {
  return (
    actor.userId === ownerId ||
    actor.role === "admin" ||
    (actor.role === "facilitator" && actor.parentPitchOwnerUserId === ownerId)
  );
}

async function logOwnerActivityTx(args: {
  tx: TransactionClient;
  ownerId: string;
  pitchId?: string | null;
  entityType: string;
  entityId: string;
  action: string;
  metadata?: Prisma.InputJsonValue;
}) {
  await args.tx.hostActivityLog.create({
    data: {
      ownerId: args.ownerId,
      pitchId: args.pitchId ?? null,
      entityType: args.entityType,
      entityId: args.entityId,
      action: args.action,
      metadataJson: args.metadata,
    },
  });
}

async function creditPitchOwnerBalanceTx(args: {
  tx: TransactionClient;
  ownerId: string;
  ownerRevenueAmount: number;
}) {
  const ownerShare = roundCurrency(args.ownerRevenueAmount);
  if (ownerShare <= 0) return;

  await args.tx.userBalance.upsert({
    where: { userId: args.ownerId },
    update: {
      balanceEtb: { increment: ownerShare },
    },
    create: {
      userId: args.ownerId,
      balanceEtb: ownerShare,
    },
  });
}

async function ensureSufficientUserBalanceTx(args: {
  tx: TransactionClient;
  userId: string;
  amount: number;
}) {
  const balanceRecord = await args.tx.userBalance.findUnique({
    where: { userId: args.userId },
    select: { balanceEtb: true },
  });

  const availableBalance = Number(balanceRecord?.balanceEtb ?? 0);
  if (availableBalance < args.amount) {
    throw new Error(
      `Insufficient balance. Available ETB ${availableBalance.toFixed(2)}, required ETB ${args.amount.toFixed(2)}.`,
    );
  }

  await args.tx.userBalance.update({
    where: { userId: args.userId },
    data: {
      balanceEtb: { decrement: args.amount },
    },
  });
}

async function buildMonthlyTicketSeeds(args: {
  members: Array<{
    userId: string | null;
    invitedEmail: string | null;
  }>;
  purchaserId: string;
  reservedCapacity: number;
}) {
  const knownEmails = await getAuthUserEmails(
    args.members
      .map((member) => member.userId)
      .filter((userId): userId is string => Boolean(userId)),
  );
  return buildMonthlyTicketSeedsFromResolvedMembers({
    members: args.members.map((member) => ({
      userId: member.userId,
      invitedEmail: member.invitedEmail,
      knownUser: member.userId ? knownEmails.get(member.userId) ?? null : null,
    })),
    purchaserId: args.purchaserId,
    reservedCapacity: args.reservedCapacity,
  });
}

async function createBookingTicketsTx(args: {
  tx: TransactionClient;
  bookingId: string;
  ticketSeeds: TicketSeed[];
}) {
  if (args.ticketSeeds.length === 0) return;

  await args.tx.bookingTicket.createMany({
    data: args.ticketSeeds.map((ticket) => ({
      bookingId: args.bookingId,
      purchaserId: ticket.purchaserId,
      assignedUserId: ticket.assignedUserId ?? null,
      assignedName: ticket.assignedName ?? null,
      assignedEmail: ticket.assignedEmail ?? null,
      status: ticket.status,
    })),
  });
}

async function createUserPassesForBookingTx(args: {
  tx: TransactionClient;
  booking: BookingRecord;
}) {
  if (args.booking.productType !== ProductType.MONTHLY || !args.booking.party) return;

  const userIds = args.booking.party.members
    .filter((member) => member.status !== PartyMemberStatus.REMOVED)
    .map((member) => member.userId)
    .filter((userId): userId is string => Boolean(userId));

  for (const userId of [...new Set(userIds)]) {
    await args.tx.userPass.create({
      data: {
        userId,
        partyId: args.booking.party.id,
        productType: ProductType.MONTHLY,
        startsAt: args.booking.slot.startsAt,
        endsAt: args.booking.slot.endsAt,
        status: BookingStatus.CONFIRMED,
      },
    });
  }
}

async function loadBookingTx(tx: TransactionClient, bookingId: string) {
  const booking = await tx.booking.findUnique({
    where: { id: bookingId },
    include: bookingInclude,
  });
  if (!booking) {
    throw new Error("Booking not found");
  }
  return booking;
}

export async function serializeBooking(booking: BookingRecord) {
  const userIds = [
    booking.userId,
    booking.slot.pitch.ownerId,
    ...booking.tickets.map((ticket) => ticket.purchaserId),
    ...booking.tickets.map((ticket) => ticket.assignedUserId),
    ...(booking.party?.members.map((member) => member.userId) ?? []),
    ...(booking.paymentPool?.contributions.map((contribution) => contribution.userId) ?? []),
  ].filter((userId): userId is string => Boolean(userId));

  const authUsers = await getAuthUserEmails([...new Set(userIds)]);
  const now = new Date();
  const reservedQuantity = booking.slot.bookings
    .filter((entry) => isCapacityActiveBooking(entry, now))
    .reduce((sum, entry) => sum + entry.quantity, 0);

  const assignedTicketCount = booking.tickets.filter((ticket) =>
    ASSIGNED_TICKET_STATUSES.includes(
      ticket.status as (typeof ASSIGNED_TICKET_STATUSES)[number],
    ),
  ).length;
  const checkedInTicketCount = booking.tickets.filter(
    (ticket) => ticket.status === TicketStatus.CHECKED_IN,
  ).length;

  return {
    id: booking.id,
    userId: booking.userId,
    productType: booking.productType,
    quantity: booking.quantity,
    totalAmount: asNumber(booking.totalAmount),
    surchargeAmount: asNumber(booking.surchargeAmount),
    ownerRevenueAmount: asNumber(booking.ownerRevenueAmount),
    pricing: {
      ticketSubtotal: roundCurrency(
        asNumber(booking.totalAmount) - asNumber(booking.surchargeAmount),
      ),
      surchargeAmount: asNumber(booking.surchargeAmount),
      platformCommission: roundCurrency(
        asNumber(booking.totalAmount) -
          asNumber(booking.surchargeAmount) -
          asNumber(booking.ownerRevenueAmount),
      ),
      ownerRevenue: asNumber(booking.ownerRevenueAmount),
    },
    currency: booking.currency,
    paymentProvider: booking.paymentProvider ?? null,
    providerReference: booking.providerReference ?? null,
    status: booking.status,
    expiresAt: booking.expiresAt?.toISOString() ?? null,
    paidAt: booking.paidAt?.toISOString() ?? null,
    failureReason: booking.failureReason ?? null,
    createdAt: booking.createdAt.toISOString(),
    updatedAt: booking.updatedAt.toISOString(),
    purchaser: booking.userId
      ? {
          id: booking.userId,
          name: authUsers.get(booking.userId)?.name ?? null,
          email: authUsers.get(booking.userId)?.email ?? null,
        }
      : null,
    slot: {
      id: booking.slot.id,
      pitchId: booking.slot.pitchId,
      pitchName: booking.slot.pitch.name,
      ownerId: booking.slot.pitch.ownerId,
      addressLabel: booking.slot.pitch.addressLabel ?? null,
      latitude: booking.slot.pitch.latitude ?? null,
      longitude: booking.slot.pitch.longitude ?? null,
      categoryName: booking.slot.category.categoryName,
      startsAt: booking.slot.startsAt.toISOString(),
      endsAt: booking.slot.endsAt.toISOString(),
      capacity: booking.slot.capacity,
      price: asNumber(booking.slot.price),
      currency: booking.slot.currency,
      productType: booking.slot.productType,
      status: booking.slot.status,
      requiresParty: booking.slot.requiresParty,
      notes: booking.slot.notes ?? null,
      remainingCapacity: Math.max(0, booking.slot.capacity - reservedQuantity),
    },
    party: booking.party
      ? {
          id: booking.party.id,
          ownerId: booking.party.ownerId,
          name: booking.party.name,
          status: booking.party.status,
          memberCount: booking.party.members.filter(
            (member) => member.status !== PartyMemberStatus.REMOVED,
          ).length,
          members: booking.party.members.map((member) => {
            const authUser = member.userId ? authUsers.get(member.userId) ?? null : null;
            return {
              id: member.id,
              userId: member.userId,
              invitedEmail: member.invitedEmail,
              displayName:
                authUser?.name ??
                member.invitedEmail ??
                "Party member",
              status: member.status,
              joinedAt: member.joinedAt?.toISOString() ?? null,
              paidAt: member.paidAt?.toISOString() ?? null,
            };
          }),
        }
      : null,
    tickets: booking.tickets.map((ticket) => {
      const purchaser = authUsers.get(ticket.purchaserId) ?? null;
      const assignee = ticket.assignedUserId ? authUsers.get(ticket.assignedUserId) ?? null : null;

      return {
        id: ticket.id,
        purchaserId: ticket.purchaserId,
        purchaserName: purchaser?.name ?? purchaser?.email ?? "Purchaser",
        assignedUserId: ticket.assignedUserId,
        assignedName: ticket.assignedName ?? assignee?.name ?? null,
        assignedEmail: ticket.assignedEmail ?? assignee?.email ?? null,
        assigneeDisplayName:
          assignee?.name ??
          ticket.assignedName ??
          ticket.assignedEmail ??
          null,
        status: ticket.status,
        checkedInAt: ticket.checkedInAt?.toISOString() ?? null,
      };
    }),
    ticketSummary: {
      sold: booking.tickets.length,
      assigned: assignedTicketCount,
      unassigned: Math.max(0, booking.tickets.length - assignedTicketCount),
      checkedIn: checkedInTicketCount,
    },
    paymentPool: booking.paymentPool
      ? {
          id: booking.paymentPool.id,
          status: booking.paymentPool.status,
          totalAmount: asNumber(booking.paymentPool.totalAmount),
          amountPaid: asNumber(booking.paymentPool.amountPaid),
          outstandingAmount: getOutstandingAmount({
            totalAmount: asNumber(booking.paymentPool.totalAmount),
            amountPaid: asNumber(booking.paymentPool.amountPaid),
          }),
          currency: booking.paymentPool.currency,
          expiresAt: booking.paymentPool.expiresAt.toISOString(),
          contributions: booking.paymentPool.contributions.map((contribution) => {
            const authUser = contribution.userId ? authUsers.get(contribution.userId) ?? null : null;
            return {
              id: contribution.id,
              userId: contribution.userId,
              partyMemberId: contribution.partyMemberId,
              contributorLabel:
                authUser?.name ??
                authUser?.email ??
                contribution.partyMember?.invitedEmail ??
                "Party member",
              expectedAmount: asNumber(contribution.expectedAmount),
              paidAmount: asNumber(contribution.paidAmount),
              status: contribution.status,
              providerRef: contribution.providerRef ?? null,
              paidAt: contribution.paidAt?.toISOString() ?? null,
            };
          }),
        }
      : null,
  };
}

function getActorEmails(actor: Pick<BookingActor, "email">) {
  const emails = new Set<string>();
  const normalized = normalizeEmail(actor.email);
  if (normalized) {
    emails.add(normalized);
  }
  return emails;
}

function canAccessBooking(booking: BookingRecord, actor: BookingActor) {
  if (isAdmin(actor)) return true;
  if (booking.userId && booking.userId === actor.userId) return true;
  if (isOwnerStaff(actor, booking.slot.pitch.ownerId)) return true;

  const actorEmails = getActorEmails(actor);

  if (
    booking.party &&
    (booking.party.ownerId === actor.userId ||
      booking.party.members.some(
        (member) =>
          member.userId === actor.userId ||
          (member.invitedEmail ? actorEmails.has(member.invitedEmail.toLowerCase()) : false),
      ))
  ) {
    return true;
  }

  return booking.tickets.some(
    (ticket) =>
      ticket.purchaserId === actor.userId ||
      ticket.assignedUserId === actor.userId ||
      (ticket.assignedEmail ? actorEmails.has(ticket.assignedEmail.toLowerCase()) : false),
  );
}

async function getAuthorizedBooking(args: {
  bookingId: string;
  actor: BookingActor;
}) {
  const booking = await prisma.booking.findUnique({
    where: { id: args.bookingId },
    include: bookingInclude,
  });

  if (!booking || !canAccessBooking(booking, args.actor)) {
    throw new Error("Booking not found");
  }

  return booking;
}

export async function getBookingForUser(args: {
  bookingId: string;
  actor: BookingActor;
}) {
  const booking = await getAuthorizedBooking(args);
  return serializeBooking(booking);
}

export async function listBookingsForUser(args: {
  actor: BookingActor;
}) {
  const actorEmails = [...getActorEmails(args.actor)];
  const bookings = await prisma.booking.findMany({
    where: {
      OR: [
        { userId: args.actor.userId },
        {
          party: {
            members: {
              some: {
                OR: [
                  { userId: args.actor.userId },
                  ...(actorEmails.length > 0
                    ? actorEmails.map((email) => ({ invitedEmail: email }))
                    : []),
                ],
              },
            },
          },
        },
        {
          tickets: {
            some: {
              OR: [
                { purchaserId: args.actor.userId },
                { assignedUserId: args.actor.userId },
                ...(actorEmails.length > 0
                  ? actorEmails.map((email) => ({ assignedEmail: email }))
                  : []),
              ],
            },
          },
        },
      ],
    },
    include: bookingInclude,
    orderBy: [{ createdAt: "desc" }],
  });

  return Promise.all(bookings.map((booking) => serializeBooking(booking)));
}

export async function getBookingTicketsForUser(args: {
  bookingId: string;
  actor: BookingActor;
}) {
  const booking = await getAuthorizedBooking(args);
  const serialized = await serializeBooking(booking);
  return {
    bookingId: serialized.id,
    status: serialized.status,
    tickets: serialized.tickets,
    ticketSummary: serialized.ticketSummary,
  };
}

type DailyBookingCreateArgs = {
  slotId: string;
  userId: string;
  userEmail?: string | null;
  userName?: string | null;
  quantity: number;
  paymentMethod: "balance" | "chapa";
  callbackUrl: string;
  returnUrlBase: string;
};

export async function createDailyBooking(args: DailyBookingCreateArgs) {
  const txRef =
    args.paymentMethod === "chapa"
      ? getChapaClient().genTxRef({ prefix: "MEDABOOK", size: 20 })
      : null;

  const result = await prisma.$transaction(async (tx) => {
    await acquireTransactionLock(tx, "slot-booking-create", args.slotId);

    const now = new Date();
    const slot = await tx.bookableSlot.findUnique({
      where: { id: args.slotId },
      include: {
        pitch: {
          select: {
            id: true,
            ownerId: true,
            name: true,
          },
        },
      },
    });

    if (!slot) {
      throw new Error("Slot not found");
    }
    if (slot.productType !== ProductType.DAILY) {
      throw new Error("This slot only accepts monthly bookings.");
    }
    if (slot.requiresParty) {
      throw new Error("This slot requires a party booking.");
    }
    if (slot.status === SlotStatus.BLOCKED || slot.status === SlotStatus.CANCELLED) {
      throw new Error("This slot is not available for booking.");
    }
    if (slot.endsAt <= now) {
      throw new Error("This slot has already ended.");
    }

    const remainingCapacity = await getRemainingCapacityTx({
      tx,
      slotId: slot.id,
      capacity: slot.capacity,
      now,
    });

    if (args.quantity > remainingCapacity) {
      throw new Error("Not enough capacity remains for this slot.");
    }

    const chargeBreakdown = computeTicketChargeBreakdown({
      unitPriceEtb: asNumber(slot.price),
      quantity: args.quantity,
    });
    const totalAmount = chargeBreakdown.totalAmountEtb;
    const expiresAt =
      args.paymentMethod === "chapa"
        ? new Date(now.getTime() + DAILY_BOOKING_HOLD_WINDOW_MS)
        : null;

    const booking = await tx.booking.create({
      data: {
        slotId: slot.id,
        userId: args.userId,
        productType: ProductType.DAILY,
        quantity: args.quantity,
        totalAmount,
        surchargeAmount: chargeBreakdown.surchargeTotalEtb,
        ownerRevenueAmount: chargeBreakdown.ownerRevenueEtb,
        currency: slot.currency,
        paymentProvider:
          totalAmount > 0 ? (args.paymentMethod === "balance" ? PaymentProvider.balance : PaymentProvider.chapa) : null,
        providerReference: txRef,
        status:
          totalAmount === 0 || args.paymentMethod === "balance"
            ? BookingStatus.CONFIRMED
            : BookingStatus.PENDING,
        expiresAt,
        paidAt:
          totalAmount === 0 || args.paymentMethod === "balance" ? now : null,
      },
      select: { id: true },
    });

    await createBookingTicketsTx({
      tx,
      bookingId: booking.id,
      ticketSeeds: buildDailyTicketSeeds({
        quantity: args.quantity,
        purchaserId: args.userId,
        purchaserEmail: args.userEmail,
        purchaserName: args.userName,
      }),
    });

    if (totalAmount === 0) {
      await recomputeSlotStatusTx(tx, slot.id, now);
      await logOwnerActivityTx({
        tx,
        ownerId: slot.pitch.ownerId,
        pitchId: slot.pitch.id,
        entityType: "booking",
        entityId: booking.id,
        action: "daily_booking.confirmed",
        metadata: {
          slotId: slot.id,
          quantity: args.quantity,
          totalAmount,
          paymentProvider: "free",
        },
      });
    } else if (args.paymentMethod === "balance") {
      await ensureSufficientUserBalanceTx({
        tx,
        userId: args.userId,
        amount: totalAmount,
      });
      await creditPitchOwnerBalanceTx({
        tx,
        ownerId: slot.pitch.ownerId,
        ownerRevenueAmount: chargeBreakdown.ownerRevenueEtb,
      });
      await recomputeSlotStatusTx(tx, slot.id, now);
      await logOwnerActivityTx({
        tx,
        ownerId: slot.pitch.ownerId,
        pitchId: slot.pitch.id,
        entityType: "booking",
        entityId: booking.id,
        action: "daily_booking.confirmed",
        metadata: {
          slotId: slot.id,
          quantity: args.quantity,
          totalAmount,
          paymentProvider: "balance",
        },
      });
    } else {
      await recomputeSlotStatusTx(tx, slot.id, now);
      await logOwnerActivityTx({
        tx,
        ownerId: slot.pitch.ownerId,
        pitchId: slot.pitch.id,
        entityType: "booking",
        entityId: booking.id,
        action: "daily_booking.pending",
        metadata: {
          slotId: slot.id,
          quantity: args.quantity,
          totalAmount,
          paymentProvider: "chapa",
          providerReference: txRef,
        },
      });
    }

    return {
      bookingId: booking.id,
      bookingStatus:
        totalAmount === 0 || args.paymentMethod === "balance"
          ? BookingStatus.CONFIRMED
          : BookingStatus.PENDING,
      totalAmount,
      currency: slot.currency,
      pitchName: slot.pitch.name,
      expiresAt: expiresAt?.toISOString() ?? null,
    };
  });

  let checkoutUrl: string | null = null;
  if (result.bookingStatus === BookingStatus.PENDING && txRef) {
    try {
      const returnUrl = `${args.returnUrlBase}${
        args.returnUrlBase.includes("?") ? "&" : "?"
      }tx_ref=${encodeURIComponent(txRef)}`;
      const response = await initializeChapaTransaction({
        first_name: args.userName?.trim() || "Meda",
        last_name: "Player",
        email: args.userEmail ?? "payments@meda.local",
        currency: result.currency,
        amount: result.totalAmount.toFixed(2),
        tx_ref: txRef,
        callback_url: args.callbackUrl,
        return_url: returnUrl,
        customization: {
          title: "Meda Slot",
          description: `Daily slot booking for ${result.pitchName}`,
        },
      });

      if (response.status !== "success" || !response.data?.checkout_url) {
        throw new Error("Unable to initialize Chapa checkout for this booking.");
      }

      checkoutUrl = response.data.checkout_url;
    } catch (error) {
      logger.error("Failed to initialize daily booking payment", error);
      await prisma.$transaction(async (tx) => {
        await acquireTransactionLock(tx, "slot-booking-cancel", result.bookingId);
        const booking = await tx.booking.findUnique({
          where: { id: result.bookingId },
          include: {
            slot: {
              include: {
                pitch: {
                  select: {
                    id: true,
                    ownerId: true,
                  },
                },
              },
            },
          },
        });

        if (!booking) return;

        await tx.booking.update({
          where: { id: booking.id },
          data: {
            status: BookingStatus.CANCELLED,
            failureReason:
              error instanceof Error
                ? error.message
                : "Chapa checkout initialization failed.",
            expiresAt: null,
          },
        });
        await recomputeSlotStatusTx(tx, booking.slotId);
        await logOwnerActivityTx({
          tx,
          ownerId: booking.slot.pitch.ownerId,
          pitchId: booking.slot.pitch.id,
          entityType: "booking",
          entityId: booking.id,
          action: "daily_booking.failed",
          metadata: {
            reason:
              error instanceof Error
                ? error.message
                : "Chapa checkout initialization failed.",
          },
        });
      });
      throw error instanceof Error
        ? error
        : new Error("Failed to initialize booking payment");
    }
  }

  const booking = await getBookingForUser({
    bookingId: result.bookingId,
    actor: {
      userId: args.userId,
      role: "user",
      email: args.userEmail ?? null,
    },
  });

  await notifyUserById({
    userId: args.userId,
    subject:
      booking.status === BookingStatus.PENDING
        ? "Finish paying for your booking"
        : "Your booking is ready",
    title:
      booking.status === BookingStatus.PENDING
        ? "Your booking is waiting for payment"
        : "Your booking is confirmed",
    message:
      booking.status === BookingStatus.PENDING
        ? "Your booking is saved for a short time while you finish payment."
        : "Your booking is confirmed and ready in Tickets.",
    details: [
      { label: "Place", value: booking.slot.pitchName },
      {
        label: "Time",
        value: `${new Date(booking.slot.startsAt).toLocaleString()} - ${new Date(booking.slot.endsAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`,
      },
      { label: "Total", value: `ETB ${booking.totalAmount.toFixed(2)}` },
    ],
    ctaLabel: "Open Tickets",
    ctaPath: "/tickets",
  });

  return {
    booking,
    txRef,
    checkoutUrl,
    expiresAt: result.expiresAt,
  };
}

type MonthlyBookingCreateArgs = {
  slotId: string;
  userId: string;
  userEmail?: string | null;
  partyId?: string;
  partyName?: string | null;
  memberEmails?: string[];
};

export async function createMonthlyBooking(args: MonthlyBookingCreateArgs) {
  const uniqueEmails = [
    ...new Set(
      (args.memberEmails ?? [])
        .map((email) => normalizeEmail(email))
        .filter((email): email is string => Boolean(email)),
    ),
  ];
  const currentUserEmail = normalizeEmail(args.userEmail);
  const inviteEmails = uniqueEmails.filter((email) => email !== currentUserEmail);

  const bookingId = await prisma.$transaction(async (tx) => {
    await acquireTransactionLock(tx, "slot-booking-create", args.slotId);

    const now = new Date();
    const slot = await tx.bookableSlot.findUnique({
      where: { id: args.slotId },
      include: {
        pitch: {
          select: {
            id: true,
            ownerId: true,
          },
        },
      },
    });

    if (!slot) {
      throw new Error("Slot not found");
    }
    if (slot.productType !== ProductType.MONTHLY) {
      throw new Error("This slot only accepts daily bookings.");
    }
    if (slot.status === SlotStatus.BLOCKED || slot.status === SlotStatus.CANCELLED) {
      throw new Error("This slot is not available for booking.");
    }
    if (slot.endsAt <= now) {
      throw new Error("This slot has already ended.");
    }

    let partyId = args.partyId ?? null;
    if (partyId) {
      const existingParty = await tx.party.findFirst({
        where: {
          id: partyId,
          ownerId: args.userId,
        },
        select: { id: true },
      });
      if (!existingParty) {
        throw new Error("Party not found");
      }
    } else {
      const createdParty = await tx.party.create({
        data: {
          ownerId: args.userId,
          name: args.partyName ?? null,
          status: PartyStatus.FORMING,
          members: {
            create: {
              userId: args.userId,
              invitedEmail: currentUserEmail,
              status: PartyMemberStatus.JOINED,
              joinedAt: now,
            },
          },
        },
        select: { id: true },
      });
      partyId = createdParty.id;
    }

    if (!partyId) {
      throw new Error("Unable to create or resolve the booking party.");
    }

    const partyMembers = await tx.partyMember.findMany({
      where: {
        partyId,
      },
      orderBy: [{ createdAt: "asc" }],
    });

    const existingMemberEmails = new Map(
      partyMembers
        .map((member) => [normalizeEmail(member.invitedEmail), member] as const)
        .filter((entry): entry is [string, (typeof partyMembers)[number]] => Boolean(entry[0])),
    );

    for (const email of inviteEmails) {
      const knownUser = await getAuthUserByEmail(email);
      const existing = existingMemberEmails.get(email);

      if (existing) {
        await tx.partyMember.update({
          where: { id: existing.id },
          data: {
            userId: knownUser?.id ?? existing.userId,
            status:
              existing.status === PartyMemberStatus.REMOVED
                ? PartyMemberStatus.INVITED
                : existing.status,
            invitedEmail: email,
          },
        });
        continue;
      }

      await tx.partyMember.create({
        data: {
          partyId,
          userId: knownUser?.id ?? null,
          invitedEmail: email,
          status: PartyMemberStatus.INVITED,
        },
      });
    }

    const activePartyMembers = await tx.partyMember.findMany({
      where: {
        partyId,
        status: {
          not: PartyMemberStatus.REMOVED,
        },
      },
      orderBy: [{ createdAt: "asc" }],
    });

    if (activePartyMembers.length === 0) {
      throw new Error("A monthly booking requires at least one active party member.");
    }

    const remainingCapacity = await getRemainingCapacityTx({
      tx,
      slotId: slot.id,
      capacity: slot.capacity,
      now,
    });

    if (remainingCapacity < slot.capacity) {
      throw new Error(
        "This group booking needs the full pitch, and part of this time is already taken.",
      );
    }

    const reservedCapacity = slot.capacity;
    const memberCount = activePartyMembers.length;
    if (memberCount > reservedCapacity) {
      throw new Error(
        `This pitch holds ${reservedCapacity} player${reservedCapacity === 1 ? "" : "s"}, so your group is too large for this booking.`,
      );
    }

    const chargeBreakdown = computeTicketChargeBreakdown({
      unitPriceEtb: asNumber(slot.price),
      quantity: reservedCapacity,
    });
    const totalAmount = chargeBreakdown.totalAmountEtb;
    const expiresAt = new Date(now.getTime() + MONTHLY_POOL_WINDOW_MS);

    const booking = await tx.booking.create({
      data: {
        slotId: slot.id,
        userId: args.userId,
        partyId,
        productType: ProductType.MONTHLY,
        quantity: reservedCapacity,
        totalAmount,
        surchargeAmount: chargeBreakdown.surchargeTotalEtb,
        ownerRevenueAmount: chargeBreakdown.ownerRevenueEtb,
        currency: slot.currency,
        status: totalAmount <= 0 ? BookingStatus.CONFIRMED : BookingStatus.PENDING,
        expiresAt: totalAmount <= 0 ? null : expiresAt,
        paidAt: totalAmount <= 0 ? now : null,
      },
      select: { id: true },
    });

    await createBookingTicketsTx({
      tx,
      bookingId: booking.id,
      ticketSeeds: await buildMonthlyTicketSeeds({
        members: activePartyMembers.map((member) => ({
          userId: member.userId,
          invitedEmail: member.invitedEmail,
        })),
        purchaserId: args.userId,
        reservedCapacity,
      }),
    });

    const expectedAmounts = buildReservedPitchContributionAmounts({
      members: activePartyMembers.map((member) => ({
        userId: member.userId,
        invitedEmail: member.invitedEmail,
      })),
      organizerUserId: args.userId,
      organizerEmail: args.userEmail ?? null,
      memberShareAmount: chargeBreakdown.perTicketTotalEtb,
      totalAmount,
    });
    const amountPaid = totalAmount <= 0 ? totalAmount : 0;
    const pool = await tx.paymentPool.create({
      data: {
        partyId,
        bookingId: booking.id,
        totalAmount,
        amountPaid,
        currency: slot.currency,
        expiresAt,
        status:
          totalAmount <= 0 ? PaymentPoolStatus.FULFILLED : PaymentPoolStatus.PENDING,
        contributions: {
          create: activePartyMembers.map((member, index) => ({
            userId: member.userId,
            partyMemberId: member.id,
            expectedAmount: expectedAmounts[index] ?? 0,
            paidAmount: totalAmount <= 0 ? expectedAmounts[index] ?? 0 : 0,
            status:
              totalAmount <= 0 ? ContributionStatus.PAID : ContributionStatus.PENDING,
            paidAt: totalAmount <= 0 ? now : null,
          })),
        },
      },
      select: { id: true },
    });

    await tx.party.update({
      where: { id: partyId },
      data: {
        status: totalAmount <= 0 ? PartyStatus.ACTIVE : PartyStatus.PENDING_PAYMENT,
      },
    });

    if (totalAmount <= 0) {
      const createdBooking = await loadBookingTx(tx, booking.id);
      await createUserPassesForBookingTx({
        tx,
        booking: createdBooking,
      });
      await logOwnerActivityTx({
        tx,
        ownerId: slot.pitch.ownerId,
        pitchId: slot.pitch.id,
        entityType: "booking",
        entityId: booking.id,
        action: "monthly_booking.confirmed",
        metadata: {
          slotId: slot.id,
          poolId: pool.id,
          totalAmount,
          memberCount,
          reservedCapacity,
          ticketPrice: chargeBreakdown.unitPriceEtb,
          surchargePerTicket: chargeBreakdown.surchargePerTicketEtb,
          organizerAmount: expectedAmounts.reduce(
            (amount, expectedAmount, index) =>
              activePartyMembers[index]?.userId === args.userId
                ? expectedAmount
                : amount,
            0,
          ),
        },
      });
    } else {
      await logOwnerActivityTx({
        tx,
        ownerId: slot.pitch.ownerId,
        pitchId: slot.pitch.id,
        entityType: "booking",
        entityId: booking.id,
        action: "monthly_booking.pending",
        metadata: {
          slotId: slot.id,
          poolId: pool.id,
          totalAmount,
          memberCount,
          reservedCapacity,
          ticketPrice: chargeBreakdown.unitPriceEtb,
          surchargePerTicket: chargeBreakdown.surchargePerTicketEtb,
          organizerAmount: expectedAmounts.reduce(
            (amount, expectedAmount, index) =>
              activePartyMembers[index]?.userId === args.userId
                ? expectedAmount
                : amount,
            0,
          ),
          expiresAt: expiresAt.toISOString(),
        },
      });
    }

    await recomputeSlotStatusTx(tx, slot.id, now);

    return booking.id;
  });

  const serialized = await getBookingForUser({
    bookingId,
    actor: {
      userId: args.userId,
      role: "user",
      email: args.userEmail ?? null,
    },
  });

  if (inviteEmails.length > 0 && serialized.party) {
    const invitedEmailSet = new Set(inviteEmails);
    for (const member of serialized.party.members) {
      const invitedEmail = normalizeEmail(member.invitedEmail);
      if (!invitedEmail || !invitedEmailSet.has(invitedEmail)) {
        continue;
      }

      const contribution = serialized.paymentPool?.contributions.find(
        (entry) => entry.partyMemberId === member.id,
      );
      const ticket = serialized.tickets.find(
        (entry) =>
          (member.userId && entry.assignedUserId === member.userId) ||
          normalizeEmail(entry.assignedEmail) === invitedEmail,
      );

      try {
        await sendBookingTicketInviteEmail({
          to: invitedEmail,
          recipientName: member.displayName,
          pitchName: serialized.slot.pitchName,
          addressLabel: serialized.slot.addressLabel,
          latitude: serialized.slot.latitude,
          longitude: serialized.slot.longitude,
          startsAt: new Date(serialized.slot.startsAt),
          endsAt: new Date(serialized.slot.endsAt),
          bookingTypeLabel: "Monthly group booking",
          shareAmountEtb:
            serialized.status === BookingStatus.PENDING
              ? asNumber(contribution?.expectedAmount ?? 0)
              : null,
          paymentDeadline:
            serialized.paymentPool?.status === PaymentPoolStatus.PENDING
              ? new Date(serialized.paymentPool.expiresAt)
              : null,
          qrTicketId:
            serialized.status === BookingStatus.CONFIRMED ? ticket?.id ?? null : null,
          qrEnabled: serialized.status === BookingStatus.CONFIRMED,
          note:
            serialized.status === BookingStatus.PENDING
              ? "Important: if the group payment expires before everyone pays, any paid shares go back to each person's Meda balance automatically."
              : "Your ticket is ready in Meda. Open Tickets any time to view it and your QR code.",
          viewTicketsUrl: `${getAppBaseUrl()}/tickets`,
          baseUrl: getAppBaseUrl(),
        });
      } catch (error) {
        logger.error("Failed to send monthly booking invite email", error);
      }
    }
  }

  await notifyUserById({
    userId: args.userId,
    subject:
      serialized.status === BookingStatus.PENDING
        ? "Your group booking is waiting for payment"
        : "Your group booking is confirmed",
    title:
      serialized.status === BookingStatus.PENDING
        ? "Your group booking was created"
        : "Your group booking is ready",
    message:
      serialized.status === BookingStatus.PENDING
        ? "Your group has the pitch on hold while everyone finishes payment."
        : "Your group booking is confirmed and every ticket is ready in Meda.",
    details: [
      { label: "Place", value: serialized.slot.pitchName },
      {
        label: "Time",
        value: `${new Date(serialized.slot.startsAt).toLocaleString()} - ${new Date(serialized.slot.endsAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`,
      },
      { label: "Group total", value: `ETB ${serialized.totalAmount.toFixed(2)}` },
      ...(serialized.paymentPool?.expiresAt
        ? [
            {
              label: "Payment deadline",
              value: new Date(serialized.paymentPool.expiresAt).toLocaleString(),
            },
          ]
        : []),
    ],
    ctaLabel: "Open Tickets",
    ctaPath: "/tickets",
  });

  return serialized;
}

export async function finalizeBookingConfirmationTx(
  tx: TransactionClient,
  bookingId: string,
  options?: {
    paidAt?: Date;
    paymentProvider?: PaymentProvider | null;
    markPoolFulfilled?: boolean;
  },
) {
  await acquireTransactionLock(tx, "slot-booking-confirm", bookingId);

  const booking = await loadBookingTx(tx, bookingId);
  const now = options?.paidAt ?? new Date();

  if (
    booking.status === BookingStatus.CONFIRMED ||
    booking.status === BookingStatus.COMPLETED
  ) {
    return booking;
  }
  if (
    booking.status === BookingStatus.CANCELLED ||
    booking.status === BookingStatus.EXPIRED
  ) {
    throw new Error("This booking can no longer be confirmed.");
  }
  if (booking.slot.status === SlotStatus.BLOCKED || booking.slot.status === SlotStatus.CANCELLED) {
    throw new Error("This slot is no longer available.");
  }
  if (booking.slot.endsAt <= now) {
    throw new Error("This slot has already ended.");
  }

  const remainingCapacity = await getRemainingCapacityTx({
    tx,
    slotId: booking.slotId,
    capacity: booking.slot.capacity,
    now,
    excludeBookingId: booking.id,
  });
  if (booking.quantity > remainingCapacity) {
    throw new Error("This booking can no longer be fulfilled because capacity is unavailable.");
  }

  const updated = await tx.booking.update({
    where: { id: booking.id },
    data: {
      status: BookingStatus.CONFIRMED,
      paidAt: now,
      expiresAt: null,
      failureReason: null,
      paymentProvider:
        options?.paymentProvider === undefined
          ? booking.paymentProvider
          : options.paymentProvider,
      ...(options?.markPoolFulfilled && booking.paymentPool
        ? {
            paymentPool: {
              update: {
                status: PaymentPoolStatus.FULFILLED,
                amountPaid: booking.paymentPool.totalAmount,
              },
            },
          }
        : {}),
      ...(booking.partyId
        ? {
            party: {
              update: {
                status: PartyStatus.ACTIVE,
              },
            },
          }
        : {}),
    },
    include: bookingInclude,
  });

  if (updated.productType === ProductType.MONTHLY) {
    await createUserPassesForBookingTx({
      tx,
      booking: updated,
    });
  }

  await recomputeSlotStatusTx(tx, updated.slotId, now);
  await logOwnerActivityTx({
    tx,
    ownerId: updated.slot.pitch.ownerId,
    pitchId: updated.slot.pitch.id,
    entityType: "booking",
    entityId: updated.id,
    action:
      updated.productType === ProductType.MONTHLY
        ? "monthly_booking.confirmed"
        : "daily_booking.confirmed",
    metadata: {
      slotId: updated.slot.id,
      totalAmount: asNumber(updated.totalAmount),
      paymentProvider: updated.paymentProvider ?? "free",
    },
  });

  return updated;
}

export async function confirmBookingPayment(args: {
  txRef: string;
  actor?: BookingActor | null;
}) {
  const booking = await prisma.booking.findFirst({
    where: {
      providerReference: args.txRef,
      paymentProvider: PaymentProvider.chapa,
    },
    include: bookingInclude,
  });

  if (!booking) {
    throw new Error("Booking payment not found");
  }
  if (args.actor && !canAccessBooking(booking, args.actor)) {
    throw new Error("Booking payment not found");
  }
  if (
    booking.status === BookingStatus.CONFIRMED ||
    booking.status === BookingStatus.COMPLETED
  ) {
    return {
      ok: true as const,
      status: "already_confirmed" as const,
      booking: await serializeBooking(booking),
    };
  }

  const verification = await verifyChapaTransactionWithRetry(args.txRef);
  const providerStatus = verification.data?.status?.toLowerCase() ?? "";
  if (providerStatus !== "success") {
    if (providerStatus === "failed") {
      await prisma.booking.update({
        where: { id: booking.id },
        data: {
          status: BookingStatus.CANCELLED,
          expiresAt: null,
          failureReason: "Payment failed at the provider.",
        },
      });
      return {
        ok: false as const,
        status: "failed" as const,
        booking: await getBookingForUser({
          bookingId: booking.id,
          actor: args.actor ?? {
            userId: booking.userId ?? booking.slot.pitch.ownerId,
            role: "user",
          },
        }),
      };
    }
    return {
      ok: false as const,
      status: "processing" as const,
      booking: await serializeBooking(booking),
    };
  }

  const verifiedAmount = Number(verification.data?.amount);
  if (
    Number.isFinite(verifiedAmount) &&
    Math.abs(verifiedAmount - asNumber(booking.totalAmount)) > 0.009
  ) {
    await prisma.booking.update({
      where: { id: booking.id },
      data: {
        status: BookingStatus.CANCELLED,
        expiresAt: null,
        failureReason: "Verified payment amount did not match the booking amount.",
      },
    });
    throw new Error("Verified payment amount did not match the booking amount.");
  }

  if (
    verification.data?.currency &&
    verification.data.currency.toUpperCase() !== booking.currency.toUpperCase()
  ) {
    await prisma.booking.update({
      where: { id: booking.id },
      data: {
        status: BookingStatus.CANCELLED,
        expiresAt: null,
        failureReason: "Verified payment currency did not match the booking currency.",
      },
    });
    throw new Error("Verified payment currency did not match the booking currency.");
  }

  const confirmed = await prisma.$transaction(async (tx) => {
    const latest = await finalizeBookingConfirmationTx(tx, booking.id, {
      paidAt: new Date(),
      paymentProvider: PaymentProvider.chapa,
    });
    await creditPitchOwnerBalanceTx({
      tx,
      ownerId: latest.slot.pitch.ownerId,
      ownerRevenueAmount: asNumber(latest.ownerRevenueAmount),
    });
    return latest;
  });

  if (confirmed.userId) {
    await notifyUserById({
      userId: confirmed.userId,
      subject: "Your Meda booking payment was confirmed",
      title: "Your booking is confirmed",
      message: "We received your payment and your booking is now active in Tickets.",
      details: [
        { label: "Place", value: confirmed.slot.pitch.name },
        {
          label: "Time",
          value: `${confirmed.slot.startsAt.toLocaleString()} - ${confirmed.slot.endsAt.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`,
        },
        { label: "Total", value: `ETB ${asNumber(confirmed.totalAmount).toFixed(2)}` },
      ],
      ctaLabel: "Open Tickets",
      ctaPath: "/tickets",
    });
  }

  return {
    ok: true as const,
    status: "confirmed" as const,
    booking: await serializeBooking(confirmed),
  };
}

export async function cancelBooking(args: {
  bookingId: string;
  actor: BookingActor;
}) {
  const booking = await getAuthorizedBooking({
    bookingId: args.bookingId,
    actor: args.actor,
  });

  const canCancel =
    isAdmin(args.actor) ||
    booking.userId === args.actor.userId ||
    isOwnerStaff(args.actor, booking.slot.pitch.ownerId);

  if (!canCancel) {
    throw new Error("You are not allowed to cancel this booking.");
  }

  const updated = await prisma.$transaction(async (tx) => {
    await acquireTransactionLock(tx, "slot-booking-cancel", booking.id);
    const latest = await loadBookingTx(tx, booking.id);

    if (
      latest.status === BookingStatus.CANCELLED ||
      latest.status === BookingStatus.EXPIRED
    ) {
      return latest;
    }
    if (latest.tickets.some((ticket) => ticket.status === TicketStatus.CHECKED_IN)) {
      throw new Error("Checked-in bookings cannot be cancelled.");
    }

    const now = new Date();
    const shouldRefund =
      (latest.status === BookingStatus.CONFIRMED ||
        latest.status === BookingStatus.COMPLETED) &&
      asNumber(latest.totalAmount) > 0;

    if (shouldRefund && latest.userId) {
      await tx.userBalance.upsert({
        where: { userId: latest.userId },
        update: {
          balanceEtb: { increment: asNumber(latest.totalAmount) },
        },
        create: {
          userId: latest.userId,
          balanceEtb: asNumber(latest.totalAmount),
        },
      });

      await tx.userBalance.upsert({
        where: { userId: latest.slot.pitch.ownerId },
        update: {
          balanceEtb: {
            decrement: asNumber(latest.ownerRevenueAmount),
          },
        },
        create: {
          userId: latest.slot.pitch.ownerId,
          balanceEtb: 0,
        },
      });
    }

    const cancelled = await tx.booking.update({
      where: { id: latest.id },
      data: {
        status: BookingStatus.CANCELLED,
        expiresAt: null,
        failureReason:
          latest.failureReason ??
          (shouldRefund
            ? "Cancelled and refunded to Meda balance."
            : "Cancelled by user."),
      },
      include: bookingInclude,
    });

    if (cancelled.paymentPool) {
      await tx.paymentPool.update({
        where: { id: cancelled.paymentPool.id },
        data: {
          status: PaymentPoolStatus.CANCELLED,
        },
      });
      await tx.paymentContribution.updateMany({
        where: {
          poolId: cancelled.paymentPool.id,
          status: ContributionStatus.PENDING,
        },
        data: {
          status: ContributionStatus.EXPIRED,
        },
      });
    }

    if (cancelled.partyId) {
      await tx.party.update({
        where: { id: cancelled.partyId },
        data: {
          status: PartyStatus.CANCELLED,
        },
      });
    }

    await recomputeSlotStatusTx(tx, cancelled.slotId, now);
    await logOwnerActivityTx({
      tx,
      ownerId: cancelled.slot.pitch.ownerId,
      pitchId: cancelled.slot.pitch.id,
      entityType: "booking",
      entityId: cancelled.id,
      action: shouldRefund ? "booking.refunded" : "booking.cancelled",
      metadata: {
        totalAmount: asNumber(cancelled.totalAmount),
        paymentProvider: cancelled.paymentProvider ?? null,
        refundedToUserId: shouldRefund ? cancelled.userId : null,
      },
    });

    return cancelled;
  });

  if (updated.userId) {
    await notifyUserById({
      userId: updated.userId,
      subject: "Your Meda booking was cancelled",
      title: "Your booking was cancelled",
      message:
        updated.failureReason?.includes("refunded")
          ? "Your booking was cancelled and the payment went back to your Meda balance."
          : "Your booking was cancelled.",
      details: [
        { label: "Place", value: updated.slot.pitch.name },
        {
          label: "Time",
          value: `${updated.slot.startsAt.toLocaleString()} - ${updated.slot.endsAt.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`,
        },
        { label: "Total", value: `ETB ${asNumber(updated.totalAmount).toFixed(2)}` },
      ],
      ctaLabel: "Open Tickets",
      ctaPath: "/tickets",
    });
  }

  return serializeBooking(updated);
}

export async function expirePendingBookings(now = new Date()) {
  const staleBookings = await prisma.booking.findMany({
    where: {
      status: BookingStatus.PENDING,
      paymentPool: {
        is: null,
      },
      expiresAt: {
        lt: now,
      },
    },
    select: { id: true },
  });

  let expiredCount = 0;
  for (const booking of staleBookings) {
    let expiredBookingUserId: string | null = null;
    let expiredPitchName: string | null = null;
    let expiredTimeLabel: string | null = null;
    await prisma.$transaction(async (tx) => {
      await acquireTransactionLock(tx, "slot-booking-expire", booking.id);
      const latest = await loadBookingTx(tx, booking.id);
      if (
        latest.status !== BookingStatus.PENDING ||
        !latest.expiresAt ||
        latest.expiresAt >= now
      ) {
        return;
      }

      await tx.booking.update({
        where: { id: latest.id },
        data: {
          status: BookingStatus.EXPIRED,
          failureReason: "Booking hold expired before payment completed.",
        },
      });
      expiredBookingUserId = latest.userId;
      expiredPitchName = latest.slot.pitch.name;
      expiredTimeLabel = `${latest.slot.startsAt.toLocaleString()} - ${latest.slot.endsAt.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`;

      if (latest.paymentPool) {
        await tx.paymentPool.update({
          where: { id: latest.paymentPool.id },
          data: {
            status: PaymentPoolStatus.EXPIRED,
          },
        });
      }

      if (latest.partyId) {
        await tx.party.update({
          where: { id: latest.partyId },
          data: {
            status: PartyStatus.EXPIRED,
          },
        });
      }

      await recomputeSlotStatusTx(tx, latest.slotId, now);
      await logOwnerActivityTx({
        tx,
        ownerId: latest.slot.pitch.ownerId,
        pitchId: latest.slot.pitch.id,
        entityType: "booking",
        entityId: latest.id,
        action: "booking.expired",
        metadata: {
          paymentPoolId: latest.paymentPool?.id ?? null,
        },
      });
      expiredCount += 1;
    });

    if (expiredBookingUserId && expiredPitchName && expiredTimeLabel) {
      await notifyUserById({
        userId: expiredBookingUserId,
        subject: "Your Meda booking hold expired",
        title: "Your booking hold expired",
        message: "We did not receive payment in time, so the booking was released.",
        details: [
          { label: "Place", value: expiredPitchName },
          {
            label: "Time",
            value: expiredTimeLabel,
          },
        ],
        ctaLabel: "Find another time",
        ctaPath: "/play",
      });
    }
  }

  return { expiredCount };
}
