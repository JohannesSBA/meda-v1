import { prisma } from "@/lib/prisma";
import { buildGoogleMapsUrl } from "@/lib/location";
import {
  listBookingsForUser,
  type BookingActor,
  type SerializedBooking,
} from "@/services/bookings";

type TicketHubSection = "up_next" | "needs_action" | "past";

type BookingPrimaryAction =
  | { type: "pay_share"; label: string; poolId: string }
  | { type: "add_player_names"; label: string }
  | { type: "claim_ticket"; label: string; ticketId: string }
  | { type: "open_booking"; label: string };

type EventPrimaryAction = {
  type: "open_event";
  label: string;
  href: string;
};

export type TicketHubBookingItem = {
  kind: "booking";
  id: string;
  section: TicketHubSection;
  startsAt: string;
  endsAt: string;
  title: string;
  subtitle: string;
  statusLabel: string;
  helperText: string;
  booking: SerializedBooking;
  primaryAction: BookingPrimaryAction;
  canCancel: boolean;
  purchaserCanManageTickets: boolean;
  claimableTicketIds: string[];
  canPayShare: boolean;
};

export type TicketHubEventItem = {
  kind: "event";
  id: string;
  section: TicketHubSection;
  startsAt: string;
  endsAt: string;
  title: string;
  subtitle: string;
  statusLabel: string;
  helperText: string;
  locationLabel: string | null;
  mapUrl: string | null;
  ticketCount: number;
  checkedInCount: number;
  href: string;
  primaryAction: EventPrimaryAction;
};

export type TicketHubItem = TicketHubBookingItem | TicketHubEventItem;

export type TicketsHubPayload = {
  sections: {
    needsAction: TicketHubItem[];
    upNext: TicketHubItem[];
    past: TicketHubItem[];
  };
  summary: {
    needsAction: number;
    upNext: number;
    past: number;
  };
};

type HeldEventTicketRow = {
  eventId: string;
  title: string;
  startsAt: string;
  endsAt: string;
  addressLabel: string | null;
  latitude: number | null;
  longitude: number | null;
  ticketCount: number;
  checkedInCount: number;
};

function normalizeEmail(email?: string | null) {
  const normalized = email?.trim().toLowerCase() ?? "";
  return normalized || null;
}

function formatDateRange(startsAt: string, endsAt: string) {
  const start = new Date(startsAt);
  const end = new Date(endsAt);
  const sameDay = start.toDateString() === end.toDateString();

  return sameDay
    ? `${start.toLocaleDateString()} · ${start.toLocaleTimeString([], {
        hour: "numeric",
        minute: "2-digit",
      })} - ${end.toLocaleTimeString([], {
        hour: "numeric",
        minute: "2-digit",
      })}`
    : `${start.toLocaleString()} - ${end.toLocaleString()}`;
}

function sortSection(section: TicketHubSection, items: TicketHubItem[]) {
  return [...items].sort((left, right) => {
    const leftDate = new Date(left.startsAt).getTime();
    const rightDate = new Date(right.startsAt).getTime();

    if (section === "past") {
      return rightDate - leftDate;
    }

    if (section === "needs_action" && left.kind === "booking" && right.kind === "booking") {
      const leftDeadline = left.booking.paymentPool?.expiresAt
        ? new Date(left.booking.paymentPool.expiresAt).getTime()
        : leftDate;
      const rightDeadline = right.booking.paymentPool?.expiresAt
        ? new Date(right.booking.paymentPool.expiresAt).getTime()
        : rightDate;
      return leftDeadline - rightDeadline;
    }

    return leftDate - rightDate;
  });
}

async function listHeldEventTicketsForUser(userId: string) {
  const attendees = await prisma.eventAttendee.findMany({
    where: { userId },
    include: {
      event: {
        select: {
          eventId: true,
          eventName: true,
          eventDatetime: true,
          eventEndtime: true,
          addressLabel: true,
          latitude: true,
          longitude: true,
        },
      },
      ticketScan: {
        select: {
          scanId: true,
        },
      },
    },
  });

  const grouped = new Map<string, HeldEventTicketRow>();
  for (const attendee of attendees) {
    const current = grouped.get(attendee.eventId);
    if (current) {
      current.ticketCount += 1;
      if (attendee.ticketScan) current.checkedInCount += 1;
      continue;
    }

    grouped.set(attendee.eventId, {
      eventId: attendee.eventId,
      title: attendee.event.eventName,
      startsAt: attendee.event.eventDatetime.toISOString(),
      endsAt: attendee.event.eventEndtime.toISOString(),
      addressLabel: attendee.event.addressLabel ?? null,
      latitude: attendee.event.latitude ?? null,
      longitude: attendee.event.longitude ?? null,
      ticketCount: 1,
      checkedInCount: attendee.ticketScan ? 1 : 0,
    });
  }

  return [...grouped.values()];
}

function buildBookingHubItem(actor: BookingActor, booking: SerializedBooking): TicketHubBookingItem {
  const now = Date.now();
  const actorEmail = normalizeEmail(actor.email);
  const matchingPartyMember =
    booking.party?.members.find(
      (member) =>
        member.userId === actor.userId ||
        (actorEmail ? normalizeEmail(member.invitedEmail) === actorEmail : false),
    ) ?? null;
  const isPast =
    new Date(booking.slot.endsAt).getTime() < now ||
    booking.status === "CANCELLED" ||
    booking.status === "EXPIRED" ||
    booking.status === "COMPLETED";
  const purchaserCanManageTickets = booking.tickets.some(
    (ticket) => ticket.purchaserId === actor.userId,
  );
  const claimableTicketIds = booking.tickets
    .filter((ticket) => {
      if (ticket.status !== "ASSIGNED") return false;
      return (
        ticket.assignedUserId === actor.userId ||
        (actorEmail ? normalizeEmail(ticket.assignedEmail) === actorEmail : false)
      );
    })
    .map((ticket) => ticket.id);
  const canPayShare = Boolean(
    booking.paymentPool &&
      booking.paymentPool.status === "PENDING" &&
      booking.paymentPool.contributions.some(
        (contribution) =>
          contribution.status !== "PAID" &&
          (contribution.userId === actor.userId ||
            (matchingPartyMember
              ? contribution.partyMemberId === matchingPartyMember.id
              : false)),
      ),
  );

  let section: TicketHubSection = "up_next";
  let primaryAction: BookingPrimaryAction = {
    type: "open_booking",
    label: "Open details",
  };
  let helperText = "Everything is ready for this booking.";

  if (isPast) {
    section = "past";
    primaryAction = {
      type: "open_booking",
      label:
        booking.ticketSummary.checkedIn > 0
          ? "Checked in"
          : "View summary",
    };
    helperText =
      booking.ticketSummary.checkedIn > 0
        ? `${booking.ticketSummary.checkedIn} player${booking.ticketSummary.checkedIn === 1 ? "" : "s"} checked in.`
        : "This booking is finished.";
  } else if (canPayShare && booking.paymentPool) {
    section = "needs_action";
    primaryAction = {
      type: "pay_share",
      label: "Pay your share",
      poolId: booking.paymentPool.id,
    };
    helperText = `Group payment ends ${new Date(booking.paymentPool.expiresAt).toLocaleString()}.`;
  } else if (claimableTicketIds.length > 0) {
    section = "needs_action";
    primaryAction = {
      type: "claim_ticket",
      label: "Claim ticket",
      ticketId: claimableTicketIds[0],
    };
    helperText = "This ticket was sent to you. Claim it to make it yours.";
  } else if (purchaserCanManageTickets && booking.ticketSummary.unassigned > 0) {
    section = "needs_action";
    primaryAction = {
      type: "add_player_names",
      label: "Add player names",
    };
    helperText = `${booking.ticketSummary.unassigned} seat${booking.ticketSummary.unassigned === 1 ? "" : "s"} still need a player name. Leave the email blank if the ticket is for your child or another dependent under your account.`;
  }

  return {
    kind: "booking",
    id: booking.id,
    section,
    startsAt: booking.slot.startsAt,
    endsAt: booking.slot.endsAt,
    title: booking.slot.pitchName,
    subtitle: formatDateRange(booking.slot.startsAt, booking.slot.endsAt),
    statusLabel: booking.status,
    helperText,
    booking,
    primaryAction,
    canCancel: !isPast && booking.status !== "CANCELLED",
    purchaserCanManageTickets,
    claimableTicketIds,
    canPayShare,
  };
}

function buildEventHubItem(event: HeldEventTicketRow): TicketHubEventItem {
  const isPast = new Date(event.endsAt).getTime() < Date.now();

  return {
    kind: "event",
    id: event.eventId,
    section: isPast ? "past" : "up_next",
    startsAt: event.startsAt,
    endsAt: event.endsAt,
    title: event.title,
    subtitle: formatDateRange(event.startsAt, event.endsAt),
    statusLabel: isPast
      ? event.checkedInCount > 0
        ? "Checked in"
        : "Past"
      : "Ready",
    helperText: event.addressLabel ?? "Open the match to see full details and your ticket.",
    locationLabel: event.addressLabel ?? null,
    mapUrl: buildGoogleMapsUrl({
      addressLabel: event.addressLabel,
      latitude: event.latitude,
      longitude: event.longitude,
    }),
    ticketCount: event.ticketCount,
    checkedInCount: event.checkedInCount,
    href: `/events/${event.eventId}`,
    primaryAction: {
      type: "open_event",
      label: isPast ? "View match" : "Open ticket",
      href: `/events/${event.eventId}`,
    },
  };
}

export async function getTicketsHubForUser(actor: BookingActor) {
  const [bookings, heldEvents] = await Promise.all([
    listBookingsForUser({ actor }),
    listHeldEventTicketsForUser(actor.userId),
  ]);

  const items: TicketHubItem[] = [
    ...bookings.map((booking) => buildBookingHubItem(actor, booking)),
    ...heldEvents.map((event) => buildEventHubItem(event)),
  ];

  const needsAction = sortSection(
    "needs_action",
    items.filter((item) => item.section === "needs_action"),
  );
  const upNext = sortSection(
    "up_next",
    items.filter((item) => item.section === "up_next"),
  );
  const past = sortSection(
    "past",
    items.filter((item) => item.section === "past"),
  );

  return {
    sections: {
      needsAction,
      upNext,
      past,
    },
    summary: {
      needsAction: needsAction.length,
      upNext: upNext.length,
      past: past.length,
    },
  } satisfies TicketsHubPayload;
}
