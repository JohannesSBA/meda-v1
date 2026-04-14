export const cacheTags = {
  categories: "categories",
  landing: "landing",
  events: "events",
  slots: "slots",
  event: (eventId: string) => `event:${eventId}`,
  profile: (userId: string) => `profile:${userId}`,
  adminEvents: "admin:events",
  adminStats: "admin:stats",
} as const;
