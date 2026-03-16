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

export const payoutSettingsSchema = z.object({
  businessName: z
    .string()
    .trim()
    .max(255)
    .optional()
    .transform((value) => {
      const normalized = value?.trim() ?? "";
      return normalized || null;
    }),
  accountName: z.string().trim().min(2).max(255),
  accountNumber: z.string().trim().min(6).max(32),
  bankCode: z.string().trim().min(1).max(32),
});

export const facilitatorCreateSchema = z.object({
  email: z.string().trim().email(),
});

export const facilitatorPatchSchema = z.object({
  isActive: z.coerce.boolean(),
});
