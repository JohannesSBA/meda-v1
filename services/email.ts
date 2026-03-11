import { Resend } from "resend";
import QRCode from "qrcode";
import { createVerificationToken } from "@/lib/tickets/verificationToken";

const FROM_ADDRESS = (() => {
  const addr = process.env.EMAIL_FROM?.trim();
  if (!addr) {
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        "EMAIL_FROM is required in production. Set it to a verified sender address, e.g. 'Meda <hello@yourdomain.com>'",
      );
    }
    console.warn(
      "[email] EMAIL_FROM is not set. Falling back to Resend sandbox address — emails may not be delivered in production.",
    );
    return "Meda <onboarding@resend.dev>";
  }
  return addr;
})();

type TicketConfirmationParams = {
  to: string;
  buyerName: string | null;
  eventName: string;
  eventDateTime: Date;
  eventEndTime: Date;
  locationLabel: string | null;
  quantity: number;
  eventId?: string;
  attendeeIds?: string[];
  baseUrl?: string;
};

let resendClient: Resend | null = null;

function getResend(): Resend {
  if (resendClient) return resendClient;

  const raw = process.env.RESEND_API_KEY || process.env.RESEND;
  const apiKey = typeof raw === "string" ? raw.trim() : "";
  if (!apiKey) {
    throw new Error("RESEND_API_KEY or RESEND must be set");
  }

  resendClient = new Resend(apiKey);
  return resendClient;
}

export async function sendTicketConfirmationEmail(
  params: TicketConfirmationParams,
): Promise<void> {
  const {
    to,
    buyerName,
    eventName,
    eventDateTime,
    eventEndTime,
    locationLabel,
    quantity,
    eventId,
    attendeeIds = [],
    baseUrl: baseUrlParam,
  } = params;

  const baseUrl = baseUrlParam ?? process.env.NEXT_PUBLIC_BASE_URL ?? "https://meda.app";
  const addToCalendarUrl = eventId ? `${baseUrl}/api/events/${eventId}/ics` : null;
  const viewTicketsUrl = eventId ? `${baseUrl}/events/${eventId}` : null;

  const from = FROM_ADDRESS;
  const subject = `Your ticket for ${eventName}`;
  const dateStr = new Date(eventDateTime).toLocaleString();
  const endStr = new Date(eventEndTime).toLocaleString();
  const greeting = buyerName ? `Hi ${buyerName},` : "Hi,";
  const ticketLabel = quantity === 1 ? "1 ticket" : `${quantity} tickets`;

  const attachments: Array<{
    filename: string;
    content: Buffer;
    contentType: string;
    contentId: string;
  }> = [];

  for (let i = 0; i < attendeeIds.length; i++) {
    try {
      const token = createVerificationToken(attendeeIds[i]);
      const verifyUrl = `${baseUrl}/tickets/verify/${token}`;
      const pngBuffer = await QRCode.toBuffer(verifyUrl, {
        type: "png",
        width: 256,
        margin: 2,
      });
      attachments.push({
        filename: `ticket-qr-${i + 1}.png`,
        content: Buffer.from(pngBuffer),
        contentType: "image/png",
        contentId: `qr-${i}`,
      });
    } catch (err) {
      console.error(`Failed to generate QR for attendee ${attendeeIds[i]}:`, err);
    }
  }

  const qrHtmlBlocks = attachments.map((att, i) =>
    `<div style="text-align: center; margin: 16px 0;">
      <p style="margin: 0 0 4px; font-size: 13px; color: #666;">Ticket ${i + 1}</p>
      <img src="cid:${att.contentId}" alt="Ticket QR Code ${i + 1}" width="200" height="200" style="border: 1px solid #eee; border-radius: 8px;" />
    </div>`
  ).join("\n");

  const qrSection = attachments.length > 0
    ? `<div style="margin: 24px 0; padding: 20px; background: #f9f9f9; border-radius: 12px;">
        <p style="font-weight: 600; margin: 0 0 12px; text-align: center;">Your QR ${attachments.length === 1 ? "Code" : "Codes"}</p>
        <p style="font-size: 13px; color: #666; text-align: center; margin: 0 0 16px;">Present ${attachments.length === 1 ? "this" : "these"} at the door for entry</p>
        ${qrHtmlBlocks}
      </div>`
    : (viewTicketsUrl
        ? `<p><a href="${viewTicketsUrl}" style="color: #00E5FF; font-weight: 600;">View your tickets &amp; QR codes</a></p>`
        : "");

  const text = `
${greeting}

You're registered for ${eventName}.

${ticketLabel} confirmed.

Date: ${dateStr}
End: ${endStr}
Location: ${locationLabel || "Location to be announced"}
${addToCalendarUrl ? `\nAdd to calendar: ${addToCalendarUrl}` : ""}
${viewTicketsUrl ? `\nView your tickets: ${viewTicketsUrl}` : ""}

You may request a refund up to 24 hours before the event. Refunds are credited to your Meda balance. No refunds within 24 hours of the event start.

See you there!

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
  <p>You're registered for <strong>${eventName}</strong>.</p>
  <p><strong>${ticketLabel}</strong> confirmed.</p>
  <table style="border-collapse: collapse; margin: 20px 0;">
    <tr><td style="padding: 8px 12px 8px 0; color: #666;">Date:</td><td style="padding: 8px 0;">${dateStr}</td></tr>
    <tr><td style="padding: 8px 12px 8px 0; color: #666;">End:</td><td style="padding: 8px 0;">${endStr}</td></tr>
    <tr><td style="padding: 8px 12px 8px 0; color: #666;">Location:</td><td style="padding: 8px 0;">${locationLabel || "Location to be announced"}</td></tr>
  </table>
  ${qrSection}
  ${addToCalendarUrl ? `<p><a href="${addToCalendarUrl}" style="color: #00E5FF; font-weight: 600;">Add to calendar</a></p>` : ""}
  <p style="color: #666; font-size: 14px;">You may request a refund up to 24 hours before the event. Refunds are credited to your Meda balance.</p>
  <p style="color: #666; font-size: 14px;">See you there!</p>
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
    attachments: attachments.length > 0 ? attachments : undefined,
  });

  if (error) {
    const msg =
      (error as { message?: string }).message ??
      (typeof error === "object" ? JSON.stringify(error) : String(error));
    console.error("Resend send failed:", { error, to, subject });
    throw new Error(`Resend send failed: ${msg}`);
  }
}

type EventReminderParams = {
  to: string;
  attendeeName: string | null;
  eventName: string;
  eventDateTime: Date;
  eventEndTime: Date;
  locationLabel: string | null;
  hoursUntil: number;
  eventUrl: string;
};

export async function sendEventReminderEmail(
  params: EventReminderParams,
): Promise<void> {
  const {
    to,
    attendeeName,
    eventName,
    eventDateTime,
    eventEndTime,
    locationLabel,
    hoursUntil,
    eventUrl,
  } = params;

  const from = FROM_ADDRESS;
  const subject = `Reminder: ${eventName} starts in ${hoursUntil} hour${hoursUntil === 1 ? "" : "s"}`;
  const dateStr = new Date(eventDateTime).toLocaleString();
  const endStr = new Date(eventEndTime).toLocaleString();
  const greeting = attendeeName ? `Hi ${attendeeName},` : "Hi,";

  const text = `
${greeting}

Your event ${eventName} is coming up in ${hoursUntil} hour${hoursUntil === 1 ? "" : "s"}!

Date: ${dateStr}
End: ${endStr}
Location: ${locationLabel || "Location to be announced"}

View event: ${eventUrl}

See you there!

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
  <p>Your event <strong>${eventName}</strong> is coming up in ${hoursUntil} hour${hoursUntil === 1 ? "" : "s"}!</p>
  <table style="border-collapse: collapse; margin: 20px 0;">
    <tr><td style="padding: 8px 12px 8px 0; color: #666;">Date:</td><td style="padding: 8px 0;">${dateStr}</td></tr>
    <tr><td style="padding: 8px 12px 8px 0; color: #666;">End:</td><td style="padding: 8px 0;">${endStr}</td></tr>
    <tr><td style="padding: 8px 12px 8px 0; color: #666;">Location:</td><td style="padding: 8px 0;">${locationLabel || "Location to be announced"}</td></tr>
  </table>
  <p><a href="${eventUrl}" style="color: #00E5FF; font-weight: 600;">View event details</a></p>
  <p style="color: #666; font-size: 14px;">See you there!</p>
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
    console.error("Resend reminder send failed:", { error, to, subject });
    throw new Error(`Resend send failed: ${msg}`);
  }
}

type RefundConfirmationParams = {
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
  const amountStr = amountCredited > 0 ? `ETB ${amountCredited.toFixed(2)}` : null;

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

  const { error } = await getResend().emails.send({ from, to, subject, text, html });

  if (error) {
    const msg =
      (error as { message?: string }).message ??
      (typeof error === "object" ? JSON.stringify(error) : String(error));
    console.error("Resend refund confirmation send failed:", { error, to, subject });
    throw new Error(`Resend send failed: ${msg}`);
  }
}

type WaitlistSpotAvailableParams = {
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

  const baseUrl = baseUrlParam ?? process.env.NEXT_PUBLIC_BASE_URL ?? "https://meda.app";
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

  const { error } = await getResend().emails.send({ from, to, subject, text, html });

  if (error) {
    const msg =
      (error as { message?: string }).message ??
      (typeof error === "object" ? JSON.stringify(error) : String(error));
    console.error("Resend waitlist spot notification failed:", { error, to, subject });
    throw new Error(`Resend send failed: ${msg}`);
  }
}
