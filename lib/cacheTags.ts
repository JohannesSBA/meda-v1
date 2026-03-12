export const cacheTags = {
  categories: "categories",
  landing: "landing",
  events: "events",
  event: (eventId: string) => `event:${eventId}`,
  profile: (userId: string) => `profile:${userId}`,
  adminEvents: "admin:events",
  adminStats: "admin:stats",
} as const;
