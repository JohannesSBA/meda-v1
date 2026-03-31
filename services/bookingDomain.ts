import { BookingStatus, TicketStatus } from "@/generated/prisma/client";

export const ACTIVE_CAPACITY_BOOKING_STATUSES = [
  BookingStatus.CONFIRMED,
  BookingStatus.COMPLETED,
] as const;

export const ASSIGNED_TICKET_STATUSES = [
  TicketStatus.ASSIGNED,
  TicketStatus.VALID,
  TicketStatus.CHECKED_IN,
] as const;

export type TicketSeed = {
  purchaserId: string;
  assignedUserId?: string | null;
  assignedName?: string | null;
  assignedEmail?: string | null;
  status: TicketStatus;
};

export function asNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function roundCurrency(value: number) {
  return Math.round(value * 100) / 100;
}

export function normalizeEmail(email?: string | null) {
  const normalized = email?.trim().toLowerCase() ?? "";
  return normalized || null;
}

export function getOutstandingAmount(args: {
  totalAmount: number;
  amountPaid: number;
}) {
  return Math.max(0, roundCurrency(args.totalAmount - args.amountPaid));
}

export function isCapacityActiveBooking(
  booking: {
    status: BookingStatus;
    expiresAt?: Date | null;
  },
  now: Date,
) {
  return (
    ACTIVE_CAPACITY_BOOKING_STATUSES.includes(
      booking.status as (typeof ACTIVE_CAPACITY_BOOKING_STATUSES)[number],
    ) ||
    (booking.status === BookingStatus.PENDING &&
      Boolean(booking.expiresAt && booking.expiresAt > now))
  );
}

export function buildReservedPitchContributionAmounts(args: {
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

export function buildDailyTicketSeeds(args: {
  quantity: number;
  purchaserId: string;
  purchaserEmail?: string | null;
  purchaserName?: string | null;
}) {
  return Array.from({ length: args.quantity }).map((_, index) => {
    const assignedToPurchaser = index === 0;
    return {
      purchaserId: args.purchaserId,
      assignedUserId: assignedToPurchaser ? args.purchaserId : null,
      assignedName: assignedToPurchaser ? args.purchaserName ?? null : null,
      assignedEmail: assignedToPurchaser ? normalizeEmail(args.purchaserEmail) : null,
      status: assignedToPurchaser ? TicketStatus.VALID : TicketStatus.ASSIGNMENT_PENDING,
    } satisfies TicketSeed;
  });
}

export function buildMonthlyTicketSeedsFromResolvedMembers(args: {
  members: Array<{
    userId: string | null;
    invitedEmail: string | null;
    knownUser?: {
      email?: string | null;
      name?: string | null;
    } | null;
  }>;
  purchaserId: string;
  reservedCapacity: number;
}) {
  const assignedSeeds = args.members.map((member) => {
    const assignedEmail = normalizeEmail(member.knownUser?.email ?? member.invitedEmail);
    const assignedUserId = member.userId ?? null;

    return {
      purchaserId: args.purchaserId,
      assignedUserId,
      assignedEmail,
      assignedName: member.knownUser?.name ?? null,
      status: assignedUserId ? TicketStatus.VALID : TicketStatus.ASSIGNED,
    } satisfies TicketSeed;
  });

  const remainingSeats = Math.max(0, args.reservedCapacity - assignedSeeds.length);
  const emptySeeds = Array.from({ length: remainingSeats }).map(
    () =>
      ({
        purchaserId: args.purchaserId,
        assignedUserId: null,
        assignedEmail: null,
        assignedName: null,
        status: TicketStatus.ASSIGNMENT_PENDING,
      }) satisfies TicketSeed,
  );

  return [...assignedSeeds, ...emptySeeds];
}
