/**
 * Payment validation schemas -- Zod schemas for checkout and confirm.
 */

import { z } from "zod";

export const checkoutPaymentSchema = z.object({
  eventId: z.string().uuid(),
  quantity: z.coerce
    .number()
    .int()
    .transform((n) => Math.max(1, Math.min(20, n)))
    .default(1),
});

export const confirmPaymentSchema = z.object({
  txRef: z.string().trim().min(3),
});

export type CheckoutPaymentInput = z.infer<typeof checkoutPaymentSchema>;
export type ConfirmPaymentInput = z.infer<typeof confirmPaymentSchema>;
