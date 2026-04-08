import {
  BookingStatus,
  PartyMemberStatus,
  PaymentPoolStatus,
  ProductType,
  TicketStatus,
} from "@/generated/prisma/client";
import { getAuthUserEmails } from "@/lib/auth/userLookup";
import {
  createBookingPoolShareToken,
  createBookingTicketShareToken,
  parseBookingPoolShareToken,
  parseBookingTicketShareToken,
} from "@/lib/tickets/bookingShareToken";
import { prisma } from "@/lib/prisma";
import { notifyUserById } from "@/services/actionNotifications";
import { syncEditableMonthlyBookingForPartyTx } from "@/services/parties";

function normalizeBaseUrl(baseUrl: string) {
  return baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;
}

function normalizeEmail(email?: string | null) {
  const normalized = email?.trim().toLowerCase() ?? "";
  return normalized || null;
}

function asNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

async function loadBookingTicket(ticketId: string) {
  const ticket = await prisma.bookingTicket.findUnique({
    where: { id: ticketId },
    include: {
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
                },
              },
            },
          },
        },
      },
    },
  });

  if (!ticket) {
    throw new Error("Ticket not found");
  }

  return ticket;
}

async function loadPoolShareBooking(bookingId: string) {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: {
      slot: {
        include: {
          pitch: {
            select: {
              id: true,
              ownerId: true,
              name: true,
              addressLabel: true,
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
      paymentPool: {
        select: {
          id: true,
          status: true,
          amountPaid: true,
          expiresAt: true,
        },
      },
      tickets: {
        orderBy: [{ createdAt: "asc" }],
      },
    },
  });

  if (!booking) {
    throw new Error("Booking not found");
  }

  return booking;
}

function getShareStatus(
  ticket: Awaited<ReturnType<typeof loadBookingTicket>>,
  tokenExpSeconds: number,
) {
  const nowSeconds = Math.floor(Date.now() / 1000);
  const bookingEnded = ticket.booking.slot.startsAt.getTime() <= Date.now();
  const bookingUnavailable =
    ticket.booking.status === BookingStatus.CANCELLED ||
    ticket.booking.status === BookingStatus.EXPIRED ||
    ticket.booking.status === BookingStatus.COMPLETED;

  if (tokenExpSeconds <= nowSeconds || bookingEnded || bookingUnavailable) {
    return "Expired" as const;
  }

  if (
    ticket.status !== TicketStatus.ASSIGNMENT_PENDING ||
    ticket.assignedUserId ||
    ticket.assignedEmail ||
    ticket.assignedName
  ) {
    return "Claimed" as const;
  }

  return "Active" as const;
}

function countOpenPoolSeats(
  booking: Awaited<ReturnType<typeof loadPoolShareBooking>>,
) {
  return booking.tickets.filter(
    (ticket) =>
      ticket.status === TicketStatus.ASSIGNMENT_PENDING &&
      !ticket.assignedUserId &&
      !ticket.assignedEmail &&
      !ticket.assignedName,
  ).length;
}

function getPoolShareStatus(
  booking: Awaited<ReturnType<typeof loadPoolShareBooking>>,
  tokenExpSeconds: number,
) {
  const nowSeconds = Math.floor(Date.now() / 1000);
  const hasEditablePendingPool =
    booking.productType === ProductType.MONTHLY &&
    booking.status === BookingStatus.PENDING &&
    booking.paymentPool?.status === PaymentPoolStatus.PENDING &&
    asNumber(booking.paymentPool.amountPaid) === 0;
  const bookingUnavailable =
    booking.status === BookingStatus.CANCELLED ||
    booking.status === BookingStatus.EXPIRED ||
    booking.status === BookingStatus.COMPLETED ||
    booking.slot.startsAt.getTime() <= Date.now();

  if (tokenExpSeconds <= nowSeconds || bookingUnavailable || !hasEditablePendingPool) {
    return "Expired" as const;
  }

  return countOpenPoolSeats(booking) > 0 ? ("Active" as const) : ("Claimed" as const);
}

export async function createBookingTicketShareLink(args: {
  ticketId: string;
  ownerUserId: string;
  baseUrl: string;
}) {
  const ticket = await loadBookingTicket(args.ticketId);
  if (ticket.purchaserId !== args.ownerUserId) {
    throw new Error("You can only share tickets that belong to you.");
  }
  if (ticket.status === TicketStatus.CHECKED_IN) {
    throw new Error("Checked-in tickets cannot be shared.");
  }
  if (ticket.assignedUserId || ticket.assignedEmail || ticket.assignedName) {
    throw new Error(
      "This ticket already has a player name. Remove it first if you want to share by link.",
    );
  }
  if (
    ticket.booking.status === BookingStatus.CANCELLED ||
    ticket.booking.status === BookingStatus.EXPIRED
  ) {
    throw new Error("This booking is no longer active.");
  }
  if (ticket.booking.slot.startsAt.getTime() <= Date.now()) {
    throw new Error("This booking time has already started.");
  }

  const token = createBookingTicketShareToken({
    ticketId: ticket.id,
    purchaserId: ticket.purchaserId,
    expiresAt: ticket.booking.slot.startsAt,
  });

  return {
    kind: "booking_ticket" as const,
    shareUrl: `${normalizeBaseUrl(args.baseUrl)}/tickets/claim/${encodeURIComponent(token)}`,
    expiresAt: ticket.booking.slot.startsAt.toISOString(),
    booking: {
      ticketId: ticket.id,
      pitchName: ticket.booking.slot.pitch.name,
      startsAt: ticket.booking.slot.startsAt.toISOString(),
      endsAt: ticket.booking.slot.endsAt.toISOString(),
      addressLabel: ticket.booking.slot.pitch.addressLabel ?? null,
    },
  };
}

export async function createBookingPoolShareLink(args: {
  bookingId: string;
  ownerUserId: string;
  baseUrl: string;
}) {
  const booking = await loadPoolShareBooking(args.bookingId);
  if (booking.userId !== args.ownerUserId) {
    throw new Error("You can only share bookings that belong to you.");
  }
  if (!booking.party || !booking.paymentPool || booking.productType !== ProductType.MONTHLY) {
    throw new Error("This booking does not support a pool claim link.");
  }
  if (booking.status !== BookingStatus.PENDING) {
    throw new Error("This pool claim link is only available before the booking is fully paid.");
  }
  if (booking.paymentPool.status !== PaymentPoolStatus.PENDING) {
    throw new Error("This payment pool is no longer accepting claims.");
  }
  if (asNumber(booking.paymentPool.amountPaid) > 0) {
    throw new Error("New claims are locked after group payments start.");
  }

  const remainingClaims = countOpenPoolSeats(booking);
  if (remainingClaims <= 0) {
    throw new Error("No open group spots remain on this booking.");
  }

  const token = createBookingPoolShareToken({
    bookingId: booking.id,
    purchaserId: args.ownerUserId,
    expiresAt: booking.paymentPool.expiresAt,
  });

  return {
    kind: "booking_pool" as const,
    shareUrl: `${normalizeBaseUrl(args.baseUrl)}/tickets/claim/${encodeURIComponent(token)}`,
    expiresAt: booking.paymentPool.expiresAt.toISOString(),
    remainingClaims,
    booking: {
      bookingId: booking.id,
      pitchName: booking.slot.pitch.name,
      startsAt: booking.slot.startsAt.toISOString(),
      endsAt: booking.slot.endsAt.toISOString(),
      addressLabel: booking.slot.pitch.addressLabel ?? null,
    },
  };
}

export async function getBookingTicketShareDetails(token: string) {
  const parsed = parseBookingTicketShareToken(token);
  if (!parsed) {
    throw new Error("Share link not found");
  }

  const ticket = await loadBookingTicket(parsed.ticketId);
  if (ticket.purchaserId !== parsed.purchaserId) {
    throw new Error("Share link not found");
  }

  const status = getShareStatus(ticket, parsed.exp);

  return {
    kind: "booking_ticket" as const,
    status,
    remainingClaims: status === "Active" ? 1 : 0,
    booking: {
      ticketId: ticket.id,
      pitchName: ticket.booking.slot.pitch.name,
      startsAt: ticket.booking.slot.startsAt.toISOString(),
      endsAt: ticket.booking.slot.endsAt.toISOString(),
      addressLabel: ticket.booking.slot.pitch.addressLabel ?? null,
    },
  };
}

export async function getBookingPoolShareDetails(token: string) {
  const parsed = parseBookingPoolShareToken(token);
  if (!parsed) {
    throw new Error("Share link not found");
  }

  const booking = await loadPoolShareBooking(parsed.bookingId);
  if (booking.userId !== parsed.purchaserId) {
    throw new Error("Share link not found");
  }

  const status = getPoolShareStatus(booking, parsed.exp);
  return {
    kind: "booking_pool" as const,
    status,
    remainingClaims: status === "Active" ? countOpenPoolSeats(booking) : 0,
    booking: {
      bookingId: booking.id,
      pitchName: booking.slot.pitch.name,
      startsAt: booking.slot.startsAt.toISOString(),
      endsAt: booking.slot.endsAt.toISOString(),
      addressLabel: booking.slot.pitch.addressLabel ?? null,
    },
  };
}

export async function claimBookingTicketShareLink(args: {
  token: string;
  claimantUserId: string;
}) {
  const parsed = parseBookingTicketShareToken(args.token);
  if (!parsed) {
    throw new Error("Share link not found");
  }
  if (parsed.purchaserId === args.claimantUserId) {
    throw new Error(
      "You already own this ticket. For a child or dependent, keep the ticket under your own account instead of claiming it.",
    );
  }

  const ticket = await loadBookingTicket(parsed.ticketId);
  if (ticket.purchaserId !== parsed.purchaserId) {
    throw new Error("Share link not found");
  }
  if (getShareStatus(ticket, parsed.exp) !== "Active") {
    throw new Error("This share link is no longer active.");
  }

  const authUsers = await getAuthUserEmails([args.claimantUserId]);
  const claimant = authUsers.get(args.claimantUserId) ?? null;
  const assignedName = claimant?.name ?? claimant?.email?.split("@")[0] ?? "Meda player";
  const assignedEmail = claimant?.email ?? null;

  const updated = await prisma.bookingTicket.updateMany({
    where: {
      id: ticket.id,
      purchaserId: parsed.purchaserId,
      status: TicketStatus.ASSIGNMENT_PENDING,
      assignedUserId: null,
      assignedEmail: null,
      assignedName: null,
    },
    data: {
      assignedUserId: args.claimantUserId,
      assignedEmail,
      assignedName,
      status: TicketStatus.VALID,
    },
  });

  if (updated.count === 0) {
    throw new Error("That ticket was already claimed. Please ask the sender for a new link.");
  }

  await notifyUserById({
    userId: args.claimantUserId,
    subject: "A booking ticket was claimed",
    title: "Ticket claimed",
    message: "This ticket is now under your Meda account.",
    details: [
      { label: "Place", value: ticket.booking.slot.pitch.name },
      {
        label: "Time",
        value: `${ticket.booking.slot.startsAt.toLocaleString()} - ${ticket.booking.slot.endsAt.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`,
      },
    ],
    ctaLabel: "Open Tickets",
    ctaPath: "/tickets",
  });

  await notifyUserById({
    userId: ticket.purchaserId,
    subject: "A booking ticket was claimed from your link",
    title: "Ticket claimed",
    message: "Someone used your claim link and the ticket is no longer waiting for a player name.",
    details: [
      { label: "Place", value: ticket.booking.slot.pitch.name },
      {
        label: "Time",
        value: `${ticket.booking.slot.startsAt.toLocaleString()} - ${ticket.booking.slot.endsAt.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`,
      },
      { label: "Claimed by", value: assignedEmail ?? assignedName },
    ],
    ctaLabel: "Open Tickets",
    ctaPath: "/tickets",
  });

  return {
    kind: "booking_ticket" as const,
    redirectPath: "/tickets",
  };
}

export async function claimBookingPoolShareLink(args: {
  token: string;
  claimantUserId: string;
  claimantEmail?: string | null;
}) {
  const parsed = parseBookingPoolShareToken(args.token);
  if (!parsed) {
    throw new Error("Share link not found");
  }
  if (parsed.purchaserId === args.claimantUserId) {
    throw new Error(
      "You already own this booking. For a child or dependent, keep the open seat under your own account instead of claiming it.",
    );
  }

  const normalizedClaimantEmail = normalizeEmail(args.claimantEmail);
  const bookingSummary = await prisma.$transaction(async (tx) => {
    const booking = await tx.booking.findUnique({
      where: { id: parsed.bookingId },
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
          },
        },
        party: {
          include: {
            members: {
              orderBy: [{ createdAt: "asc" }],
            },
          },
        },
        paymentPool: {
          select: {
            id: true,
            status: true,
            amountPaid: true,
            expiresAt: true,
          },
        },
        tickets: {
          orderBy: [{ createdAt: "asc" }],
        },
      },
    });

    if (!booking || !booking.userId || booking.userId !== parsed.purchaserId) {
      throw new Error("Share link not found");
    }
    if (!booking.party || !booking.paymentPool || booking.productType !== ProductType.MONTHLY) {
      throw new Error("This share link is no longer active.");
    }
    if (getPoolShareStatus(booking, parsed.exp) !== "Active") {
      throw new Error("This share link is no longer active.");
    }

    const alreadyJoined =
      booking.party.members.some(
        (member) =>
          member.status !== PartyMemberStatus.REMOVED &&
          (member.userId === args.claimantUserId ||
            (normalizedClaimantEmail &&
              normalizeEmail(member.invitedEmail) === normalizedClaimantEmail)),
      ) ||
      booking.tickets.some(
        (ticket) =>
          ticket.assignedUserId === args.claimantUserId ||
          (normalizedClaimantEmail &&
            normalizeEmail(ticket.assignedEmail) === normalizedClaimantEmail),
      );

    if (alreadyJoined) {
      throw new Error("You already joined this group.");
    }

    const nextOpenSeat = booking.tickets.find(
      (ticket) =>
        ticket.status === TicketStatus.ASSIGNMENT_PENDING &&
        !ticket.assignedUserId &&
        !ticket.assignedEmail &&
        !ticket.assignedName,
    );

    if (!nextOpenSeat) {
      throw new Error("No open group spots remain on this booking.");
    }

    await tx.partyMember.create({
      data: {
        partyId: booking.party.id,
        userId: args.claimantUserId,
        invitedEmail: normalizedClaimantEmail,
        status: PartyMemberStatus.JOINED,
        joinedAt: new Date(),
      },
    });

    await syncEditableMonthlyBookingForPartyTx({
      tx,
      partyId: booking.party.id,
    });

    return {
      purchaserId: booking.userId,
      pitchName: booking.slot.pitch.name,
      startsAt: booking.slot.startsAt,
      endsAt: booking.slot.endsAt,
    };
  });

  const authUsers = await getAuthUserEmails([args.claimantUserId]);
  const claimant = authUsers.get(args.claimantUserId) ?? null;
  const claimantLabel =
    claimant?.name ?? claimant?.email ?? normalizedClaimantEmail ?? "Meda player";

  await notifyUserById({
    userId: args.claimantUserId,
    subject: "You joined a group booking",
    title: "Group spot claimed",
    message: "You now have a spot in this group booking and can finish your share in Tickets.",
    details: [
      { label: "Place", value: bookingSummary.pitchName },
      {
        label: "Time",
        value: `${bookingSummary.startsAt.toLocaleString()} - ${bookingSummary.endsAt.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`,
      },
    ],
    ctaLabel: "Open Tickets",
    ctaPath: "/tickets",
  });

  await notifyUserById({
    userId: bookingSummary.purchaserId,
    subject: "Someone joined your group from the claim link",
    title: "Group spot claimed",
    message: "A new player claimed one open spot in your group booking.",
    details: [
      { label: "Place", value: bookingSummary.pitchName },
      {
        label: "Time",
        value: `${bookingSummary.startsAt.toLocaleString()} - ${bookingSummary.endsAt.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`,
      },
      { label: "Claimed by", value: claimantLabel },
    ],
    ctaLabel: "Open Tickets",
    ctaPath: "/tickets",
  });

  return {
    kind: "booking_pool" as const,
    redirectPath: "/tickets",
  };
}
