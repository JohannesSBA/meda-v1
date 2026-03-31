import { resolveCategoryIdWithFallback } from "@/lib/categoryDefaults";
import { prisma } from "@/lib/prisma";
import { notifyUserById } from "@/services/actionNotifications";

function compareClockTimes(left: string, right: string) {
  return left.localeCompare(right);
}

type PitchRecord = {
  id: string;
  ownerId: string;
  name: string;
  description: string | null;
  addressLabel: string | null;
  latitude: number | null;
  longitude: number | null;
  categoryId: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  category: {
    categoryName: string;
  };
  schedules: Array<{
    isActive: boolean;
  }>;
  subscriptions: Array<{
    status: string;
  }>;
  _count: {
    slots: number;
  };
};

function serializePitch(pitch: PitchRecord) {
  const latestSubscription = pitch.subscriptions[0] ?? null;

  return {
    id: pitch.id,
    ownerId: pitch.ownerId,
    name: pitch.name,
    description: pitch.description ?? null,
    addressLabel: pitch.addressLabel ?? null,
    latitude: pitch.latitude ?? null,
    longitude: pitch.longitude ?? null,
    categoryId: pitch.categoryId,
    categoryName: pitch.category.categoryName,
    isActive: pitch.isActive,
    createdAt: pitch.createdAt.toISOString(),
    updatedAt: pitch.updatedAt.toISOString(),
    slotCount: pitch._count.slots,
    activeScheduleCount: pitch.schedules.filter((schedule) => schedule.isActive).length,
    latestSubscriptionStatus: latestSubscription?.status ?? null,
  };
}

export async function listOwnerPitches(ownerId: string) {
  const pitches = await prisma.pitch.findMany({
    where: { ownerId },
    include: {
      category: {
        select: {
          categoryName: true,
        },
      },
      schedules: {
        orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
      },
      subscriptions: {
        orderBy: [{ endsAt: "desc" }, { createdAt: "desc" }],
        take: 1,
      },
      _count: {
        select: {
          slots: true,
        },
      },
    },
    orderBy: [{ isActive: "desc" }, { name: "asc" }],
  });

  return pitches.map((pitch) => serializePitch(pitch as PitchRecord));
}

export async function getPitchByIdForOwner(ownerId: string, pitchId: string) {
  const pitch = await prisma.pitch.findFirst({
    where: {
      id: pitchId,
      ownerId,
    },
    include: {
      category: {
        select: {
          categoryName: true,
        },
      },
      schedules: {
        orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
      },
      subscriptions: {
        orderBy: [{ endsAt: "desc" }, { createdAt: "desc" }],
        take: 1,
      },
      _count: {
        select: {
          slots: true,
        },
      },
    },
  });

  if (!pitch) {
    throw new Error("Pitch not found");
  }

  return serializePitch(pitch as PitchRecord);
}

export async function createPitch(args: {
  ownerId: string;
  name: string;
  description?: string | null;
  addressLabel?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  categoryId?: string | null;
  isActive?: boolean;
}) {
  const categoryId = await resolveCategoryIdWithFallback(args.categoryId);
  const created = await prisma.pitch.create({
    data: {
      ownerId: args.ownerId,
      name: args.name.trim(),
      description: args.description ?? null,
      addressLabel: args.addressLabel ?? null,
      latitude: args.latitude ?? null,
      longitude: args.longitude ?? null,
      categoryId,
      isActive: args.isActive ?? true,
    },
    include: {
      category: {
        select: {
          categoryName: true,
        },
      },
      schedules: true,
      subscriptions: {
        orderBy: [{ endsAt: "desc" }, { createdAt: "desc" }],
        take: 1,
      },
      _count: {
        select: {
          slots: true,
        },
      },
    },
  });

  await notifyUserById({
    userId: args.ownerId,
    subject: "Your place was created in Meda",
    title: "Your place is ready",
    message: "Your place was saved and is ready for booking times.",
    details: [
      { label: "Place", value: created.name },
      { label: "Category", value: created.category.categoryName },
    ],
    ctaLabel: "Open Host",
    ctaPath: "/host",
  });

  return serializePitch(created as PitchRecord);
}

export async function updatePitch(args: {
  ownerId: string;
  pitchId: string;
  name?: string;
  description?: string | null;
  addressLabel?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  categoryId?: string | null;
  isActive?: boolean;
}) {
  const existing = await prisma.pitch.findFirst({
    where: {
      id: args.pitchId,
      ownerId: args.ownerId,
    },
    select: {
      id: true,
      categoryId: true,
    },
  });

  if (!existing) {
    throw new Error("Pitch not found");
  }

  const categoryId =
    args.categoryId === undefined
      ? existing.categoryId
      : await resolveCategoryIdWithFallback(args.categoryId);

  const updated = await prisma.pitch.update({
    where: { id: existing.id },
    data: {
      name: args.name?.trim(),
      description: args.description,
      addressLabel: args.addressLabel,
      latitude: args.latitude,
      longitude: args.longitude,
      categoryId,
      isActive: args.isActive,
    },
    include: {
      category: {
        select: {
          categoryName: true,
        },
      },
      schedules: {
        orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
      },
      subscriptions: {
        orderBy: [{ endsAt: "desc" }, { createdAt: "desc" }],
        take: 1,
      },
      _count: {
        select: {
          slots: true,
        },
      },
    },
  });

  await notifyUserById({
    userId: args.ownerId,
    subject: "Your place details were updated",
    title: "Your place was updated",
    message: "We saved your latest place details.",
    details: [
      { label: "Place", value: updated.name },
      { label: "Category", value: updated.category.categoryName },
    ],
    ctaLabel: "Open Host",
    ctaPath: "/host",
  });

  return serializePitch(updated as PitchRecord);
}

export async function createPitchSchedule(args: {
  ownerId: string;
  pitchId: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  isActive?: boolean;
}) {
  if (compareClockTimes(args.endTime, args.startTime) <= 0) {
    throw new Error("Schedule end time must be after start time");
  }

  const pitch = await prisma.pitch.findFirst({
    where: {
      id: args.pitchId,
      ownerId: args.ownerId,
    },
    select: { id: true },
  });

  if (!pitch) {
    throw new Error("Pitch not found");
  }

  const schedule = await prisma.pitchSchedule.create({
    data: {
      pitchId: pitch.id,
      dayOfWeek: args.dayOfWeek,
      startTime: args.startTime,
      endTime: args.endTime,
      isActive: args.isActive ?? true,
    },
  });

  await notifyUserById({
    userId: args.ownerId,
    subject: "Your open days were updated",
    title: "Your open day was saved",
    message: "Players can now see this place as open during the saved hours.",
    details: [
      { label: "Day", value: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][schedule.dayOfWeek] ?? String(schedule.dayOfWeek) },
      { label: "Hours", value: `${schedule.startTime} - ${schedule.endTime}` },
    ],
    ctaLabel: "Open Host",
    ctaPath: "/host",
  });

  return {
    id: schedule.id,
    pitchId: schedule.pitchId,
    dayOfWeek: schedule.dayOfWeek,
    startTime: schedule.startTime,
    endTime: schedule.endTime,
    isActive: schedule.isActive,
    createdAt: schedule.createdAt.toISOString(),
    updatedAt: schedule.updatedAt.toISOString(),
  };
}
