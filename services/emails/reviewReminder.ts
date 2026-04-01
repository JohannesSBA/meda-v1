/**
 * Host review reminder email sent after event completion.
 */

import { logger } from "@/lib/logger";
import { FROM_ADDRESS, getResend } from "./client";

export type HostReviewReminderParams = {
  to: string;
  attendeeName: string | null;
  eventName: string;
  eventDateTime: Date;
  eventEndTime: Date;
  locationLabel: string | null;
  reviewUrl: string;
};

export async function sendHostReviewReminderEmail(
  params: HostReviewReminderParams,
): Promise<void> {
  const {
    to,
    attendeeName,
    eventName,
    eventDateTime,
    eventEndTime,
    locationLabel,
    reviewUrl,
  } = params;

  const from = FROM_ADDRESS;
  const subject = `How was ${eventName}? Rate the host`;
  const dateStr = new Date(eventDateTime).toLocaleString();
  const endStr = new Date(eventEndTime).toLocaleString();
  const greeting = attendeeName ? `Hi ${attendeeName},` : "Hi,";

  const text = `
${greeting}

Thanks for joining ${eventName}.

Please take a moment to rate the host and help other players book with confidence.

Date: ${dateStr}
End: ${endStr}
Location: ${locationLabel || "Location to be announced"}

Leave a review: ${reviewUrl}

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
  <p>Thanks for joining <strong>${eventName}</strong>.</p>
  <p>Please take a moment to rate the host and help other players book with confidence.</p>
  <table style="border-collapse: collapse; margin: 20px 0;">
    <tr><td style="padding: 8px 12px 8px 0; color: #666;">Date:</td><td style="padding: 8px 0;">${dateStr}</td></tr>
    <tr><td style="padding: 8px 12px 8px 0; color: #666;">End:</td><td style="padding: 8px 0;">${endStr}</td></tr>
    <tr><td style="padding: 8px 12px 8px 0; color: #666;">Location:</td><td style="padding: 8px 0;">${locationLabel || "Location to be announced"}</td></tr>
  </table>
  <p><a href="${reviewUrl}" style="color: #00E5FF; font-weight: 600;">Leave a host review</a></p>
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
    logger.error("Resend host review reminder send failed", { error, to, subject });
    throw new Error(`Resend send failed: ${msg}`);
  }
}
