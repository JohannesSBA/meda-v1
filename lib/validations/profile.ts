import { z } from "zod";
import { eventStatusSchema, uuidSchema } from "./events";

export const profileStatusQuerySchema = z.object({
  status: eventStatusSchema,
  page: z.coerce.number().int().min(1).default(1).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(10).optional(),
});

export const savedEventMutationSchema = z.object({
  eventId: uuidSchema,
});
