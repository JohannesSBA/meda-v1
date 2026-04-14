import {
  BookingStatus,
  PaymentPoolStatus,
  SlotStatus,
  TicketStatus,
  type ProductType,
} from "@/generated/prisma/client";
import { getAuthUserEmails } from "@/lib/auth/userLookup";
import { resolveCategoryIdWithFallback } from "@/lib/categoryDefaults";
import { logger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import { notifyUserById } from "@/services/actionNotifications";
import { requireActiveOwnerSubscription } from "@/services/subscriptions";

const ACTIVE_BOOKING_STATUSES = [BookingStatus.CONFIRMED, BookingStatus.COMPLETED];
const BOOKING_INCREMENT_MINUTES = 120;
const ASSIGNED_TICKET_STATUSES = [
  TicketStatus.ASSIGNED,
  TicketStatus.VALID,
  TicketStatus.CHECKED_IN,
] as const;

type SlotRecord = {
  id: string;
  pitchId: string;
  categoryId: string;
  startsAt: Date;
  endsAt: Date;
  capacity: number;
  price: unknown;
  currency: string;
  productType: ProductType;
  status: SlotStatus;
  requiresParty: boolean;
  notes: string | null;
  createdById: string;
  createdAt: Date;
  updatedAt: Date;
  pitch: {
    id: string;
    ownerId: string;
    name: string;
    pictureUrl: string | null;
    addressLabel: string | null;
    latitude: number | null;
    longitude: number | null;
  };
  category: {
    categoryName: string;
  };
  bookings: Array<{
    id: string;
    status: BookingStatus;
    quantity: number;
    totalAmount: unknown;
    tickets: Array<{
      status: TicketStatus;
    }>;
  }>;
};

type OwnerSlotRecord = {
  id: string;
  pitchId: string;
  categoryId: string;
  startsAt: Date;
  endsAt: Date;
  capacity: number;
  price: unknown;
  currency: string;
  productType: ProductType;
  status: SlotStatus;
  requiresParty: boolean;
  notes: string | null;
  createdById: string;
  createdAt: Date;
  updatedAt: Date;
  pitch: {
    id: string;
    ownerId: string;
    name: string;
    pictureUrl: string | null;
    addressLabel: string | null;
    latitude: number | null;
    longitude: number | null;
  };
  category: {
    categoryName: string;
  };
  bookings: Array<{
    id: string;
    userId: string | null;
    status: BookingStatus;
    quantity: number;
    totalAmount: unknown;
    createdAt: Date;
    party: {
      id: string;
      name: string | null;
    } | null;
    paymentPool: {
      id: string;
      status: PaymentPoolStatus;
      amountPaid: unknown;
      totalAmount: unknown;
      expiresAt: Date;
    } | null;
    tickets: Array<{
      status: TicketStatus;
    }>;
  }>;
};

function asNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function getMinutesSinceMidnight(date: Date) {
  return date.getUTCHours() * 60 + date.getUTCMinutes();
}

function getDurationMinutes(startsAt: Date, endsAt: Date) {
  return Math.round((endsAt.getTime() - startsAt.getTime()) / (1000 * 60));
}

function serializeSlot(slot: SlotRecord) {
  const bookingCount = slot.bookings.length;
  const soldQuantity = slot.bookings.reduce((sum, booking) => sum + booking.quantity, 0);
  const reservedQuantity = slot.bookings
    .filter((booking) =>
      booking.status === BookingStatus.PENDING ||
      ACTIVE_BOOKING_STATUSES.includes(
        booking.status as (typeof ACTIVE_BOOKING_STATUSES)[number],
      ),
    )
    .reduce((sum, booking) => sum + booking.quantity, 0);
  const revenueSummaryEtb = slot.bookings
    .filter((booking) =>
      ACTIVE_BOOKING_STATUSES.includes(
        booking.status as (typeof ACTIVE_BOOKING_STATUSES)[number],
      ),
    )
    .reduce((sum, booking) => sum + asNumber(booking.totalAmount), 0);
  const assignedTicketCount = slot.bookings.reduce(
    (sum, booking) =>
      sum +
      booking.tickets.filter((ticket) =>
        ASSIGNED_TICKET_STATUSES.includes(
          ticket.status as (typeof ASSIGNED_TICKET_STATUSES)[number],
        ),
      ).length,
    0,
  );
  const checkedInCount = slot.bookings.reduce(
    (sum, booking) =>
      sum + booking.tickets.filter((ticket) => ticket.status === TicketStatus.CHECKED_IN).length,
    0,
  );

  return {
    id: slot.id,
    pitchId: slot.pitchId,
    pitchName: slot.pitch.name,
    pitchImageUrl: slot.pitch.pictureUrl ?? null,
    addressLabel: slot.pitch.addressLabel ?? null,
    latitude: slot.pitch.latitude ?? null,
    longitude: slot.pitch.longitude ?? null,
    ownerId: slot.pitch.ownerId,
    categoryId: slot.categoryId,
    categoryName: slot.category.categoryName,
    startsAt: slot.startsAt.toISOString(),
    endsAt: slot.endsAt.toISOString(),
    capacity: slot.capacity,
    price: asNumber(slot.price),
    currency: slot.currency,
    productType: slot.productType,
    status: slot.status,
    requiresParty: slot.requiresParty,
    notes: slot.notes ?? null,
    createdById: slot.createdById,
    createdAt: slot.createdAt.toISOString(),
    updatedAt: slot.updatedAt.toISOString(),
    bookingCount,
    soldQuantity,
    assignedTicketCount,
    checkedInCount,
    remainingCapacity: Math.max(0, slot.capacity - reservedQuantity),
    utilization:
      slot.capacity > 0 ? Number((soldQuantity / slot.capacity).toFixed(4)) : 0,
    revenueSummaryEtb,
    hostAverageRating: 0,
    hostReviewCount: 0,
    hostTrustBadge: "NEW_HOST",
  };
}

async function serializeOwnerSlot(slot: OwnerSlotRecord) {
  const customerIds = [
    ...new Set(
      slot.bookings
        .map((booking) => booking.userId)
        .filter((userId): userId is string => Boolean(userId)),
    ),
  ];
  const authUsers = await getAuthUserEmails(customerIds);

  return {
    ...serializeSlot(slot),
    bookings: slot.bookings.map((booking) => {
      const authUser = booking.userId ? authUsers.get(booking.userId) ?? null : null;
      const assignedTickets = booking.tickets.filter((ticket) =>
        ASSIGNED_TICKET_STATUSES.includes(
          ticket.status as (typeof ASSIGNED_TICKET_STATUSES)[number],
        ),
      ).length;
      const checkedInTickets = booking.tickets.filter(
        (ticket) => ticket.status === TicketStatus.CHECKED_IN,
      ).length;

      return {
        id: booking.id,
        status: booking.status,
        quantity: booking.quantity,
        totalAmount: asNumber(booking.totalAmount),
        customerId: booking.userId,
        customerName:
          authUser?.name ?? authUser?.email ?? booking.party?.name ?? "Customer",
        customerEmail: authUser?.email ?? null,
        partyId: booking.party?.id ?? null,
        partyName: booking.party?.name ?? null,
        poolId: booking.paymentPool?.id ?? null,
        poolStatus: booking.paymentPool?.status ?? null,
        poolAmountPaid: booking.paymentPool ? asNumber(booking.paymentPool.amountPaid) : null,
        poolTotalAmount: booking.paymentPool ? asNumber(booking.paymentPool.totalAmount) : null,
        poolExpiresAt: booking.paymentPool?.expiresAt.toISOString() ?? null,
        soldTickets: booking.tickets.length,
        assignedTickets,
        checkedInTickets,
        createdAt: booking.createdAt.toISOString(),
      };
    }),
  };
}

async function getManagedPitch(ownerId: string, pitchId: string) {
  const pitch = await prisma.pitch.findFirst({
    where: {
      id: pitchId,
      ownerId,
    },
    include: {
      schedules: {
        where: {
          isActive: true,
        },
        orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
      },
    },
  });

  if (!pitch) {
    throw new Error("Pitch not found");
  }

  return pitch;
}

type ManagedPitch = Awaited<ReturnType<typeof getManagedPitch>>;

function assertWindowMatchesSchedule(
  pitch: ManagedPitch,
  startsAt: Date,
  endsAt: Date,
) {
  if (pitch.schedules.length === 0) {
    return;
  }

  if (
    startsAt.getUTCFullYear() !== endsAt.getUTCFullYear() ||
    startsAt.getUTCMonth() !== endsAt.getUTCMonth() ||
    startsAt.getUTCDate() !== endsAt.getUTCDate()
  ) {
    throw new Error("Slots must start and end on the same day when schedules are enforced.");
  }

  const slotDay = startsAt.getUTCDay();
  const slotStartMinutes = getMinutesSinceMidnight(startsAt);
  const slotEndMinutes = getMinutesSinceMidnight(endsAt);
  const matchesRule = pitch.schedules.some((schedule) => {
    if (schedule.dayOfWeek !== slotDay) return false;
    const scheduleStartMinutes =
      Number.parseInt(schedule.startTime.slice(0, 2), 10) * 60 +
      Number.parseInt(schedule.startTime.slice(3, 5), 10);
    const scheduleEndMinutes =
      Number.parseInt(schedule.endTime.slice(0, 2), 10) * 60 +
      Number.parseInt(schedule.endTime.slice(3, 5), 10);
    return (
      slotStartMinutes >= scheduleStartMinutes &&
      slotEndMinutes <= scheduleEndMinutes
    );
  });

  if (!matchesRule) {
    throw new Error("Slot time falls outside the pitch's active availability schedule.");
  }
}

async function validateScheduleWindow(
  ownerId: string,
  pitchId: string,
  startsAt: Date,
  endsAt: Date,
) {
  const pitch = await getManagedPitch(ownerId, pitchId);
  assertWindowMatchesSchedule(pitch, startsAt, endsAt);
  return pitch;
}

async function assertNoOverlap(args: {
  pitchId: string;
  startsAt: Date;
  endsAt: Date;
  excludeSlotId?: string;
}) {
  const overlapping = await prisma.bookableSlot.findFirst({
    where: {
      pitchId: args.pitchId,
      id: args.excludeSlotId ? { not: args.excludeSlotId } : undefined,
      status: {
        notIn: [SlotStatus.CANCELLED],
      },
      startsAt: {
        lt: args.endsAt,
      },
      endsAt: {
        gt: args.startsAt,
      },
    },
    select: { id: true },
  });

  if (overlapping) {
    throw new Error("Slot overlaps an existing booking window.");
  }
}

export async function listOwnerSlots(args: {
  ownerId: string;
  from?: Date;
  to?: Date;
  pitchId?: string;
}) {
  const slots = await prisma.bookableSlot.findMany({
    where: {
      pitch: {
        ownerId: args.ownerId,
      },
      pitchId: args.pitchId,
      startsAt: args.from ? { gte: args.from } : undefined,
      endsAt: args.to ? { lte: args.to } : undefined,
    },
    include: {
      pitch: {
        select: {
          id: true,
          ownerId: true,
          name: true,
          pictureUrl: true,
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
          userId: true,
          status: true,
          quantity: true,
          totalAmount: true,
          createdAt: true,
          party: {
            select: {
              id: true,
              name: true,
            },
          },
          paymentPool: {
            select: {
              id: true,
              status: true,
              amountPaid: true,
              totalAmount: true,
              expiresAt: true,
            },
          },
          tickets: {
            select: {
              status: true,
            },
          },
        },
        orderBy: { createdAt: "asc" },
      },
    },
    orderBy: [{ startsAt: "asc" }, { createdAt: "asc" }],
  });

  return Promise.all(slots.map((slot) => serializeOwnerSlot(slot as OwnerSlotRecord)));
}

export async function listPublicSlots(args: {
  from?: Date;
  to?: Date;
  pitchId?: string;
  /** When set, caps rows returned (e.g. landing page previews). */
  take?: number;
}) {
  const now = new Date();
  const slots = await prisma.bookableSlot.findMany({
    where: {
      pitchId: args.pitchId,
      startsAt: args.from ? { gte: args.from } : { gte: now },
      endsAt: args.to ? { lte: args.to } : undefined,
      status: {
        in: [SlotStatus.OPEN, SlotStatus.RESERVED],
      },
      pitch: {
        isActive: true,
      },
    },
    ...(args.take != null ? { take: args.take } : {}),
    include: {
      pitch: {
        select: {
          id: true,
          ownerId: true,
          name: true,
          pictureUrl: true,
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
        where: {
          OR: [
            { status: { in: [BookingStatus.CONFIRMED, BookingStatus.COMPLETED] } },
            {
              status: BookingStatus.PENDING,
              expiresAt: { gt: now },
            },
          ],
        },
        select: {
          id: true,
          status: true,
          quantity: true,
          totalAmount: true,
          tickets: {
            select: {
              status: true,
            },
          },
        },
      },
    },
    orderBy: [{ startsAt: "asc" }, { createdAt: "asc" }],
  });

  const ownerIds = [...new Set(slots.map((slot) => slot.pitch.ownerId))];
  const trustByOwner = new Map<
    string,
    { avgRating: number; reviewCount: number; trustBadge: string }
  >();
  if (ownerIds.length > 0) {
    try {
      const trustMetrics = await prisma.hostTrustMetrics.findMany({
        where: { hostId: { in: ownerIds } },
        select: {
          hostId: true,
          avgRating: true,
          reviewCount: true,
          trustBadge: true,
        },
      });
      for (const item of trustMetrics) {
        trustByOwner.set(item.hostId, {
          avgRating: Number(item.avgRating),
          reviewCount: item.reviewCount,
          trustBadge: item.trustBadge,
        });
      }
    } catch (err) {
      logger.warn("listPublicSlots: skipping host trust metrics", err);
    }
  }

  return slots.map((slot) => {
    const serialized = serializeSlot(slot as SlotRecord);
    const trust = trustByOwner.get(slot.pitch.ownerId);
    if (!trust) return serialized;
    return {
      ...serialized,
      hostAverageRating: trust.avgRating,
      hostReviewCount: trust.reviewCount,
      hostTrustBadge: trust.trustBadge,
    };
  });
}

export async function getSlotByIdForOwner(ownerId: string, slotId: string) {
  const slot = await prisma.bookableSlot.findFirst({
    where: {
      id: slotId,
      pitch: {
        ownerId,
      },
    },
    include: {
      pitch: {
        select: {
          id: true,
          ownerId: true,
          name: true,
          pictureUrl: true,
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
          userId: true,
          status: true,
          quantity: true,
          totalAmount: true,
          createdAt: true,
          party: {
            select: {
              id: true,
              name: true,
            },
          },
          paymentPool: {
            select: {
              id: true,
              status: true,
              amountPaid: true,
              totalAmount: true,
              expiresAt: true,
            },
          },
          tickets: {
            select: {
              status: true,
            },
          },
        },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!slot) {
    throw new Error("Slot not found");
  }

  return serializeOwnerSlot(slot as OwnerSlotRecord);
}

export async function getPublicSlotById(slotId: string) {
  const now = new Date();
  const slot = await prisma.bookableSlot.findFirst({
    where: {
      id: slotId,
      status: {
        in: [SlotStatus.OPEN, SlotStatus.RESERVED],
      },
      pitch: {
        isActive: true,
      },
    },
    include: {
      pitch: {
        select: {
          id: true,
          ownerId: true,
          name: true,
          pictureUrl: true,
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
        where: {
          OR: [
            { status: { in: [BookingStatus.CONFIRMED, BookingStatus.COMPLETED] } },
            {
              status: BookingStatus.PENDING,
              expiresAt: { gt: now },
            },
          ],
        },
        select: {
          id: true,
          status: true,
          quantity: true,
          totalAmount: true,
          tickets: {
            select: {
              status: true,
            },
          },
        },
      },
    },
  });

  if (!slot) {
    throw new Error("Slot not found");
  }

  const serialized = serializeSlot(slot as SlotRecord);
  const trust = await prisma.hostTrustMetrics.findUnique({
    where: { hostId: slot.pitch.ownerId },
    select: {
      avgRating: true,
      reviewCount: true,
      trustBadge: true,
    },
  });

  if (!trust) return serialized;

  return {
    ...serialized,
    hostAverageRating: Number(trust.avgRating),
    hostReviewCount: trust.reviewCount,
    hostTrustBadge: trust.trustBadge,
  };
}

export async function createSlot(args: {
  ownerId: string;
  pitchId: string;
  categoryId?: string | null;
  startsAt?: string;
  endsAt?: string;
  windows?: Array<{
    startsAt: string;
    endsAt: string;
  }>;
  capacity: number;
  price: number;
  currency: string;
  productType: ProductType;
  requiresParty?: boolean;
  status?: SlotStatus;
  notes?: string | null;
}) {
  await requireActiveOwnerSubscription(args.ownerId);

  const now = new Date();
  const requestedWindows =
    args.windows && args.windows.length > 0
      ? args.windows
      : args.startsAt && args.endsAt
        ? [{ startsAt: args.startsAt, endsAt: args.endsAt }]
        : [];

  if (requestedWindows.length === 0) {
    throw new Error("At least one booking window is required.");
  }

  const normalizedWindows = requestedWindows
    .map((window) => ({
      startsAt: new Date(window.startsAt),
      endsAt: new Date(window.endsAt),
    }))
    .sort((left, right) => left.startsAt.getTime() - right.startsAt.getTime());

  for (const window of normalizedWindows) {
    if (
      Number.isNaN(window.startsAt.getTime()) ||
      Number.isNaN(window.endsAt.getTime())
    ) {
      throw new Error("Invalid slot start or end time.");
    }
    if (window.endsAt.getTime() <= window.startsAt.getTime()) {
      throw new Error("Slot end time must be after start time.");
    }
    if (window.startsAt.getTime() <= now.getTime()) {
      throw new Error("Slot start time must be in the future.");
    }
    if (getDurationMinutes(window.startsAt, window.endsAt) !== BOOKING_INCREMENT_MINUTES) {
      throw new Error("Booking times must be created in 2-hour chunks.");
    }
  }

  for (let index = 1; index < normalizedWindows.length; index += 1) {
    if (normalizedWindows[index]!.startsAt.getTime() < normalizedWindows[index - 1]!.endsAt.getTime()) {
      throw new Error("Booking times overlap inside this request.");
    }
  }

  const pitch = await getManagedPitch(args.ownerId, args.pitchId);
  for (const window of normalizedWindows) {
    assertWindowMatchesSchedule(pitch, window.startsAt, window.endsAt);
  }

  const earliestStart = normalizedWindows[0]!.startsAt;
  const latestEnd = normalizedWindows[normalizedWindows.length - 1]!.endsAt;
  const existingWindows = await prisma.bookableSlot.findMany({
    where: {
      pitchId: args.pitchId,
      status: {
        notIn: [SlotStatus.CANCELLED],
      },
      startsAt: {
        lt: latestEnd,
      },
      endsAt: {
        gt: earliestStart,
      },
    },
    select: {
      startsAt: true,
      endsAt: true,
    },
  });

  for (const window of normalizedWindows) {
    const overlapsExisting = existingWindows.some(
      (existingWindow) =>
        existingWindow.startsAt.getTime() < window.endsAt.getTime() &&
        existingWindow.endsAt.getTime() > window.startsAt.getTime(),
    );
    if (overlapsExisting) {
      throw new Error("One or more booking times overlap an existing booking window.");
    }
  }

  const categoryId = await resolveCategoryIdWithFallback(args.categoryId);
  const created = await prisma.bookableSlot.createMany({
    data: normalizedWindows.map((window) => ({
      pitchId: pitch.id,
      categoryId,
      startsAt: window.startsAt,
      endsAt: window.endsAt,
      capacity: args.capacity,
      price: args.price,
      currency: args.currency,
      productType: args.productType,
      status: args.status ?? SlotStatus.OPEN,
      requiresParty: args.requiresParty ?? false,
      notes: args.notes ?? null,
      createdById: args.ownerId,
    })),
  });

  await notifyUserById({
    userId: args.ownerId,
    subject: "Your booking times were created",
    title: "Your booking times are live",
    message:
      created.count === 1
        ? "One new booking time is ready for players."
        : `${created.count} new booking times are ready for players.`,
    details: [
      { label: "Place", value: pitch.name },
      {
        label: "Range",
        value: `${normalizedWindows[0]!.startsAt.toLocaleString()} - ${normalizedWindows[normalizedWindows.length - 1]!.endsAt.toLocaleString()}`,
      },
    ],
    ctaLabel: "Open Host",
    ctaPath: "/host",
  });

  return {
    createdCount: created.count,
    firstStartsAt: normalizedWindows[0]!.startsAt.toISOString(),
    lastEndsAt: normalizedWindows[normalizedWindows.length - 1]!.endsAt.toISOString(),
  };
}

export async function updateSlot(args: {
  ownerId: string;
  slotId: string;
  categoryId?: string | null;
  startsAt?: string;
  endsAt?: string;
  capacity?: number;
  price?: number;
  currency?: string;
  productType?: ProductType;
  requiresParty?: boolean;
  status?: SlotStatus;
  notes?: string | null;
}) {
  await requireActiveOwnerSubscription(args.ownerId);

  const existing = await prisma.bookableSlot.findFirst({
    where: {
      id: args.slotId,
      pitch: {
        ownerId: args.ownerId,
      },
    },
    select: {
      id: true,
      pitchId: true,
      categoryId: true,
      startsAt: true,
      endsAt: true,
    },
  });

  if (!existing) {
    throw new Error("Slot not found");
  }

  const startsAt = args.startsAt ? new Date(args.startsAt) : existing.startsAt;
  const endsAt = args.endsAt ? new Date(args.endsAt) : existing.endsAt;
  if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime())) {
    throw new Error("Invalid slot start or end time.");
  }
  if (endsAt.getTime() <= startsAt.getTime()) {
    throw new Error("Slot end time must be after start time.");
  }
  if (getDurationMinutes(startsAt, endsAt) !== BOOKING_INCREMENT_MINUTES) {
    throw new Error("Booking times must stay in 2-hour chunks.");
  }

  await validateScheduleWindow(args.ownerId, existing.pitchId, startsAt, endsAt);
  await assertNoOverlap({
    pitchId: existing.pitchId,
    startsAt,
    endsAt,
    excludeSlotId: existing.id,
  });

  const categoryId =
    args.categoryId === undefined
      ? existing.categoryId
      : await resolveCategoryIdWithFallback(args.categoryId);

  const updated = await prisma.bookableSlot.update({
    where: { id: existing.id },
    data: {
      categoryId,
      startsAt,
      endsAt,
      capacity: args.capacity,
      price: args.price,
      currency: args.currency,
      productType: args.productType,
      requiresParty: args.requiresParty,
      status: args.status,
      notes: args.notes,
    },
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
      bookings: {
        select: {
          id: true,
          status: true,
          quantity: true,
          totalAmount: true,
          tickets: {
            select: {
              status: true,
            },
          },
        },
      },
    },
  });

  await notifyUserById({
    userId: args.ownerId,
    subject: "A booking time was updated",
    title: "Your booking time was updated",
    message: "We saved the latest details for this booking time.",
    details: [
      { label: "Place", value: updated.pitch.name },
      {
        label: "Time",
        value: `${updated.startsAt.toLocaleString()} - ${updated.endsAt.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`,
      },
    ],
    ctaLabel: "Open Host",
    ctaPath: "/host",
  });

  return serializeSlot(updated as SlotRecord);
}

export async function deleteSlot(args: { ownerId: string; slotId: string }) {
  await requireActiveOwnerSubscription(args.ownerId);

  const slot = await prisma.bookableSlot.findFirst({
    where: {
      id: args.slotId,
      pitch: {
        ownerId: args.ownerId,
      },
    },
    include: {
      pitch: {
        select: {
          name: true,
        },
      },
      bookings: {
        select: {
          id: true,
        },
      },
    },
  });

  if (!slot) {
    throw new Error("Slot not found");
  }

  if (slot.bookings.length > 0) {
    throw new Error("Booked slots cannot be deleted. Block or cancel the slot instead.");
  }

  await prisma.bookableSlot.delete({
    where: {
      id: slot.id,
    },
  });

  await notifyUserById({
    userId: args.ownerId,
    subject: "A booking time was removed",
    title: "Your booking time was deleted",
    message: "That booking time will no longer appear to players.",
    details: [
      { label: "Place", value: slot.pitch.name },
      {
        label: "Time",
        value: `${slot.startsAt.toLocaleString()} - ${slot.endsAt.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`,
      },
    ],
    ctaLabel: "Open Host",
    ctaPath: "/host",
  });
}
