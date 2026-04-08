import {
  BookingStatus,
  ContributionStatus,
  PartyMemberStatus,
  PartyStatus,
  PaymentPoolStatus,
  Prisma,
  ProductType,
  TicketStatus,
} from "@/generated/prisma/client";
import { getAuthUserByEmail, getAuthUserEmails } from "@/lib/auth/userLookup";
import { getAppBaseUrl } from "@/lib/env";
import { logger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import {
  notifyUserByEmail,
  notifyUserById,
} from "@/services/actionNotifications";
import { sendBookingTicketInviteEmail } from "@/services/email";

type TransactionClient = Prisma.TransactionClient;

type PartyRecord = {
  id: string;
  ownerId: string;
  name: string | null;
  status: PartyStatus;
  createdAt: Date;
  updatedAt: Date;
  members: Array<{
    id: string;
    userId: string | null;
    invitedEmail: string | null;
    status: PartyMemberStatus;
    joinedAt: Date | null;
    paidAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  }>;
  bookings?: Array<{
    id: string;
    status: string;
    createdAt: Date;
  }>;
  pools?: Array<{
    id: string;
    status: string;
    expiresAt: Date;
    amountPaid: unknown;
    totalAmount: unknown;
  }>;
};

function asNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeEmail(email?: string | null) {
  const normalized = email?.trim().toLowerCase() ?? "";
  return normalized || null;
}

function roundCurrency(value: number) {
  return Math.round(value * 100) / 100;
}

function buildReservedPitchContributionAmounts(args: {
  members: Array<{
    userId: string | null;
    invitedEmail: string | null;
  }>;
  organizerUserId: string;
  organizerEmail?: string | null;
  memberShareAmount: number;
  totalAmount: number;
}) {
  const normalizedOrganizerEmail = normalizeEmail(args.organizerEmail);
  const organizerIndex = Math.max(
    0,
    args.members.findIndex(
      (member) =>
        member.userId === args.organizerUserId ||
        (normalizedOrganizerEmail
          ? normalizeEmail(member.invitedEmail) === normalizedOrganizerEmail
          : false),
    ),
  );

  const amounts = args.members.map((_, index) =>
    index === organizerIndex ? 0 : roundCurrency(args.memberShareAmount),
  );
  const organizerAmount = roundCurrency(
    args.totalAmount - amounts.reduce((sum, amount) => sum + amount, 0),
  );
  amounts[organizerIndex] = Math.max(0, organizerAmount);

  return amounts;
}

async function getEditableMonthlyBookingTx(tx: TransactionClient, partyId: string) {
  return tx.booking.findFirst({
    where: {
      partyId,
      productType: ProductType.MONTHLY,
      status: {
        in: [BookingStatus.PENDING, BookingStatus.CONFIRMED],
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
              addressLabel: true,
              latitude: true,
              longitude: true,
            },
          },
        },
      },
      paymentPool: {
        include: {
          contributions: {
            orderBy: [{ createdAt: "asc" }],
          },
        },
      },
      tickets: {
        orderBy: [{ createdAt: "asc" }],
      },
    },
    orderBy: [{ createdAt: "desc" }],
  });
}

async function ensureBookingTicketCapacityTx(
  tx: TransactionClient,
  booking: Awaited<ReturnType<typeof getEditableMonthlyBookingTx>>,
) {
  if (!booking) return null;
  const missingCount = Math.max(0, booking.quantity - booking.tickets.length);
  if (missingCount <= 0) return booking;
  if (!booking.userId) {
    throw new Error("This booking is missing its organizer.");
  }

  await tx.bookingTicket.createMany({
    data: Array.from({ length: missingCount }).map(() => ({
      bookingId: booking.id,
      purchaserId: booking.userId!,
      assignedUserId: null,
      assignedEmail: null,
      assignedName: null,
      status: TicketStatus.ASSIGNMENT_PENDING,
    })),
  });

  return getEditableMonthlyBookingTx(tx, booking.partyId!);
}

async function syncTicketsForMembersTx(args: {
  tx: TransactionClient;
  booking: NonNullable<Awaited<ReturnType<typeof getEditableMonthlyBookingTx>>>;
  activeMembers: Array<{
    id: string;
    userId: string | null;
    invitedEmail: string | null;
  }>;
}) {
  const authUsers = await getAuthUserEmails(
    args.activeMembers
      .map((member) => member.userId)
      .filter((userId): userId is string => Boolean(userId)),
  );

  const reservedTicketIds = new Set<string>();
  const assignments = new Map<string, string>();

  const findExistingTicket = (member: (typeof args.activeMembers)[number]) =>
    args.booking.tickets.find((ticket) => {
      if (ticket.status === TicketStatus.CHECKED_IN) {
        return (
          (member.userId && ticket.assignedUserId === member.userId) ||
          (member.invitedEmail &&
            normalizeEmail(ticket.assignedEmail) === normalizeEmail(member.invitedEmail))
        );
      }

      return (
        (member.userId && ticket.assignedUserId === member.userId) ||
        (member.invitedEmail &&
          normalizeEmail(ticket.assignedEmail) === normalizeEmail(member.invitedEmail))
      );
    });

  const availableTickets = [...args.booking.tickets];

  for (const member of args.activeMembers) {
    const existingTicket = findExistingTicket(member);
    if (existingTicket) {
      const authUser = member.userId ? authUsers.get(member.userId) ?? null : null;
      await args.tx.bookingTicket.update({
        where: { id: existingTicket.id },
        data: {
          assignedUserId: member.userId,
          assignedEmail: normalizeEmail(authUser?.email ?? member.invitedEmail),
          assignedName: authUser?.name ?? null,
          status:
            existingTicket.status === TicketStatus.CHECKED_IN
              ? TicketStatus.CHECKED_IN
              : member.userId || member.invitedEmail
                ? member.userId
                  ? TicketStatus.VALID
                  : TicketStatus.ASSIGNED
                : TicketStatus.ASSIGNMENT_PENDING,
        },
      });
      reservedTicketIds.add(existingTicket.id);
      assignments.set(member.id, existingTicket.id);
    }
  }

  for (const member of args.activeMembers) {
    if (assignments.has(member.id)) {
      continue;
    }

    const nextTicket = availableTickets.find(
      (ticket) =>
        !reservedTicketIds.has(ticket.id) &&
        ticket.status !== TicketStatus.CHECKED_IN,
    );
    if (!nextTicket) {
      throw new Error("No more player slots are available in this booking.");
    }

    const authUser = member.userId ? authUsers.get(member.userId) ?? null : null;
    await args.tx.bookingTicket.update({
      where: { id: nextTicket.id },
      data: {
        assignedUserId: member.userId,
        assignedEmail: normalizeEmail(authUser?.email ?? member.invitedEmail),
        assignedName: authUser?.name ?? null,
        status:
          member.userId || member.invitedEmail
            ? member.userId
              ? TicketStatus.VALID
              : TicketStatus.ASSIGNED
            : TicketStatus.ASSIGNMENT_PENDING,
      },
    });
    reservedTicketIds.add(nextTicket.id);
    assignments.set(member.id, nextTicket.id);
  }

  for (const ticket of args.booking.tickets) {
    if (reservedTicketIds.has(ticket.id) || ticket.status === TicketStatus.CHECKED_IN) {
      continue;
    }

    await args.tx.bookingTicket.update({
      where: { id: ticket.id },
      data: {
        assignedUserId: null,
        assignedEmail: null,
        assignedName: null,
        status: TicketStatus.ASSIGNMENT_PENDING,
      },
    });
  }

  return assignments;
}

async function rebuildPoolContributionsTx(args: {
  tx: TransactionClient;
  booking: NonNullable<Awaited<ReturnType<typeof getEditableMonthlyBookingTx>>>;
  activeMembers: Array<{
    id: string;
    userId: string | null;
    invitedEmail: string | null;
  }>;
}) {
  if (!args.booking.paymentPool) return;
  if (!args.booking.userId) {
    throw new Error("This booking is missing its organizer.");
  }

  const totalAmount = roundCurrency(asNumber(args.booking.totalAmount));
  const expectedAmounts = buildReservedPitchContributionAmounts({
    members: args.activeMembers.map((member) => ({
      userId: member.userId,
      invitedEmail: member.invitedEmail,
    })),
    organizerUserId: args.booking.userId,
    organizerEmail: null,
    memberShareAmount: roundCurrency(
      args.booking.quantity > 0 ? totalAmount / args.booking.quantity : 0,
    ),
    totalAmount,
  });

  await args.tx.paymentContribution.deleteMany({
    where: { poolId: args.booking.paymentPool.id },
  });

  await args.tx.paymentContribution.createMany({
    data: args.activeMembers.map((member, index) => ({
      poolId: args.booking.paymentPool!.id,
      userId: member.userId,
      partyMemberId: member.id,
      expectedAmount: expectedAmounts[index] ?? 0,
      paidAmount: 0,
      status: ContributionStatus.PENDING,
      providerRef: null,
      paidAt: null,
    })),
  });

  await args.tx.paymentPool.update({
    where: { id: args.booking.paymentPool.id },
    data: {
      amountPaid: 0,
      status: PaymentPoolStatus.PENDING,
    },
  });
}

export async function syncEditableMonthlyBookingForPartyTx(args: {
  tx: TransactionClient;
  partyId: string;
}) {
  let booking = await getEditableMonthlyBookingTx(args.tx, args.partyId);
  booking = await ensureBookingTicketCapacityTx(args.tx, booking);

  if (!booking) {
    return {
      booking: null,
      activeMembers: [] as Array<{
        id: string;
        userId: string | null;
        invitedEmail: string | null;
      }>,
      assignments: new Map<string, string>(),
    };
  }

  const activeMembers = await args.tx.partyMember.findMany({
    where: {
      partyId: args.partyId,
      status: {
        not: PartyMemberStatus.REMOVED,
      },
    },
    orderBy: [{ createdAt: "asc" }],
  });

  const assignments = await syncTicketsForMembersTx({
    tx: args.tx,
    booking,
    activeMembers,
  });

  if (
    booking.paymentPool &&
    booking.paymentPool.status === PaymentPoolStatus.PENDING &&
    asNumber(booking.paymentPool.amountPaid) === 0
  ) {
    await rebuildPoolContributionsTx({
      tx: args.tx,
      booking,
      activeMembers,
    });
  }

  return {
    booking: await getEditableMonthlyBookingTx(args.tx, args.partyId),
    activeMembers,
    assignments,
  };
}

async function serializeParty(party: PartyRecord) {
  const userIds = [
    ...new Set(
      party.members
        .map((member) => member.userId)
        .filter((userId): userId is string => Boolean(userId)),
    ),
  ];
  const authUsers = await getAuthUserEmails(userIds);

  return {
    id: party.id,
    ownerId: party.ownerId,
    name: party.name,
    status: party.status,
    createdAt: party.createdAt.toISOString(),
    updatedAt: party.updatedAt.toISOString(),
    members: party.members.map((member) => {
      const authUser = member.userId ? authUsers.get(member.userId) ?? null : null;
      return {
        id: member.id,
        userId: member.userId,
        invitedEmail: member.invitedEmail,
        displayName: authUser?.name ?? member.invitedEmail ?? "Party member",
        status: member.status,
        joinedAt: member.joinedAt?.toISOString() ?? null,
        paidAt: member.paidAt?.toISOString() ?? null,
        createdAt: member.createdAt.toISOString(),
        updatedAt: member.updatedAt.toISOString(),
      };
    }),
    bookings:
      party.bookings?.map((booking) => ({
        id: booking.id,
        status: booking.status,
        createdAt: booking.createdAt.toISOString(),
      })) ?? [],
    pools:
      party.pools?.map((pool) => ({
        id: pool.id,
        status: pool.status,
        expiresAt: pool.expiresAt.toISOString(),
        amountPaid: asNumber(pool.amountPaid),
        totalAmount: asNumber(pool.totalAmount),
      })) ?? [],
  };
}

async function getPartyWithAccess(args: {
  partyId: string;
  userId: string;
  userEmail?: string | null;
}) {
  const normalizedEmail = args.userEmail?.trim().toLowerCase() ?? null;
  const party = await prisma.party.findFirst({
    where: {
      id: args.partyId,
      OR: [
        { ownerId: args.userId },
        {
          members: {
            some: {
              OR: [
                { userId: args.userId },
                ...(normalizedEmail ? [{ invitedEmail: normalizedEmail }] : []),
              ],
            },
          },
        },
      ],
    },
    include: {
      members: {
        orderBy: [{ createdAt: "asc" }],
      },
      bookings: {
        orderBy: [{ createdAt: "desc" }],
        take: 10,
      },
      pools: {
        orderBy: [{ createdAt: "desc" }],
        take: 10,
      },
    },
  });

  if (!party) {
    throw new Error("Party not found");
  }

  return party;
}

export async function createParty(args: {
  ownerId: string;
  name?: string | null;
}) {
  const now = new Date();
  const party = await prisma.party.create({
    data: {
      ownerId: args.ownerId,
      name: args.name ?? null,
      status: PartyStatus.FORMING,
      members: {
        create: {
          userId: args.ownerId,
          status: PartyMemberStatus.JOINED,
          joinedAt: now,
        },
      },
    },
    include: {
      members: {
        orderBy: [{ createdAt: "asc" }],
      },
      bookings: true,
      pools: true,
    },
  });

  await notifyUserById({
    userId: args.ownerId,
    subject: "Your group was created",
    title: "Your group is ready",
    message: "You can now invite people and use this group for monthly bookings.",
    details: [{ label: "Group", value: party.name ?? "Unnamed group" }],
    ctaLabel: "Open Tickets",
    ctaPath: "/tickets",
  });

  return serializeParty(party as PartyRecord);
}

export async function listPartiesForUser(args: {
  userId: string;
  userEmail?: string | null;
}) {
  const normalizedEmail = args.userEmail?.trim().toLowerCase() ?? null;
  const parties = await prisma.party.findMany({
    where: {
      OR: [
        { ownerId: args.userId },
        {
          members: {
            some: {
              OR: [
                { userId: args.userId },
                ...(normalizedEmail ? [{ invitedEmail: normalizedEmail }] : []),
              ],
            },
          },
        },
      ],
    },
    include: {
      members: {
        orderBy: [{ createdAt: "asc" }],
      },
      bookings: {
        orderBy: [{ createdAt: "desc" }],
        take: 10,
      },
      pools: {
        orderBy: [{ createdAt: "desc" }],
        take: 10,
      },
    },
    orderBy: [{ updatedAt: "desc" }],
  });

  return Promise.all(parties.map((party) => serializeParty(party as PartyRecord)));
}

export async function invitePartyMembers(args: {
  partyId: string;
  ownerId: string;
  emails: string[];
}) {
  const normalizedEmails = [...new Set(args.emails.map((email) => email.trim().toLowerCase()).filter(Boolean))];
  if (normalizedEmails.length === 0) {
    throw new Error("At least one invite email is required");
  }

  const emailJobs: Array<{
    to: string;
    recipientName: string | null;
    pitchName: string;
    addressLabel: string | null;
    latitude: number | null;
    longitude: number | null;
    startsAt: Date;
    endsAt: Date;
    shareAmountEtb: number | null;
    paymentDeadline: Date | null;
    qrTicketId: string | null;
    note: string;
  }> = [];

  const partyId = await prisma.$transaction(async (tx) => {
    const party = await tx.party.findFirst({
      where: {
        id: args.partyId,
        ownerId: args.ownerId,
      },
      include: {
        members: {
          orderBy: [{ createdAt: "asc" }],
        },
      },
    });

    if (!party) {
      throw new Error("Party not found");
    }

    let booking = await getEditableMonthlyBookingTx(tx, party.id);
    booking = await ensureBookingTicketCapacityTx(tx, booking);

    if (
      booking?.paymentPool &&
      booking.paymentPool.status === PaymentPoolStatus.PENDING &&
      asNumber(booking.paymentPool.amountPaid) > 0
    ) {
      throw new Error(
        "You cannot add new group members after payments start. You can still change player names on the tickets below.",
      );
    }

    const existingByEmail = new Map(
      party.members
        .filter((member) => member.invitedEmail)
        .map((member) => [member.invitedEmail!.toLowerCase(), member] as const),
    );
    const currentActiveCount = party.members.filter(
      (member) => member.status !== PartyMemberStatus.REMOVED,
    ).length;
    const projectedAdds = normalizedEmails.filter((email) => {
      const existing = existingByEmail.get(email);
      return !existing || existing.status === PartyMemberStatus.REMOVED;
    }).length;
    const maxMembers = booking?.slot.capacity ?? Number.POSITIVE_INFINITY;

    if (currentActiveCount + projectedAdds > maxMembers) {
      throw new Error(
        `This booking holds ${maxMembers} player${maxMembers === 1 ? "" : "s"}, so you cannot add more people.`,
      );
    }

    const createdOrRevivedIds: string[] = [];

    for (const email of normalizedEmails) {
      const knownUser = await getAuthUserByEmail(email);
      const existing = existingByEmail.get(email);
      if (existing) {
        await tx.partyMember.update({
          where: { id: existing.id },
          data: {
            userId: knownUser?.id ?? existing.userId,
            invitedEmail: email,
            status:
              existing.status === PartyMemberStatus.REMOVED
                ? PartyMemberStatus.INVITED
                : existing.status,
          },
        });
        if (existing.status === PartyMemberStatus.REMOVED) {
          createdOrRevivedIds.push(existing.id);
        }
        continue;
      }

      const created = await tx.partyMember.create({
        data: {
          partyId: party.id,
          userId: knownUser?.id ?? null,
          invitedEmail: email,
          status: PartyMemberStatus.INVITED,
        },
      });
      createdOrRevivedIds.push(created.id);
    }

    if (booking) {
      const synced = await syncEditableMonthlyBookingForPartyTx({
        tx,
        partyId: party.id,
      });
      const activeMembers = synced.activeMembers;
      const assignments = synced.assignments;
      const refreshedBooking = synced.booking;
      if (refreshedBooking) {
        const authUsers = await getAuthUserEmails(
          activeMembers
            .map((member) => member.userId)
            .filter((userId): userId is string => Boolean(userId)),
        );

        for (const member of activeMembers) {
          if (!createdOrRevivedIds.includes(member.id)) {
            continue;
          }

          const to = normalizeEmail(member.invitedEmail) ?? authUsers.get(member.userId ?? "")?.email ?? null;
          if (!to) {
            continue;
          }

          const contribution = refreshedBooking.paymentPool?.contributions.find(
            (entry) => entry.partyMemberId === member.id,
          );
          const assignedTicketId = assignments.get(member.id) ?? null;
          const shareAmountEtb =
            refreshedBooking.status === BookingStatus.PENDING
              ? asNumber(contribution?.expectedAmount ?? 0)
              : null;
          const note =
            refreshedBooking.status === BookingStatus.PENDING
              ? "Important: if the group payment expires before everyone pays, any paid shares go back to each person's Meda balance automatically."
              : "Your ticket is ready in Meda. Open Tickets any time to view it and your QR code.";

          emailJobs.push({
            to,
            recipientName: authUsers.get(member.userId ?? "")?.name ?? null,
            pitchName: refreshedBooking.slot.pitch.name,
            addressLabel: refreshedBooking.slot.pitch.addressLabel ?? null,
            latitude: refreshedBooking.slot.pitch.latitude ?? null,
            longitude: refreshedBooking.slot.pitch.longitude ?? null,
            startsAt: refreshedBooking.slot.startsAt,
            endsAt: refreshedBooking.slot.endsAt,
            shareAmountEtb,
            paymentDeadline:
              refreshedBooking.paymentPool?.status === PaymentPoolStatus.PENDING
                ? refreshedBooking.paymentPool.expiresAt
                : null,
            qrTicketId:
              refreshedBooking.status === BookingStatus.CONFIRMED ? assignedTicketId : null,
            note,
          });
        }
      }
    }

    return party.id;
  });

  const refreshed = await prisma.party.findUniqueOrThrow({
    where: { id: partyId },
    include: {
      members: {
        orderBy: [{ createdAt: "asc" }],
      },
      bookings: true,
      pools: true,
    },
  });

  for (const job of emailJobs) {
    try {
      await sendBookingTicketInviteEmail({
        to: job.to,
        recipientName: job.recipientName,
        pitchName: job.pitchName,
        addressLabel: job.addressLabel,
        latitude: job.latitude,
        longitude: job.longitude,
        startsAt: job.startsAt,
        endsAt: job.endsAt,
        bookingTypeLabel: "Monthly group booking",
        shareAmountEtb: job.shareAmountEtb,
        paymentDeadline: job.paymentDeadline,
        qrTicketId: job.qrTicketId,
        qrEnabled: Boolean(job.qrTicketId),
        note: job.note,
        viewTicketsUrl: `${getAppBaseUrl()}/tickets`,
        baseUrl: getAppBaseUrl(),
      });
    } catch (error) {
      logger.error("Failed to send monthly group member email", error);
    }
  }

  await notifyUserById({
    userId: args.ownerId,
    subject: "Your group invite list was updated",
    title: "Group invites were sent",
    message:
      normalizedEmails.length === 1
        ? "One person was added to your group."
        : `${normalizedEmails.length} people were added to your group.`,
    details: [{ label: "Group", value: refreshed.name ?? "Unnamed group" }],
    ctaLabel: "Open Tickets",
    ctaPath: "/tickets",
  });

  return serializeParty(refreshed as PartyRecord);
}

export async function joinParty(args: {
  partyId: string;
  userId: string;
  userEmail?: string | null;
}) {
  const normalizedEmail = args.userEmail?.trim().toLowerCase() ?? null;
  const party = await prisma.party.findUnique({
    where: { id: args.partyId },
    include: {
      members: true,
      bookings: true,
      pools: true,
    },
  });

  if (!party) {
    throw new Error("Party not found");
  }

  const member = party.members.find(
    (entry) =>
      entry.userId === args.userId ||
      (normalizedEmail ? entry.invitedEmail?.toLowerCase() === normalizedEmail : false),
  );

  if (!member) {
    throw new Error("You are not invited to this party");
  }

  if (member.status === PartyMemberStatus.REMOVED) {
    throw new Error("You are no longer part of this party");
  }

  await prisma.partyMember.update({
    where: { id: member.id },
    data: {
      userId: args.userId,
      status:
        member.status === PartyMemberStatus.PAID
          ? PartyMemberStatus.PAID
          : PartyMemberStatus.JOINED,
      joinedAt: member.joinedAt ?? new Date(),
    },
  });

  const refreshed = await prisma.party.findUniqueOrThrow({
    where: { id: party.id },
    include: {
      members: {
        orderBy: [{ createdAt: "asc" }],
      },
      bookings: true,
      pools: true,
    },
  });

  await notifyUserById({
    userId: args.userId,
    subject: "You joined a Meda group",
    title: "You joined the group",
    message: "You are now part of this monthly booking group in Meda.",
    details: [{ label: "Group", value: refreshed.name ?? "Unnamed group" }],
    ctaLabel: "Open Tickets",
    ctaPath: "/tickets",
  });

  return serializeParty(refreshed as PartyRecord);
}

export async function getPartyForUser(args: {
  partyId: string;
  userId: string;
  userEmail?: string | null;
}) {
  const party = await getPartyWithAccess(args);
  return serializeParty(party as PartyRecord);
}

export async function updateParty(args: {
  partyId: string;
  ownerId: string;
  name?: string | null;
  status?: PartyStatus;
}) {
  const party = await prisma.party.findFirst({
    where: {
      id: args.partyId,
      ownerId: args.ownerId,
    },
    select: {
      id: true,
    },
  });

  if (!party) {
    throw new Error("Party not found");
  }

  const updated = await prisma.party.update({
    where: { id: party.id },
    data: {
      name: args.name,
      status: args.status,
    },
    include: {
      members: {
        orderBy: [{ createdAt: "asc" }],
      },
      bookings: true,
      pools: true,
    },
  });

  await notifyUserById({
    userId: args.ownerId,
    subject: "Your group was updated",
    title: "Your group details were saved",
    message: "We saved the latest group name and status.",
    details: [{ label: "Group", value: updated.name ?? "Unnamed group" }],
    ctaLabel: "Open Tickets",
    ctaPath: "/tickets",
  });

  return serializeParty(updated as PartyRecord);
}

export async function removePartyMember(args: {
  partyId: string;
  ownerId: string;
  memberId: string;
}) {
  let removedMemberUserId: string | null = null;
  let removedMemberEmail: string | null = null;
  let removedPartyName: string | null = null;
  const partyId = await prisma.$transaction(async (tx) => {
    const party = await tx.party.findFirst({
      where: {
        id: args.partyId,
        ownerId: args.ownerId,
      },
      include: {
        members: {
          orderBy: [{ createdAt: "asc" }],
        },
      },
    });

    if (!party) {
      throw new Error("Party not found");
    }

    const member = party.members.find((entry) => entry.id === args.memberId);
    if (!member) {
      throw new Error("Party member not found");
    }
    if (member.userId === party.ownerId) {
      throw new Error("The party owner cannot be removed");
    }
    removedMemberUserId = member.userId;
    removedMemberEmail = normalizeEmail(member.invitedEmail);
    removedPartyName = party.name ?? null;

    let booking = await getEditableMonthlyBookingTx(tx, party.id);
    booking = await ensureBookingTicketCapacityTx(tx, booking);

    if (
      booking?.paymentPool &&
      booking.paymentPool.status === PaymentPoolStatus.PENDING &&
      asNumber(booking.paymentPool.amountPaid) > 0
    ) {
      throw new Error(
        "You cannot remove group members after payments start. Change the player name instead.",
      );
    }

    if (booking) {
      const matchingCheckedInTicket = booking.tickets.find(
        (ticket) =>
          ticket.status === TicketStatus.CHECKED_IN &&
          ((member.userId && ticket.assignedUserId === member.userId) ||
            (member.invitedEmail &&
              normalizeEmail(ticket.assignedEmail) === normalizeEmail(member.invitedEmail))),
      );
      if (matchingCheckedInTicket) {
        throw new Error("Checked-in players cannot be removed from this booking.");
      }
    }

    await tx.partyMember.update({
      where: { id: member.id },
      data: {
        status: PartyMemberStatus.REMOVED,
      },
    });

    if (booking) {
      await syncEditableMonthlyBookingForPartyTx({
        tx,
        partyId: party.id,
      });
    }

    return party.id;
  });

  const refreshed = await prisma.party.findUniqueOrThrow({
    where: { id: partyId },
    include: {
      members: {
        orderBy: [{ createdAt: "asc" }],
      },
      bookings: true,
      pools: true,
    },
  });

  await notifyUserById({
    userId: args.ownerId,
    subject: "A group member was removed",
    title: "The group was updated",
    message: "We removed that person from your group.",
    details: [{ label: "Group", value: refreshed.name ?? "Unnamed group" }],
    ctaLabel: "Open Tickets",
    ctaPath: "/tickets",
  });

  if (removedMemberUserId) {
    await notifyUserById({
      userId: removedMemberUserId,
      subject: "You were removed from a Meda group",
      title: "You were removed from the group",
      message: "You no longer have a spot in this group booking.",
      details: [{ label: "Group", value: removedPartyName ?? refreshed.name ?? "Unnamed group" }],
      ctaLabel: "Open Tickets",
      ctaPath: "/tickets",
    });
  } else if (removedMemberEmail) {
    await notifyUserByEmail({
      email: removedMemberEmail,
      subject: "You were removed from a Meda group",
      title: "You were removed from the group",
      message: "You no longer have a spot in this group booking.",
      details: [{ label: "Group", value: removedPartyName ?? refreshed.name ?? "Unnamed group" }],
      ctaLabel: "Open Tickets",
      ctaPath: "/tickets",
    });
  }

  return serializeParty(refreshed as PartyRecord);
}
