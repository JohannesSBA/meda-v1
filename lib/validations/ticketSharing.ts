import { z } from "zod";

export const createShareLinkSchema = z.object({
  eventId: z.string().uuid(),
});

export type CreateShareLinkInput = z.infer<typeof createShareLinkSchema>;
