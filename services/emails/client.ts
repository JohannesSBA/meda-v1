/**
 * Resend email client and FROM address configuration.
 *
 * Shared by all email sending functions. Requires RESEND_API_KEY or RESEND.
 */

import { Resend } from "resend";
import { logger } from "@/lib/logger";

export const FROM_ADDRESS = (() => {
  const addr = process.env.EMAIL_FROM?.trim();
  if (!addr) {
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        "EMAIL_FROM is required in production. Set it to a verified sender address, e.g. 'Meda <hello@yourdomain.com>'",
      );
    }
    logger.warn(
      "EMAIL_FROM is not set. Falling back to Resend sandbox address — emails may not be delivered in production.",
    );
    return "Meda <onboarding@resend.dev>";
  }
  return addr;
})();

let resendClient: Resend | null = null;

export function getResend(): Resend {
  if (resendClient) return resendClient;

  const raw = process.env.RESEND_API_KEY || process.env.RESEND;
  const apiKey = typeof raw === "string" ? raw.trim() : "";
  if (!apiKey) {
    throw new Error("RESEND_API_KEY or RESEND must be set");
  }

  resendClient = new Resend(apiKey);
  return resendClient;
}
