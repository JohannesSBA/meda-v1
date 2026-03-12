/**
 * Event detail data fetching and helpers.
 *
 * buildDirectionsUrl constructs Google Maps directions URL from event location.
 */

import type { EventResponse } from "@/app/types/eventTypes";
import {
  getPublicEventDetail,
  type EventDetailResponse,
} from "@/services/publicEvents";

export type { EventDetailResponse } from "@/services/publicEvents";

export async function getEvent(
  id: string,
): Promise<EventDetailResponse | null> {
  return getPublicEventDetail(id);
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
