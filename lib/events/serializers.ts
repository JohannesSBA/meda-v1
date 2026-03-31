import { resolveEventLocation } from "@/lib/location";
import { computeSpotsLeft } from "./availability";

type SerializableEvent = {
  eventId: string;
  eventName: string;
  eventDatetime: Date;
  eventEndtime: Date;
  eventLocation: string | null;
  addressLabel?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  description?: string | null;
  pictureUrl?: string | null;
  capacity: number | null;
  priceField?: number | null;
  userId: string;
  categoryId: string;
  category?: { categoryName?: string | null } | null;
  seriesId?: string | null;
  isRecurring?: boolean;
  recurrenceKind?: string | null;
  recurrenceInterval?: number | null;
  recurrenceWeekdays?: string | null;
  recurrenceUntil?: Date | null;
  occurrenceIndex?: number | null;
  isSeriesMaster?: boolean;
  createdAt?: Date;
  updatedAt?: Date;
};

type SerializeOptions = {
  attendeeCount: number;
  reservedCount?: number;
  myTickets?: number | null;
  refundableTicketCount?: number;
  refundableAmountEtb?: number;
};

export function serializePublicEvent(
  event: SerializableEvent,
  options: SerializeOptions,
) {
  const location = resolveEventLocation(event);
  const reservedCount = options.reservedCount ?? 0;
  const spotsLeft = computeSpotsLeft(
    event.capacity,
    options.attendeeCount,
    reservedCount,
  );

  return {
    eventId: event.eventId,
    eventName: event.eventName,
    eventDatetime: event.eventDatetime.toISOString(),
    eventEndtime: event.eventEndtime.toISOString(),
    eventLocation: event.eventLocation,
    description: event.description ?? null,
    pictureUrl: event.pictureUrl ?? null,
    capacity: spotsLeft,
    capacityTotal: event.capacity,
    reservedCount,
    spotsLeft,
    priceField: event.priceField ?? null,
    userId: event.userId,
    categoryId: event.categoryId,
    categoryName: event.category?.categoryName ?? null,
    seriesId: event.seriesId ?? null,
    isRecurring: event.isRecurring ?? false,
    recurrenceKind: event.recurrenceKind ?? null,
    recurrenceInterval: event.recurrenceInterval ?? null,
    recurrenceWeekdays: event.recurrenceWeekdays ?? null,
    recurrenceUntil: event.recurrenceUntil?.toISOString() ?? null,
    occurrenceIndex: event.occurrenceIndex ?? null,
    isSeriesMaster: event.isSeriesMaster ?? false,
    createdAt: event.createdAt?.toISOString(),
    updatedAt: event.updatedAt?.toISOString(),
    attendeeCount: options.attendeeCount,
    myTickets: options.myTickets ?? null,
    heldTicketCount: options.myTickets ?? null,
    refundableTicketCount: options.refundableTicketCount ?? 0,
    refundableAmountEtb: options.refundableAmountEtb ?? 0,
    addressLabel: location.addressLabel,
    latitude: location.latitude,
    longitude: location.longitude,
  };
}

export function serializeOccurrence(
  event: Pick<
    SerializableEvent,
    "eventId" | "eventDatetime" | "eventEndtime" | "capacity" | "occurrenceIndex"
  >,
  options: SerializeOptions,
) {
  const reservedCount = options.reservedCount ?? 0;
  const spotsLeft = computeSpotsLeft(
    event.capacity,
    options.attendeeCount,
    reservedCount,
  );

  return {
    eventId: event.eventId,
    eventDatetime: event.eventDatetime.toISOString(),
    eventEndtime: event.eventEndtime.toISOString(),
    attendeeCount: options.attendeeCount,
    myTickets: options.myTickets ?? 0,
    heldTicketCount: options.myTickets ?? 0,
    refundableTicketCount: options.refundableTicketCount ?? 0,
    refundableAmountEtb: options.refundableAmountEtb ?? 0,
    capacity: spotsLeft,
    capacityTotal: event.capacity,
    reservedCount,
    spotsLeft,
    occurrenceIndex: event.occurrenceIndex ?? null,
  };
}
