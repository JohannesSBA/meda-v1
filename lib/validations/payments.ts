/**
 * Payment validation schemas -- Zod schemas for checkout and confirm.
 */

import { z } from "zod";
import { MAX_TICKETS_PER_USER_PER_EVENT } from "@/lib/constants";

export const checkoutPaymentSchema = z.object({
  eventId: z.string().uuid(),
  quantity: z.coerce
    .number()
    .int()
    .transform((n) =>
      Math.max(1, Math.min(MAX_TICKETS_PER_USER_PER_EVENT, n)),
    )
    .default(1),
});

export const confirmPaymentSchema = z.object({
  txRef: z.string().trim().min(3),
});

export const chapaCallbackQuerySchema = z.object({
  tx_ref: z.string().trim().min(3).optional(),
  txRef: z.string().trim().min(3).optional(),
  reference: z.string().trim().min(3).optional(),
});

export const chapaCallbackPayloadSchema = z
  .object({
    tx_ref: z.string().trim().min(3).optional(),
    txRef: z.string().trim().min(3).optional(),
    reference: z.string().trim().min(3).optional(),
    data: z
      .object({
        tx_ref: z.string().trim().min(3).optional(),
        txRef: z.string().trim().min(3).optional(),
        reference: z.string().trim().min(3).optional(),
      })
      .partial()
      .optional(),
  })
  .passthrough();

export type CheckoutPaymentInput = z.infer<typeof checkoutPaymentSchema>;
export type ConfirmPaymentInput = z.infer<typeof confirmPaymentSchema>;
