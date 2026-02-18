import { z } from "zod";

export const EventSchema = z.object({
  eventId: z.string(),
  eventName: z.string(),
  eventDatetime: z.string(),
  eventEndtime: z.string(),
  eventLocation: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  pictureUrl: z.string().nullable().optional(),
  capacity: z.number().nullable().optional(),
  priceField: z.number().nullable().optional(),
  userId: z.string(),
  categoryId: z.string(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
  attendeeCount: z.number().int().nonnegative().nullable().optional(),
  // derived
  addressLabel: z.string().nullable().optional(),
  latitude: z.number().nullable().optional(),
  longitude: z.number().nullable().optional(),
});

export type EventResponse = z.infer<typeof EventSchema>;

export const EventListSchema = z.object({
  items: z.array(EventSchema),
  total: z.number().int().nonnegative(),
  offset: z.number().int().nonnegative(),
  limit: z.number().int().positive(),
});

export type EventListResponse = z.infer<typeof EventListSchema>;

export const EventCreatePayloadSchema = z.object({
  eventName: z.string().min(1),
  eventDatetime: z.string().min(1),
  eventEndtime: z.string().min(1),
  eventLocation: z.string().min(1),
  description: z.string().nullable().optional(),
  pictureUrl: z.string().nullable().optional(),
  capacity: z.number().int().positive().nullable().optional(),
  priceField: z.number().int().nonnegative().nullable().optional(),
  userId: z.string(),
  categoryId: z.string(),
});

export type EventCreatePayload = z.infer<typeof EventCreatePayloadSchema>;
