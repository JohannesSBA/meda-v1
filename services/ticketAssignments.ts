import {
  Prisma,
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

export type TicketActor = {
  userId: string;
  role?: string | null;
  email?: string | null;
  parentPitchOwnerUserId?: string | null;
};

type TransactionClient = Prisma.TransactionClient;

const ticketInclude = {
  booking: {
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
      party: {
        include: {
          members: true,
        },
      },
    },
  },
} satisfies Prisma.BookingTicketInclude;

type TicketRecord = Prisma.BookingTicketGetPayload<{
  include: typeof ticketInclude;
}>;

function normalizeEmail(email?: string | null) {
  const normalized = email?.trim().toLowerCase() ?? "";
  return normalized || null;
}

function canManageOwnerSideTicket(
  actor: Pick<TicketActor, "userId" | "role" | "parentPitchOwnerUserId">,
  ownerId: string,
) {
  return (
    actor.role === "admin" ||
    actor.userId === ownerId ||
    (actor.role === "facilitator" && actor.parentPitchOwnerUserId === ownerId)
  );
}

function canAssignTicket(actor: TicketActor, ticket: TicketRecord) {
  return actor.role === "admin" || ticket.purchaserId === actor.userId;
}

function canSeeOrClaimTicket(actor: TicketActor, ticket: TicketRecord) {
  const actorEmail = normalizeEmail(actor.email);
  return (
    actor.role === "admin" ||
    ticket.purchaserId === actor.userId ||
    ticket.assignedUserId === actor.userId ||
    canManageOwnerSideTicket(actor, ticket.booking.slot.pitch.ownerId) ||
    (actorEmail ? normalizeEmail(ticket.assignedEmail) === actorEmail : false)
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

async function serializeTicket(ticket: TicketRecord) {
  return {
    id: ticket.id,
    bookingId: ticket.bookingId,
    purchaserId: ticket.purchaserId,
    assignedUserId: ticket.assignedUserId,
    assignedName: ticket.assignedName ?? null,
    assignedEmail: ticket.assignedEmail ?? null,
    status: ticket.status,
    checkedInAt: ticket.checkedInAt?.toISOString() ?? null,
    slot: {
      id: ticket.booking.slot.id,
      pitchId: ticket.booking.slot.pitchId,
      pitchName: ticket.booking.slot.pitch.name,
      ownerId: ticket.booking.slot.pitch.ownerId,
      startsAt: ticket.booking.slot.startsAt.toISOString(),
      endsAt: ticket.booking.slot.endsAt.toISOString(),
    },
  };
}

async function loadTicket(ticketId: string) {
  const ticket = await prisma.bookingTicket.findUnique({
    where: { id: ticketId },
    include: ticketInclude,
  });
  if (!ticket) {
    throw new Error("Ticket not found");
  }
  return ticket;
}

export async function assignTicket(args: {
  ticketId: string;
  actor: TicketActor;
  assignedUserId?: string;
  assignedEmail?: string | null;
  assignedName?: string | null;
}) {
  const ticket = await loadTicket(args.ticketId);
  if (!canAssignTicket(args.actor, ticket)) {
    throw new Error("You are not allowed to assign this ticket.");
  }
  if (ticket.status === TicketStatus.CHECKED_IN) {
    throw new Error("Checked-in tickets cannot be reassigned.");
  }

  const normalizedEmail = normalizeEmail(args.assignedEmail);
  const normalizedName = args.assignedName?.trim() || null;
  if (!args.assignedUserId && !normalizedEmail && !normalizedName) {
    throw new Error("Add a player name or email before saving this ticket.");
  }
  const knownUser =
    args.assignedUserId
      ? null
      : normalizedEmail
        ? await getAuthUserByEmail(normalizedEmail)
        : null;
  const assignedUserId = args.assignedUserId ?? knownUser?.id ?? null;
  const status = assignedUserId ? TicketStatus.VALID : TicketStatus.ASSIGNED;

  const updated = await prisma.$transaction(async (tx) => {
    const nextTicket = await tx.bookingTicket.update({
      where: { id: ticket.id },
      data: {
        assignedUserId,
        assignedEmail:
          normalizedEmail ?? (assignedUserId === args.actor.userId ? normalizeEmail(args.actor.email) : null),
        assignedName: normalizedName,
        status,
      },
      include: ticketInclude,
    });

    await logOwnerActivityTx({
      tx,
      ownerId: nextTicket.booking.slot.pitch.ownerId,
      pitchId: nextTicket.booking.slot.pitch.id,
      entityType: "ticket",
      entityId: nextTicket.id,
      action: "ticket.assigned",
      metadata: {
        bookingId: nextTicket.bookingId,
        assignedUserId,
        assignedEmail:
          normalizedEmail ?? (assignedUserId === args.actor.userId ? normalizeEmail(args.actor.email) : null),
      },
    });

    return nextTicket;
  });

  const assigneeUsers = await getAuthUserEmails(
    [updated.assignedUserId].filter((userId): userId is string => Boolean(userId)),
  );
  const recipientEmail =
    normalizeEmail(updated.assignedEmail) ??
    (updated.assignedUserId ? assigneeUsers.get(updated.assignedUserId)?.email ?? null : null);
  const recipientName =
    updated.assignedName ??
    (updated.assignedUserId ? assigneeUsers.get(updated.assignedUserId)?.name ?? null : null);
  const previousRecipientEmail = normalizeEmail(ticket.assignedEmail);

  if (
    recipientEmail &&
    (recipientEmail !== previousRecipientEmail ||
      updated.assignedUserId !== ticket.assignedUserId ||
      updated.assignedName !== ticket.assignedName)
  ) {
    try {
      await sendBookingTicketInviteEmail({
        to: recipientEmail,
        recipientName,
        pitchName: updated.booking.slot.pitch.name,
        addressLabel: updated.booking.slot.pitch.addressLabel ?? null,
        latitude: updated.booking.slot.pitch.latitude ?? null,
        longitude: updated.booking.slot.pitch.longitude ?? null,
        startsAt: updated.booking.slot.startsAt,
        endsAt: updated.booking.slot.endsAt,
        bookingTypeLabel:
          updated.booking.productType === "MONTHLY"
            ? "Monthly group booking"
            : "Single visit",
        shareAmountEtb: null,
        paymentDeadline: updated.booking.expiresAt,
        qrTicketId:
          updated.booking.status === "CONFIRMED" || updated.booking.status === "COMPLETED"
            ? updated.id
            : null,
        qrEnabled:
          updated.booking.status === "CONFIRMED" || updated.booking.status === "COMPLETED",
        note:
          updated.booking.status === "PENDING"
            ? "This booking is still waiting for payment. Your QR code appears automatically as soon as the booking is fully paid."
            : "Your ticket is ready. The QR code is attached and also appears in Tickets.",
        viewTicketsUrl: `${getAppBaseUrl()}/tickets`,
        baseUrl: getAppBaseUrl(),
      });
    } catch (error) {
      logger.error("Failed to send assigned booking ticket email", error);
    }
  }

  await notifyUserById({
    userId: args.actor.userId,
    subject: "A booking ticket was assigned",
    title: "Ticket assignment saved",
    message: "We saved the player name for this ticket.",
    details: [
      { label: "Place", value: updated.booking.slot.pitch.name },
      {
        label: "Time",
        value: `${updated.booking.slot.startsAt.toLocaleString()} - ${updated.booking.slot.endsAt.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`,
      },
      { label: "Assigned to", value: recipientEmail ?? updated.assignedName ?? "Player" },
    ],
    ctaLabel: "Open Tickets",
    ctaPath: "/tickets",
  });

  return serializeTicket(updated);
}

export async function claimAssignedTicket(args: {
  ticketId: string;
  actor: TicketActor;
}) {
  const ticket = await loadTicket(args.ticketId);
  if (!canSeeOrClaimTicket(args.actor, ticket)) {
    throw new Error("Ticket not found");
  }

  const actorEmail = normalizeEmail(args.actor.email);
  if (
    ticket.assignedUserId !== args.actor.userId &&
    (!actorEmail || normalizeEmail(ticket.assignedEmail) !== actorEmail)
  ) {
    throw new Error("This ticket is not assigned to you.");
  }

  const updated = await prisma.$transaction(async (tx) => {
    const nextTicket = await tx.bookingTicket.update({
      where: { id: ticket.id },
      data: {
        assignedUserId: args.actor.userId,
        assignedEmail: actorEmail,
        status: TicketStatus.VALID,
      },
      include: ticketInclude,
    });

    await logOwnerActivityTx({
      tx,
      ownerId: nextTicket.booking.slot.pitch.ownerId,
      pitchId: nextTicket.booking.slot.pitch.id,
      entityType: "ticket",
      entityId: nextTicket.id,
      action: "ticket.claimed",
      metadata: {
        bookingId: nextTicket.bookingId,
        claimedByUserId: args.actor.userId,
      },
    });

    return nextTicket;
  });

  await notifyUserById({
    userId: args.actor.userId,
    subject: "A booking ticket was claimed",
    title: "Ticket claimed",
    message: "That ticket is now under your name in Meda.",
    details: [
      { label: "Place", value: updated.booking.slot.pitch.name },
      {
        label: "Time",
        value: `${updated.booking.slot.startsAt.toLocaleString()} - ${updated.booking.slot.endsAt.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`,
      },
    ],
    ctaLabel: "Open Tickets",
    ctaPath: "/tickets",
  });

  return serializeTicket(updated);
}

export async function unassignTicket(args: {
  ticketId: string;
  actor: TicketActor;
}) {
  const ticket = await loadTicket(args.ticketId);
  if (!canAssignTicket(args.actor, ticket)) {
    throw new Error("You are not allowed to unassign this ticket.");
  }
  if (ticket.status === TicketStatus.CHECKED_IN) {
    throw new Error("Checked-in tickets cannot be unassigned.");
  }

  const updated = await prisma.$transaction(async (tx) => {
    const nextTicket = await tx.bookingTicket.update({
      where: { id: ticket.id },
      data: {
        assignedUserId: null,
        assignedEmail: null,
        assignedName: null,
        status: TicketStatus.ASSIGNMENT_PENDING,
      },
      include: ticketInclude,
    });

    await logOwnerActivityTx({
      tx,
      ownerId: nextTicket.booking.slot.pitch.ownerId,
      pitchId: nextTicket.booking.slot.pitch.id,
      entityType: "ticket",
      entityId: nextTicket.id,
      action: "ticket.unassigned",
      metadata: {
        bookingId: nextTicket.bookingId,
      },
    });

    return nextTicket;
  });

  if (ticket.assignedUserId) {
    await notifyUserById({
      userId: ticket.assignedUserId,
      subject: "A booking ticket was removed from your name",
      title: "Ticket assignment removed",
      message: "A ticket that was assigned to you is no longer under your name.",
      details: [
        { label: "Place", value: updated.booking.slot.pitch.name },
        {
          label: "Time",
          value: `${updated.booking.slot.startsAt.toLocaleString()} - ${updated.booking.slot.endsAt.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`,
        },
      ],
      ctaLabel: "Open Tickets",
      ctaPath: "/tickets",
    });
  } else if (ticket.assignedEmail) {
    await notifyUserByEmail({
      email: ticket.assignedEmail,
      subject: "A booking ticket was removed from your name",
      title: "Ticket assignment removed",
      message: "A ticket that was assigned to you is no longer under your name.",
      details: [
        { label: "Place", value: updated.booking.slot.pitch.name },
        {
          label: "Time",
          value: `${updated.booking.slot.startsAt.toLocaleString()} - ${updated.booking.slot.endsAt.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`,
        },
      ],
      ctaLabel: "Open Tickets",
      ctaPath: "/tickets",
    });
  }

  await notifyUserById({
    userId: args.actor.userId,
    subject: "A booking ticket was unassigned",
    title: "Ticket assignment removed",
    message: "The ticket is back to needing a player name.",
    details: [
      { label: "Place", value: updated.booking.slot.pitch.name },
      {
        label: "Time",
        value: `${updated.booking.slot.startsAt.toLocaleString()} - ${updated.booking.slot.endsAt.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`,
      },
    ],
    ctaLabel: "Open Tickets",
    ctaPath: "/tickets",
  });

  return serializeTicket(updated);
}

export async function checkInTicket(args: {
  ticketId: string;
  actor: TicketActor;
}) {
  const ticket = await loadTicket(args.ticketId);
  if (!canManageOwnerSideTicket(args.actor, ticket.booking.slot.pitch.ownerId)) {
    throw new Error("You are not allowed to check in this ticket.");
  }
  if (ticket.status !== TicketStatus.ASSIGNED && ticket.status !== TicketStatus.VALID) {
    throw new Error("Only assigned tickets can be checked in.");
  }

  const updated = await prisma.$transaction(async (tx) => {
    const nextTicket = await tx.bookingTicket.update({
      where: { id: ticket.id },
      data: {
        status: TicketStatus.CHECKED_IN,
        checkedInAt: new Date(),
      },
      include: ticketInclude,
    });

    await logOwnerActivityTx({
      tx,
      ownerId: nextTicket.booking.slot.pitch.ownerId,
      pitchId: nextTicket.booking.slot.pitch.id,
      entityType: "ticket",
      entityId: nextTicket.id,
      action: "ticket.checked_in",
      metadata: {
        bookingId: nextTicket.bookingId,
        checkedInByUserId: args.actor.userId,
      },
    });

    return nextTicket;
  });

  const assignedEmail = normalizeEmail(updated.assignedEmail);
  if (updated.assignedUserId) {
    await notifyUserById({
      userId: updated.assignedUserId,
      subject: "You were checked in at Meda",
      title: "You are checked in",
      message: "Your ticket was checked in successfully.",
      details: [
        { label: "Place", value: updated.booking.slot.pitch.name },
        {
          label: "Time",
          value: `${updated.booking.slot.startsAt.toLocaleString()} - ${updated.booking.slot.endsAt.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`,
        },
      ],
      ctaLabel: "Open Tickets",
      ctaPath: "/tickets",
    });
  } else if (assignedEmail) {
    await notifyUserByEmail({
      email: assignedEmail,
      subject: "You were checked in at Meda",
      title: "You are checked in",
      message: "Your ticket was checked in successfully.",
      details: [
        { label: "Place", value: updated.booking.slot.pitch.name },
        {
          label: "Time",
          value: `${updated.booking.slot.startsAt.toLocaleString()} - ${updated.booking.slot.endsAt.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`,
        },
      ],
      ctaLabel: "Open Tickets",
      ctaPath: "/tickets",
    });
  }

  return serializeTicket(updated);
}
