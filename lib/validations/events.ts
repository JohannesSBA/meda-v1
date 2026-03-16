/**
 * Event validation schemas -- Zod schemas for event create/update.
 */

import { z } from "zod";
import { MAX_TICKETS_PER_USER_PER_EVENT } from "@/lib/constants";

export const uuidSchema = z.string().regex(
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/,
  "Invalid UUID format",
);

export const locationFieldsSchema = z.object({
  addressLabel: z.string().trim().min(1),
  latitude: z.coerce.number().min(-90).max(90),
  longitude: z.coerce.number().min(-180).max(180),
});

export const eventIdParamSchema = z.object({
  id: uuidSchema,
});

export const attendeeIdParamSchema = z.object({
  attendeeId: uuidSchema,
});

const recurrenceFrequencySchema = z.enum(["daily", "weekly", "custom"]);

export const createEventFormSchema = z.object({
  eventName: z.string().trim().min(1, "Event name is required"),
  categoryId: uuidSchema,
  promoCode: z
    .union([z.string(), z.null(), z.undefined()])
    .transform((value) => {
      const normalized = typeof value === "string" ? value.trim().toUpperCase() : "";
      return normalized || null;
    }),
  description: z
    .union([z.string(), z.null(), z.undefined()])
    .transform((value) => {
      const normalized = typeof value === "string" ? value.trim() : "";
      return normalized.length > 0 ? normalized : null;
    }),
  startDate: z.string().trim().min(1, "Start date is required"),
  endDate: z.string().trim().min(1, "End date is required"),
  location: z.string().trim().min(1, "Location is required"),
  latitude: z.string().trim().min(1, "Latitude is required"),
  longitude: z.string().trim().min(1, "Longitude is required"),
  capacity: z
    .union([z.string(), z.undefined(), z.null()])
    .transform((value) => {
      const normalized = typeof value === "string" ? value.trim() : "";
      if (!normalized) return null;
      const parsed = Number.parseInt(normalized, 10);
      return Number.isNaN(parsed) ? Number.NaN : parsed;
    }),
  price: z
    .union([z.string(), z.undefined(), z.null()])
    .transform((value) => {
      const normalized = typeof value === "string" ? value.trim() : "";
      if (!normalized) return null;
      const parsed = Number.parseInt(normalized, 10);
      return Number.isNaN(parsed) ? Number.NaN : parsed;
    }),
  image: z.instanceof(File).optional().nullable(),
  recurrenceEnabled: z
    .union([z.string(), z.boolean(), z.undefined()])
    .transform((value) => value === true || value === "true"),
  recurrenceFrequency: recurrenceFrequencySchema.default("weekly"),
  recurrenceInterval: z
    .union([z.string(), z.number(), z.undefined()])
    .transform((value) => {
      const parsed =
        typeof value === "number" ? value : Number.parseInt(String(value ?? "1"), 10);
      return Number.isNaN(parsed) ? 1 : Math.max(1, parsed);
    }),
  recurrenceUntil: z.string().trim().optional().default(""),
  recurrenceWeekdays: z.string().trim().optional().default(""),
});

export const eventRegistrationSchema = z.object({
  quantity: z.coerce.number().int().min(1).max(MAX_TICKETS_PER_USER_PER_EVENT).default(1),
  userId: uuidSchema,
});

export const refundSchema = z.object({
  ticketCount: z.coerce
    .number()
    .transform((v) => Math.max(1, Math.floor(v)))
    .optional(),
});

export const eventStatusSchema = z.enum(["upcoming", "past", "all"]).default("upcoming");

export const eventDetailQuerySchema = z.object({
  userId: uuidSchema.optional(),
});

export const eventListQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(50).default(8),
    search: z.string().trim().max(120).default(""),
    sort: z.enum(["date", "price"]).default("date"),
    order: z.enum(["asc", "desc"]).default("asc"),
    nearLat: z.coerce.number().min(-90).max(90).optional(),
    nearLng: z.coerce.number().min(-180).max(180).optional(),
    radiusKm: z.coerce.number().positive().max(500).default(50),
    categoryId: uuidSchema.optional(),
    hostId: uuidSchema.optional(),
    from: z.string().trim().optional(),
    to: z.string().trim().optional(),
  })
  .transform((value) => ({
    ...value,
    search: value.search.trim(),
    categoryId: value.categoryId ?? "",
    hostId: value.hostId ?? "",
  }));

export type EventRegistrationInput = z.infer<typeof eventRegistrationSchema>;
export type RefundInput = z.infer<typeof refundSchema>;
export type EventListQueryInput = z.infer<typeof eventListQuerySchema>;
