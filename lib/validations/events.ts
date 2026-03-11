/**
 * Event validation schemas -- Zod schemas for event create/update.
 */

import { z } from "zod";
import { MAX_TICKETS_PER_USER_PER_EVENT } from "@/lib/constants";

export const uuidSchema = z.string().regex(
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/,
  "Invalid UUID format",
);

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

export type EventRegistrationInput = z.infer<typeof eventRegistrationSchema>;
export type RefundInput = z.infer<typeof refundSchema>;
