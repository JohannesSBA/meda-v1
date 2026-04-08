import { z } from "zod";
import { uuidSchema } from "@/lib/validations/events";
import { OWNER_SUBSCRIPTION_PLAN_CODE } from "@/lib/constants";

const timeOfDaySchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Invalid time");

const isoDateTimeSchema = z.string().datetime({ offset: true });

function trimNullable(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function parseNullableNumber(value: unknown) {
  if (value == null) return null;
  if (typeof value === "string" && value.trim() === "") return null;
  const nextValue = typeof value === "number" ? value : Number(value);
  return Number.isFinite(nextValue) ? nextValue : Number.NaN;
}

const nullableLatitudeSchema = z
  .union([z.number(), z.string(), z.null(), z.undefined()])
  .transform((value) => parseNullableNumber(value))
  .refine((value) => value === null || (value >= -90 && value <= 90), "Invalid latitude");

const nullableLongitudeSchema = z
  .union([z.number(), z.string(), z.null(), z.undefined()])
  .transform((value) => parseNullableNumber(value))
  .refine((value) => value === null || (value >= -180 && value <= 180), "Invalid longitude");

export const pitchIdParamSchema = z.object({
  id: uuidSchema,
});

export const slotIdParamSchema = z.object({
  id: uuidSchema,
});

export const bookingIdParamSchema = z.object({
  id: uuidSchema,
});

export const partyIdParamSchema = z.object({
  id: uuidSchema,
});

export const poolIdParamSchema = z.object({
  id: uuidSchema,
});

export const ticketIdParamSchema = z.object({
  id: uuidSchema,
});

export const subscriptionMutationSchema = z.object({
  pitchId: uuidSchema.optional(),
  planCode: z.union([z.string(), z.undefined(), z.null()]).transform((value) => {
    const normalized = trimNullable(value);
    return normalized || OWNER_SUBSCRIPTION_PLAN_CODE;
  }),
  providerRef: z.union([z.string(), z.undefined(), z.null()]).transform((value) => {
    const normalized = trimNullable(value);
    return normalized || null;
  }),
  paymentMethod: z.enum(["balance", "chapa"]).default("balance"),
});

export const subscriptionConfirmSchema = z.object({
  txRef: z.string().trim().min(3),
});

export const pitchCreateSchema = z.object({
  name: z.string().trim().min(1, "Pitch name is required").max(120),
  description: z.union([z.string(), z.undefined(), z.null()]).transform((value) => {
    const normalized = trimNullable(value);
    return normalized || null;
  }),
  pictureUrl: z.union([z.string(), z.undefined(), z.null()]).transform((value) => {
    const normalized = trimNullable(value);
    return normalized || null;
  }),
  image: z.instanceof(File).optional().nullable(),
  addressLabel: z.union([z.string(), z.undefined(), z.null()]).transform((value) => {
    const normalized = trimNullable(value);
    return normalized || null;
  }),
  latitude: nullableLatitudeSchema,
  longitude: nullableLongitudeSchema,
  categoryId: z
    .union([z.string(), z.undefined(), z.null()])
    .transform((value) => trimNullable(value)),
  isActive: z.coerce.boolean().optional().default(true),
});

export const pitchPatchSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  description: z.union([z.string(), z.undefined(), z.null()]).transform((value) => {
    if (value === undefined) return undefined;
    const normalized = trimNullable(value);
    return normalized || null;
  }),
  pictureUrl: z.union([z.string(), z.undefined(), z.null()]).transform((value) => {
    if (value === undefined) return undefined;
    const normalized = trimNullable(value);
    return normalized || null;
  }),
  image: z.instanceof(File).optional().nullable(),
  addressLabel: z.union([z.string(), z.undefined(), z.null()]).transform((value) => {
    if (value === undefined) return undefined;
    const normalized = trimNullable(value);
    return normalized || null;
  }),
  latitude: z
    .union([z.number(), z.string(), z.null(), z.undefined()])
    .transform((value) => (value === undefined ? undefined : parseNullableNumber(value)))
    .refine(
      (value) => value === undefined || value === null || (value >= -90 && value <= 90),
      "Invalid latitude",
    ),
  longitude: z
    .union([z.number(), z.string(), z.null(), z.undefined()])
    .transform((value) => (value === undefined ? undefined : parseNullableNumber(value)))
    .refine(
      (value) => value === undefined || value === null || (value >= -180 && value <= 180),
      "Invalid longitude",
    ),
  categoryId: z.union([z.string(), z.undefined(), z.null()]).transform((value) => {
    if (value === undefined) return undefined;
    return trimNullable(value);
  }),
  isActive: z.coerce.boolean().optional(),
});

export const pitchScheduleCreateSchema = z.object({
  dayOfWeek: z.coerce.number().int().min(0).max(6),
  startTime: timeOfDaySchema,
  endTime: timeOfDaySchema,
  isActive: z.coerce.boolean().optional().default(true),
});

const slotWindowSchema = z.object({
  startsAt: isoDateTimeSchema,
  endsAt: isoDateTimeSchema,
});

export const slotCreateSchema = z
  .object({
    pitchId: uuidSchema,
    categoryId: z
      .union([z.string(), z.undefined(), z.null()])
      .transform((value) => trimNullable(value)),
    startsAt: isoDateTimeSchema.optional(),
    endsAt: isoDateTimeSchema.optional(),
    windows: z.array(slotWindowSchema).min(1).max(1000).optional(),
    capacity: z.coerce.number().int().min(1).max(500),
    price: z.coerce.number().min(0).max(100000),
    currency: z.union([z.string(), z.undefined(), z.null()]).transform((value) => {
      const normalized = trimNullable(value);
      return (normalized || "ETB").toUpperCase();
    }),
    productType: z.enum(["DAILY", "MONTHLY"]),
    requiresParty: z.coerce.boolean().optional().default(false),
    status: z.enum(["OPEN", "BLOCKED"]).optional().default("OPEN"),
    notes: z.union([z.string(), z.undefined(), z.null()]).transform((value) => {
      const normalized = trimNullable(value);
      return normalized || null;
    }),
  })
  .superRefine((value, ctx) => {
    const hasSingleWindow = Boolean(value.startsAt && value.endsAt);
    const hasWindowList = Boolean(value.windows?.length);

    if (!hasSingleWindow && !hasWindowList) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Provide a booking time or at least one booking window.",
        path: ["windows"],
      });
    }

    if (value.startsAt && !value.endsAt) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Slot end time is required when slot start time is provided.",
        path: ["endsAt"],
      });
    }

    if (value.endsAt && !value.startsAt) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Slot start time is required when slot end time is provided.",
        path: ["startsAt"],
      });
    }

    if (hasSingleWindow && hasWindowList) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Send either one booking time or a list of booking windows, not both.",
        path: ["windows"],
      });
    }
  });

export const slotPatchSchema = z.object({
  categoryId: z.union([z.string(), z.undefined(), z.null()]).transform((value) => {
    if (value === undefined) return undefined;
    return trimNullable(value);
  }),
  startsAt: isoDateTimeSchema.optional(),
  endsAt: isoDateTimeSchema.optional(),
  capacity: z.coerce.number().int().min(1).max(500).optional(),
  price: z.coerce.number().min(0).max(100000).optional(),
  currency: z.union([z.string(), z.undefined(), z.null()]).transform((value) => {
    if (value === undefined) return undefined;
    const normalized = trimNullable(value);
    return (normalized || "ETB").toUpperCase();
  }),
  productType: z.enum(["DAILY", "MONTHLY"]).optional(),
  requiresParty: z.coerce.boolean().optional(),
  status: z.enum(["OPEN", "RESERVED", "BOOKED", "BLOCKED", "CANCELLED"]).optional(),
  notes: z.union([z.string(), z.undefined(), z.null()]).transform((value) => {
    if (value === undefined) return undefined;
    const normalized = trimNullable(value);
    return normalized || null;
  }),
});

export const slotListQuerySchema = z.object({
  from: isoDateTimeSchema.optional(),
  to: isoDateTimeSchema.optional(),
  pitchId: uuidSchema.optional(),
  view: z.enum(["month", "week", "day"]).optional().default("month"),
  ownerView: z
    .union([z.string(), z.undefined()])
    .transform((value) => value === "true")
    .optional()
    .default(false),
});

export const ownerCalendarQuerySchema = z.object({
  from: isoDateTimeSchema,
  to: isoDateTimeSchema,
  view: z.enum(["month", "week", "day"]).default("month"),
});

export const dailyBookingCreateSchema = z.object({
  slotId: uuidSchema,
  quantity: z.coerce.number().int().min(1).max(50).default(1),
  paymentMethod: z.enum(["balance", "chapa"]).default("chapa"),
});

export const monthlyBookingCreateSchema = z.object({
  slotId: uuidSchema,
  partyId: uuidSchema.optional(),
  partyName: z.union([z.string(), z.undefined(), z.null()]).transform((value) => {
    const normalized = trimNullable(value);
    return normalized || null;
  }),
  memberEmails: z.array(z.string().trim().email()).optional().default([]),
});

export const bookingConfirmSchema = z.object({
  txRef: z.string().trim().min(3),
});

export const partyCreateSchema = z.object({
  name: z.union([z.string(), z.undefined(), z.null()]).transform((value) => {
    const normalized = trimNullable(value);
    return normalized || null;
  }),
});

export const partyInviteSchema = z.object({
  emails: z.array(z.string().trim().email()).min(1).max(50),
});

export const partyPatchSchema = z.object({
  name: z.union([z.string(), z.undefined(), z.null()]).transform((value) => {
    if (value === undefined) return undefined;
    const normalized = trimNullable(value);
    return normalized || null;
  }),
  status: z.enum(["FORMING", "PENDING_PAYMENT", "ACTIVE", "EXPIRED", "CANCELLED"]).optional(),
});

export const poolContributeSchema = z.object({
  paymentMethod: z.enum(["balance", "chapa"]).default("balance"),
  amount: z.coerce.number().positive().optional(),
  partyMemberId: uuidSchema.optional(),
});

export const ownerDashboardQuerySchema = z.object({
  from: isoDateTimeSchema.optional(),
  to: isoDateTimeSchema.optional(),
  pitchId: uuidSchema.optional(),
  customerId: uuidSchema.optional(),
});

export const ticketAssignSchema = z
  .object({
    assignedUserId: uuidSchema.optional(),
    assignedEmail: z
      .union([z.string().trim().email(), z.undefined(), z.null()])
      .transform((value) => {
        if (value == null) return null;
        return value.trim().toLowerCase();
      }),
    assignedName: z.union([z.string(), z.undefined(), z.null()]).transform((value) => {
      const normalized = trimNullable(value);
      return normalized || null;
    }),
  })
  .superRefine((value, ctx) => {
    if (!value.assignedUserId && !value.assignedEmail && !value.assignedName) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Add a player name or email before saving this ticket.",
        path: ["assignedName"],
      });
    }
  });
