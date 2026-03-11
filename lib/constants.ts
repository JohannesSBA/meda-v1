/** Max tickets a single user can hold for one event. */
export const MAX_TICKETS_PER_USER_PER_EVENT = 20;

/** Hours before event start after which refunds are no longer available. */
export const REFUND_CUTOFF_HOURS = 24;

/** Max series occurrences returned for an event detail page. */
export const MAX_SERIES_OCCURRENCES = 120;

/** Default map center (Addis Ababa) — [lng, lat]. */
export const DEFAULT_MAP_CENTER = { lat: 9.0301, lng: 38.7578 } as const;
