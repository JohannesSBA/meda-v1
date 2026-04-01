import { z } from "zod";

export const hostReviewTagSchema = z.enum([
  "well_organized",
  "good_communication",
  "accurate_listing",
  "started_on_time",
  "friendly_host",
  "poor_organization",
  "misleading_listing",
  "started_late",
]);

export const createHostReviewSchema = z.object({
  eventId: z.string().uuid(),
  rating: z.number().int().min(1).max(5),
  tags: z.array(hostReviewTagSchema).max(8).optional().default([]),
});

export const hostReviewEligibilityParamsSchema = z.object({
  eventId: z.string().uuid(),
});

export const hostReviewHostParamsSchema = z.object({
  hostId: z.string().uuid(),
});
