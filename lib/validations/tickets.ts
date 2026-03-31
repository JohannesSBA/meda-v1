import { z } from "zod";
import { uuidSchema } from "./events";

export const ticketTokenParamSchema = z.object({
  token: z.string().trim().min(8).max(512),
});

export const ticketVerificationRequestSchema = z.object({
  eventId: uuidSchema.optional(),
});
