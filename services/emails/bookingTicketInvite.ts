import QRCode from "qrcode";
import { createVerificationToken } from "@/lib/tickets/verificationToken";
import { getAppBaseUrl } from "@/lib/env";
import { buildGoogleMapsUrl } from "@/lib/location";
import { logger } from "@/lib/logger";
import { FROM_ADDRESS, getResend } from "./client";

export type BookingTicketInviteParams = {
  to: string;
  recipientName?: string | null;
  pitchName: string;
  addressLabel?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  startsAt: Date;
  endsAt: Date;
  bookingTypeLabel: string;
  shareAmountEtb?: number | null;
  paymentDeadline?: Date | null;
  viewTicketsUrl: string;
  qrTicketId?: string | null;
  qrEnabled?: boolean;
  note?: string | null;
  baseUrl?: string;
};

function formatCurrency(value: number) {
  return `ETB ${value.toFixed(2)}`;
}

export async function sendBookingTicketInviteEmail(
  params: BookingTicketInviteParams,
): Promise<void> {
  const greeting = params.recipientName ? `Hi ${params.recipientName},` : "Hi,";
  const startLabel = params.startsAt.toLocaleString();
  const endLabel = params.endsAt.toLocaleString();
  const shareLabel =
    params.shareAmountEtb != null && params.shareAmountEtb > 0
      ? formatCurrency(params.shareAmountEtb)
      : null;
  const deadlineLabel = params.paymentDeadline?.toLocaleString() ?? null;
  const mapUrl = buildGoogleMapsUrl({
    addressLabel: params.addressLabel,
    latitude: params.latitude,
    longitude: params.longitude,
  });
  const subject =
    shareLabel != null
      ? `You're on the list for ${params.pitchName}`
      : `Your Meda ticket for ${params.pitchName}`;

  const attachments: Array<{
    filename: string;
    content: Buffer;
    contentType: string;
    contentId: string;
  }> = [];

  if (params.qrEnabled && params.qrTicketId) {
    try {
      const token = createVerificationToken(params.qrTicketId, "booking_ticket");
      const verifyUrl = `${params.baseUrl ?? getAppBaseUrl()}/tickets/verify/${token}`;
      const pngBuffer = await QRCode.toBuffer(verifyUrl, {
        type: "png",
        width: 256,
        margin: 2,
      });
      attachments.push({
        filename: "booking-ticket-qr.png",
        content: Buffer.from(pngBuffer),
        contentType: "image/png",
        contentId: "booking-ticket-qr",
      });
    } catch (error) {
      logger.error("Failed to generate booking ticket QR email attachment", error);
    }
  }

  const text = `
${greeting}

You were added to a ${params.bookingTypeLabel.toLowerCase()} at ${params.pitchName}.

Start: ${startLabel}
End: ${endLabel}
${params.addressLabel ? `Location: ${params.addressLabel}` : ""}
${shareLabel ? `Your share: ${shareLabel}` : ""}
${deadlineLabel ? `Pay before: ${deadlineLabel}` : ""}
${mapUrl ? `Open map: ${mapUrl}` : ""}
${params.note ? `${params.note}` : ""}

Open your Meda tickets: ${params.viewTicketsUrl}

— Meda
`.trim();

  const qrSection =
    attachments.length > 0
      ? `<div style="margin: 24px 0; padding: 20px; background: #f9f9f9; border-radius: 12px;">
          <p style="font-weight: 600; margin: 0 0 12px; text-align: center;">Your ticket QR code</p>
          <p style="font-size: 13px; color: #666; text-align: center; margin: 0 0 16px;">Show this at check-in.</p>
          <div style="text-align: center;">
            <img src="cid:booking-ticket-qr" alt="Booking ticket QR code" width="200" height="200" style="border: 1px solid #eee; border-radius: 8px;" />
          </div>
        </div>`
      : "";

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: system-ui, -apple-system, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <p>${greeting}</p>
  <p>You were added to a <strong>${params.bookingTypeLabel.toLowerCase()}</strong> at <strong>${params.pitchName}</strong>.</p>
  <table style="border-collapse: collapse; margin: 20px 0;">
    <tr><td style="padding: 8px 12px 8px 0; color: #666;">Start:</td><td style="padding: 8px 0;">${startLabel}</td></tr>
    <tr><td style="padding: 8px 12px 8px 0; color: #666;">End:</td><td style="padding: 8px 0;">${endLabel}</td></tr>
    ${params.addressLabel ? `<tr><td style="padding: 8px 12px 8px 0; color: #666;">Location:</td><td style="padding: 8px 0;">${params.addressLabel}</td></tr>` : ""}
    ${shareLabel ? `<tr><td style="padding: 8px 12px 8px 0; color: #666;">Your share:</td><td style="padding: 8px 0; font-weight: 600;">${shareLabel}</td></tr>` : ""}
    ${deadlineLabel ? `<tr><td style="padding: 8px 12px 8px 0; color: #666;">Pay before:</td><td style="padding: 8px 0; font-weight: 600;">${deadlineLabel}</td></tr>` : ""}
  </table>
  ${mapUrl ? `<p><a href="${mapUrl}" style="color: #00E5FF; font-weight: 600;">Open map</a></p>` : ""}
  ${params.note ? `<p>${params.note}</p>` : ""}
  ${qrSection}
  <p><a href="${params.viewTicketsUrl}" style="color: #00E5FF; font-weight: 600;">Open your Meda tickets</a></p>
  <p style="color: #666; font-size: 14px;">— Meda</p>
</body>
</html>
`.trim();

  const { error } = await getResend().emails.send({
    from: FROM_ADDRESS,
    to: params.to,
    subject,
    text,
    html,
    attachments: attachments.length > 0 ? attachments : undefined,
  });

  if (error) {
    const msg =
      (error as { message?: string }).message ??
      (typeof error === "object" ? JSON.stringify(error) : String(error));
    logger.error("Resend booking ticket invite send failed", {
      error,
      to: params.to,
      subject,
    });
    throw new Error(`Resend send failed: ${msg}`);
  }
}
