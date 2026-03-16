import { z } from "zod";
import { uuidSchema } from "./events";

export const adminListUsersQuerySchema = z.object({
  search: z.string().trim().max(120).default(""),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const adminEventListQuerySchema = z.object({
  search: z.string().trim().max(120).default(""),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const adminRoleUpdateSchema = z.object({
  role: z.enum(["admin", "user"]),
});

export const adminBanUpdateSchema = z.object({
  banned: z.coerce.boolean(),
  banReason: z.string().trim().max(255).optional(),
  banExpiresIn: z.coerce.number().int().positive().optional(),
});

export const adminEventCreationFeeSchema = z.object({
  amountEtb: z.coerce.number().min(0).max(100_000),
});

export const adminPromoCodeCreateSchema = z.object({
  code: z
    .string()
    .trim()
    .min(4)
    .max(32)
    .transform((value) => value.toUpperCase()),
  discountType: z.enum(["full", "partial"]),
  discountValue: z.coerce.number().min(0).max(100_000),
  pitchOwnerUserId: z
    .union([uuidSchema, z.literal(""), z.null(), z.undefined()])
    .transform((value) => (typeof value === "string" && value.trim() ? value : null)),
  maxUses: z
    .union([z.coerce.number().int().positive(), z.literal(""), z.null(), z.undefined()])
    .transform((value) => (typeof value === "number" ? value : null)),
  expiresAt: z.string().trim().min(1),
});

export const adminPromoCodePatchSchema = z.object({
  isActive: z.coerce.boolean().optional(),
  maxUses: z
    .union([z.coerce.number().int().positive(), z.literal(""), z.null(), z.undefined()])
    .transform((value) => (typeof value === "number" ? value : null))
    .optional(),
  expiresAt: z.string().trim().optional(),
});

export const adminUserIdParamSchema = z.object({
  userId: uuidSchema,
});

export const adminEventIdParamSchema = z.object({
  id: uuidSchema,
});

export const adminPromoCodeIdParamSchema = z.object({
  id: uuidSchema,
});

export const adminEventPatchJsonSchema = z.object({
  eventName: z.string().trim().min(1).optional(),
  description: z.string().trim().nullable().optional(),
  pictureUrl: z.string().trim().nullable().optional(),
  eventDatetime: z.string().trim().optional(),
  eventEndtime: z.string().trim().optional(),
  eventLocation: z.string().trim().nullable().optional(),
  addressLabel: z.string().trim().nullable().optional(),
  latitude: z.coerce.number().min(-90).max(90).nullable().optional(),
  longitude: z.coerce.number().min(-180).max(180).nullable().optional(),
  capacity: z.coerce.number().int().min(0).nullable().optional(),
  priceField: z.coerce.number().int().min(0).nullable().optional(),
  categoryId: uuidSchema.optional(),
  applyToSeries: z.coerce.boolean().optional(),
});

export const adminEventPatchFormSchema = z.object({
  eventName: z.string().trim().min(1).optional(),
  description: z
    .union([z.string(), z.null(), z.undefined()])
    .transform((value) => {
      const normalized = typeof value === "string" ? value.trim() : "";
      return normalized.length > 0 ? normalized : null;
    }),
  pictureUrl: z.string().trim().nullable().optional(),
  startDate: z.string().trim().optional(),
  endDate: z.string().trim().optional(),
  eventLocation: z.string().trim().nullable().optional(),
  location: z.string().trim().optional(),
  latitude: z.string().trim().optional(),
  longitude: z.string().trim().optional(),
  capacity: z
    .union([z.string(), z.null(), z.undefined()])
    .transform((value) => {
      const normalized = typeof value === "string" ? value.trim() : "";
      if (!normalized) return null;
      const parsed = Number.parseInt(normalized, 10);
      return Number.isNaN(parsed) ? Number.NaN : parsed;
    }),
  price: z
    .union([z.string(), z.null(), z.undefined()])
    .transform((value) => {
      const normalized = typeof value === "string" ? value.trim() : "";
      if (!normalized) return null;
      const parsed = Number.parseInt(normalized, 10);
      return Number.isNaN(parsed) ? Number.NaN : parsed;
    }),
  categoryId: uuidSchema.optional(),
  applyToSeries: z
    .union([z.string(), z.boolean(), z.undefined()])
    .transform((value) => value === true || value === "true"),
  image: z.instanceof(File).optional().nullable(),
});
