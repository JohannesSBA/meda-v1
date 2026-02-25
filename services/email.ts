import { Resend } from "resend";

type TicketConfirmationParams = {
  to: string;
  buyerName: string | null;
  eventName: string;
  eventDateTime: Date;
  eventEndTime: Date;
  locationLabel: string | null;
  quantity: number;
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
  } = params;

  const from =
    process.env.EMAIL_FROM?.trim() ?? "Meda <onboarding@resend.dev>";
  const subject = `Your ticket for ${eventName}`;
  const dateStr = new Date(eventDateTime).toLocaleString();
  const endStr = new Date(eventEndTime).toLocaleString();
  const greeting = buyerName ? `Hi ${buyerName},` : "Hi,";
  const ticketLabel = quantity === 1 ? "1 ticket" : `${quantity} tickets`;

  const text = `
${greeting}

You're registered for ${eventName}.

${ticketLabel} confirmed.

Date: ${dateStr}
End: ${endStr}
Location: ${locationLabel || "Location to be announced"}

All reservations are final. See you there!

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
  <p style="color: #666; font-size: 14px;">All reservations are final. See you there!</p>
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
    console.error("Resend send failed:", { error, to, subject });
    throw new Error(`Resend send failed: ${msg}`);
  }
}
