/** Max tickets a single user can hold for one event. */
export const MAX_TICKETS_PER_USER_PER_EVENT = 20;

/** Hours before event start after which refunds are no longer available. */
export const REFUND_CUTOFF_HOURS = 24;

/** Max series occurrences returned for an event detail page. */
export const MAX_SERIES_OCCURRENCES = 120;

/** Default map center (Addis Ababa) — [lng, lat]. */
export const DEFAULT_MAP_CENTER = { lat: 9.0301, lng: 38.7578 } as const;

/** Stable seeded fallback category for uncategorized booking and event flows. */
export const DEFAULT_SOCCER_CATEGORY_ID =
  "3c0f6fb2-4b2a-4d62-9d58-0d2f1c1f4f1b";

/** Default pitch-owner subscription plan metadata. */
export const OWNER_SUBSCRIPTION_PLAN_CODE = "pitch-owner-monthly";
export const OWNER_SUBSCRIPTION_DURATION_DAYS = 30;
export const OWNER_SUBSCRIPTION_GRACE_DAYS = 15;
export const OWNER_SUBSCRIPTION_FEE_ETB = 1500;

/** Platform revenue configuration for paid tickets and bookings. */
export const PLATFORM_COMMISSION_PERCENT = 0.05;
export const TICKET_SURCHARGE_ETB = 15;
