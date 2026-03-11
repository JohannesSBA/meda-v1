/**
 * Refund confirmation email after refund is processed.
 *
 * Includes amount credited and new Meda balance for paid events.
 */

import { logger } from "@/lib/logger";
import { FROM_ADDRESS, getResend } from "./client";

export type RefundConfirmationParams = {
  to: string;
  userName: string | null;
  eventName: string;
  eventDateTime: Date;
  ticketCount: number;
  amountCredited: number;
  newBalance: number;
};

export async function sendRefundConfirmationEmail(
  params: RefundConfirmationParams,
): Promise<void> {
  const {
    to,
    userName,
    eventName,
    eventDateTime,
    ticketCount,
    amountCredited,
    newBalance,
  } = params;

  const from = FROM_ADDRESS;
  const subject = `Refund confirmed for ${eventName}`;
  const dateStr = new Date(eventDateTime).toLocaleString();
  const greeting = userName ? `Hi ${userName},` : "Hi,";
  const ticketLabel = ticketCount === 1 ? "1 ticket" : `${ticketCount} tickets`;
  const amountStr =
    amountCredited > 0 ? `ETB ${amountCredited.toFixed(2)}` : null;

  const text = `
${greeting}

Your refund for ${eventName} has been processed.

${ticketLabel} cancelled.
Event date: ${dateStr}
${amountStr ? `Amount credited: ${amountStr}` : ""}
${amountStr ? `Your Meda balance: ETB ${newBalance.toFixed(2)}` : ""}

Your Meda balance can be used for future event purchases.

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
  <p>Your refund for <strong>${eventName}</strong> has been processed.</p>
  <p><strong>${ticketLabel}</strong> cancelled.</p>
  <table style="border-collapse: collapse; margin: 20px 0;">
    <tr><td style="padding: 8px 12px 8px 0; color: #666;">Event date:</td><td style="padding: 8px 0;">${dateStr}</td></tr>
    ${amountStr ? `<tr><td style="padding: 8px 12px 8px 0; color: #666;">Amount credited:</td><td style="padding: 8px 0; font-weight: 600; color: #22c55e;">${amountStr}</td></tr>` : ""}
    ${amountStr ? `<tr><td style="padding: 8px 12px 8px 0; color: #666;">Your Meda balance:</td><td style="padding: 8px 0; font-weight: 600;">ETB ${newBalance.toFixed(2)}</td></tr>` : ""}
  </table>
  <p style="color: #666; font-size: 14px;">Your Meda balance can be used for future event purchases.</p>
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
    logger.error("Resend refund confirmation send failed", {
      error,
      to,
      subject,
    });
    throw new Error(`Resend send failed: ${msg}`);
  }
}
