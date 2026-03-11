/**
 * Event detail data fetching and helpers.
 *
 * getEvent fetches event by ID with category, attendee count, and series occurrences.
 * buildDirectionsUrl constructs Google Maps directions URL from event location.
 */

import { prisma } from "@/lib/prisma";
import { decodeEventLocation } from "@/app/helpers/locationCodec";
import type { EventOccurrence, EventResponse } from "@/app/types/eventTypes";

export type EventDetailResponse = EventResponse & {
  occurrences?: EventOccurrence[];
};

export async function getEvent(
  id: string,
): Promise<EventDetailResponse | null> {
  const event = await prisma.event.findUnique({
    where: { eventId: id },
    include: {
      category: true,
      _count: { select: { attendees: true } },
    },
  });

  if (!event) return null;

  const decoded = decodeEventLocation(event.eventLocation);

  let occurrences: EventOccurrence[] | undefined;
  if (event.seriesId) {
    const seriesEvents = await prisma.event.findMany({
      where: {
        seriesId: event.seriesId,
        eventEndtime: { gte: new Date() },
      },
      include: { _count: { select: { attendees: true } } },
      orderBy: { eventDatetime: "asc" },
      take: 120,
    });

    occurrences = seriesEvents.map((entry) => ({
      eventId: entry.eventId,
      eventDatetime: entry.eventDatetime.toISOString(),
      eventEndtime: entry.eventEndtime.toISOString(),
      attendeeCount: entry._count.attendees,
      capacity: entry.capacity,
      myTickets: 0,
      occurrenceIndex: entry.occurrenceIndex,
    }));
  }

  return {
    eventId: event.eventId,
    eventName: event.eventName,
    eventDatetime: event.eventDatetime.toISOString(),
    eventEndtime: event.eventEndtime.toISOString(),
    eventLocation: event.eventLocation,
    description: event.description,
    pictureUrl: event.pictureUrl,
    capacity: event.capacity,
    priceField: event.priceField,
    userId: event.userId,
    categoryId: event.categoryId,
    categoryName: event.category?.categoryName ?? null,
    seriesId: event.seriesId,
    occurrenceIndex: event.occurrenceIndex,
    attendeeCount: event._count.attendees,
    addressLabel: decoded.addressLabel,
    latitude: decoded.latitude,
    longitude: decoded.longitude,
    myTickets: null,
    occurrences,
  };
}

export function buildDirectionsUrl(event: EventResponse): string {
  if (event.latitude != null && event.longitude != null) {
    return `https://www.google.com/maps/dir/?api=1&destination=${event.latitude},${event.longitude}`;
  }
  if (event.addressLabel) {
    return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(event.addressLabel)}`;
  }
  return "https://www.google.com/maps";
}
