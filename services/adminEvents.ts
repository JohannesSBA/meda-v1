import { prisma } from "@/lib/prisma";
import {
  computeSpotsLeft,
  getActiveReservationCountForEvent,
  getActiveReservationCountMap,
} from "@/lib/events/availability";
import {
  decodeEventLocation,
  prepareEventLocationFields,
  resolveEventLocation,
} from "@/lib/location";
import { promoteWaitlistForEvent } from "@/services/waitlistPromotion";

export type AdminEventPatchInput = {
  eventName?: string;
  description?: string | null;
  pictureUrl?: string | null;
  eventDatetime?: string;
  eventEndtime?: string;
  eventLocation?: string | null;
  addressLabel?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  capacity?: number | null;
  priceField?: number | null;
  categoryId?: string;
  applyToSeries?: boolean;
};

function resolvePatchedLocation(
  payload: AdminEventPatchInput,
  existing: {
    eventLocation: string | null;
    addressLabel: string | null;
    latitude: number | null;
    longitude: number | null;
  },
) {
  const hasStructuredLocationUpdate =
    payload.addressLabel !== undefined ||
    payload.latitude !== undefined ||
    payload.longitude !== undefined;

  if (hasStructuredLocationUpdate) {
    if (
      payload.addressLabel == null ||
      payload.latitude == null ||
      payload.longitude == null
    ) {
      throw new Error(
        "Location updates require address, latitude, and longitude.",
      );
    }
    return prepareEventLocationFields({
      addressLabel: payload.addressLabel,
      latitude: payload.latitude,
      longitude: payload.longitude,
    });
  }

  if (payload.eventLocation !== undefined) {
    const decoded = decodeEventLocation(payload.eventLocation);
    return {
      eventLocation: payload.eventLocation,
      addressLabel: decoded.addressLabel ?? existing.addressLabel,
      latitude: decoded.latitude ?? existing.latitude,
      longitude: decoded.longitude ?? existing.longitude,
    };
  }

  return {
    eventLocation: existing.eventLocation,
    addressLabel: existing.addressLabel,
    latitude: existing.latitude,
    longitude: existing.longitude,
  };
}

export async function getAdminEventDetail(eventId: string) {
  const event = await prisma.event.findUnique({
    where: { eventId },
    include: { _count: { select: { attendees: true } } },
  });
  if (!event) return null;

  const seriesCount =
    event.seriesId != null
      ? await prisma.event.count({ where: { seriesId: event.seriesId } })
      : 1;

  const location = resolveEventLocation(event);
  const reservedCount = await getActiveReservationCountForEvent(event.eventId);

  return {
    seriesCount,
    event: {
      ...event,
      eventDatetime: event.eventDatetime.toISOString(),
      eventEndtime: event.eventEndtime.toISOString(),
      recurrenceUntil: event.recurrenceUntil?.toISOString() ?? null,
      createdAt: event.createdAt.toISOString(),
      updatedAt: event.updatedAt.toISOString(),
      addressLabel: location.addressLabel,
      latitude: location.latitude,
      longitude: location.longitude,
      spotsLeft: computeSpotsLeft(
        event.capacity,
        event._count.attendees,
        reservedCount,
      ),
      reservedCount,
    },
  };
}

export async function updateAdminEvent(
  eventId: string,
  payload: AdminEventPatchInput,
) {
  const existing = await prisma.event.findUnique({ where: { eventId } });
  if (!existing) {
    throw new Error("Event not found");
  }

  if (payload.capacity != null) {
    const targetEventIds =
      payload.applyToSeries && existing.seriesId
        ? (
            await prisma.event.findMany({
              where: { seriesId: existing.seriesId },
              select: { eventId: true },
            })
          ).map((event) => event.eventId)
        : [eventId];

    const [attendeeCounts, reservationCounts] = await Promise.all([
      prisma.eventAttendee.groupBy({
        by: ["eventId"],
        where: { eventId: { in: targetEventIds } },
        _count: { _all: true },
      }),
      getActiveReservationCountMap(targetEventIds),
    ]);

    const attendeeCountMap = new Map(
      attendeeCounts.map((entry) => [entry.eventId, entry._count._all]),
    );
    const blockedEventId = targetEventIds.find((targetId) => {
      const occupied =
        (attendeeCountMap.get(targetId) ?? 0) +
        (reservationCounts.get(targetId) ?? 0);
      return payload.capacity! < occupied;
    });

    if (blockedEventId) {
      throw new Error(
        "Capacity cannot be lower than the number of sold or reserved tickets.",
      );
    }
  }

  const start =
    payload.eventDatetime != null
      ? new Date(payload.eventDatetime)
      : existing.eventDatetime;
  const end =
    payload.eventEndtime != null
      ? new Date(payload.eventEndtime)
      : existing.eventEndtime;

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    throw new Error("Invalid event date/time");
  }
  if (end <= start) {
    throw new Error("Event end must be after start");
  }

  const locationFields = resolvePatchedLocation(payload, existing);
  const updateData = {
    eventName: payload.eventName ?? existing.eventName,
    description: payload.description ?? existing.description,
    pictureUrl: payload.pictureUrl ?? existing.pictureUrl,
    eventDatetime: start,
    eventEndtime: end,
    eventLocation: locationFields.eventLocation,
    addressLabel: locationFields.addressLabel,
    latitude: locationFields.latitude,
    longitude: locationFields.longitude,
    capacity: payload.capacity ?? existing.capacity,
    priceField: payload.priceField ?? existing.priceField,
    categoryId: payload.categoryId ?? existing.categoryId,
    updatedAt: new Date(),
  };

  if (payload.applyToSeries && existing.seriesId) {
    const updatedMany = await prisma.event.updateMany({
      where: { seriesId: existing.seriesId },
      data: updateData,
    });

    const refreshed = await prisma.event.findUnique({ where: { eventId } });
    if (!refreshed) {
      throw new Error("Event not found after update");
    }

    if (payload.capacity != null && payload.capacity > 0) {
      const seriesEvents = await prisma.event.findMany({
        where: { seriesId: existing.seriesId },
        select: { eventId: true },
      });
      for (const seriesEvent of seriesEvents) {
        void promoteWaitlistForEvent(seriesEvent.eventId);
      }
    }

    return {
      ok: true,
      bulkUpdated: true,
      updatedCount: updatedMany.count,
      event: {
        ...refreshed,
        eventDatetime: refreshed.eventDatetime.toISOString(),
        eventEndtime: refreshed.eventEndtime.toISOString(),
        updatedAt: refreshed.updatedAt.toISOString(),
      },
    };
  }

  const updated = await prisma.event.update({
    where: { eventId },
    data: updateData,
  });

  if (payload.capacity != null && payload.capacity > 0) {
    void promoteWaitlistForEvent(eventId);
  }

  return {
    ok: true,
    event: {
      ...updated,
      eventDatetime: updated.eventDatetime.toISOString(),
      eventEndtime: updated.eventEndtime.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    },
  };
}

export async function deleteAdminEvent(eventId: string) {
  const event = await prisma.event.findUnique({ where: { eventId } });
  if (!event) {
    throw new Error("Event not found");
  }

  await prisma.event.delete({ where: { eventId } });
  return { ok: true };
}
