import { BookingStatus, TicketStatus } from "@/generated/prisma/client";
import { getAuthUserEmails } from "@/lib/auth/userLookup";
import { createBookingTicketShareToken, parseBookingTicketShareToken } from "@/lib/tickets/bookingShareToken";
import { prisma } from "@/lib/prisma";
import { notifyUserById } from "@/services/actionNotifications";

function normalizeBaseUrl(baseUrl: string) {
  return baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;
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

function getShareStatus(ticket: Awaited<ReturnType<typeof loadBookingTicket>>, tokenExpSeconds: number) {
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
    throw new Error("This ticket already has a player name. Remove it first if you want to share by link.");
  }
  if (ticket.booking.status === BookingStatus.CANCELLED || ticket.booking.status === BookingStatus.EXPIRED) {
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

export async function getBookingTicketShareDetails(token: string) {
  const parsed = parseBookingTicketShareToken(token);
  if (!parsed) {
    throw new Error("Share link not found");
  }

  const ticket = await loadBookingTicket(parsed.ticketId);
  if (ticket.purchaserId !== parsed.purchaserId) {
    throw new Error("Share link not found");
  }

  return {
    kind: "booking_ticket" as const,
    status: getShareStatus(ticket, parsed.exp),
    remainingClaims: getShareStatus(ticket, parsed.exp) === "Active" ? 1 : 0,
    booking: {
      ticketId: ticket.id,
      pitchName: ticket.booking.slot.pitch.name,
      startsAt: ticket.booking.slot.startsAt.toISOString(),
      endsAt: ticket.booking.slot.endsAt.toISOString(),
      addressLabel: ticket.booking.slot.pitch.addressLabel ?? null,
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
    throw new Error("You already own this ticket. For a child or dependent, keep the ticket under your own account instead of claiming it.");
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
