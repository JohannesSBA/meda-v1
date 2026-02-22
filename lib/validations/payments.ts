import { z } from "zod";

export const checkoutPaymentSchema = z.object({
  eventId: z.string().uuid(),
  quantity: z.coerce.number().int().min(1).max(20).default(1),
});

export const confirmPaymentSchema = z.object({
  txRef: z.string().trim().min(3),
});

export type CheckoutPaymentInput = z.infer<typeof checkoutPaymentSchema>;
export type ConfirmPaymentInput = z.infer<typeof confirmPaymentSchema>;
