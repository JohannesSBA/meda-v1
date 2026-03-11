/**
 * Ticket sharing validation schemas -- Zod schema for create share link.
 */

import { z } from "zod";

export const createShareLinkSchema = z.object({
  eventId: z.string().uuid(),
});

export type CreateShareLinkInput = z.infer<typeof createShareLinkSchema>;
