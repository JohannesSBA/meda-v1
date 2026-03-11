/**
 * Waitlist spot available email when a ticket is freed.
 *
 * Sent to waitlisted users when a spot opens up for a sold-out event.
 */

import { logger } from "@/lib/logger";
import { FROM_ADDRESS, getResend } from "./client";

export type WaitlistSpotAvailableParams = {
  to: string;
  userName: string | null;
  eventName: string;
  eventDateTime: Date;
  locationLabel: string | null;
  eventId: string;
  baseUrl?: string;
};

export async function sendWaitlistSpotAvailableEmail(
  params: WaitlistSpotAvailableParams,
): Promise<void> {
  const {
    to,
    userName,
    eventName,
    eventDateTime,
    locationLabel,
    eventId,
    baseUrl: baseUrlParam,
  } = params;

  const baseUrl =
    baseUrlParam ?? process.env.NEXT_PUBLIC_BASE_URL ?? "https://meda.app";
  const eventUrl = `${baseUrl}/events/${eventId}`;
  const from = FROM_ADDRESS;
  const subject = `A spot opened up for ${eventName}!`;
  const dateStr = new Date(eventDateTime).toLocaleString();
  const greeting = userName ? `Hi ${userName},` : "Hi,";

  const text = `
${greeting}

Great news! A spot just opened up for ${eventName}.

Date: ${dateStr}
Location: ${locationLabel || "Location to be announced"}

Register now before it fills up: ${eventUrl}

— Meda
`.trim();

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: system-ui, -apple-system, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <p>${greeting}</p>
  <p>Great news! A spot just opened up for <strong>${eventName}</strong>.</p>
  <table style="border-collapse: collapse; margin: 20px 0;">
    <tr><td style="padding: 8px 12px 8px 0; color: #666;">Date:</td><td style="padding: 8px 0;">${dateStr}</td></tr>
    <tr><td style="padding: 8px 12px 8px 0; color: #666;">Location:</td><td style="padding: 8px 0;">${locationLabel || "Location to be announced"}</td></tr>
  </table>
  <p><a href="${eventUrl}" style="display: inline-block; padding: 12px 24px; background: #22FF88; color: #000; font-weight: 600; text-decoration: none; border-radius: 8px;">Register now</a></p>
  <p style="color: #666; font-size: 14px;">Hurry — spots fill up fast!</p>
  <p style="color: #666; font-size: 14px;">— Meda</p>
</body>
</html>
`.trim();

  const { error } = await getResend().emails.send({
    from,
    to,
    subject,
    text,
    html,
  });

  if (error) {
    const msg =
      (error as { message?: string }).message ??
      (typeof error === "object" ? JSON.stringify(error) : String(error));
    logger.error("Resend waitlist spot notification failed", {
      error,
      to,
      subject,
    });
    throw new Error(`Resend send failed: ${msg}`);
  }
}
