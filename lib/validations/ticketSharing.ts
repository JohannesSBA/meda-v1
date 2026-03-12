/**
 * Ticket sharing validation schemas -- Zod schema for create share link.
 */

import { z } from "zod";

export const createShareLinkSchema = z.object({
  eventId: z.string().uuid(),
});

export const shareTokenParamSchema = z.object({
  token: z.string().trim().min(8).max(512),
});

export type CreateShareLinkInput = z.infer<typeof createShareLinkSchema>;
