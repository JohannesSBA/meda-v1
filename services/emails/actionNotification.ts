import { FROM_ADDRESS, getResend } from "./client";
import { logger } from "@/lib/logger";

export type ActionNotificationParams = {
  to: string;
  userName?: string | null;
  subject: string;
  title: string;
  message: string;
  details?: Array<{ label: string; value: string }>;
  ctaLabel?: string;
  ctaUrl?: string;
};

export async function sendActionNotificationEmail(
  params: ActionNotificationParams,
): Promise<void> {
  const greeting = params.userName ? `Hi ${params.userName},` : "Hi,";
  const detailsText =
    params.details?.map((detail) => `${detail.label}: ${detail.value}`).join("\n") ?? "";
  const detailsHtml =
    params.details && params.details.length > 0
      ? `<table style="border-collapse: collapse; margin: 20px 0;">
          ${params.details
            .map(
              (detail) =>
                `<tr><td style="padding: 8px 12px 8px 0; color: #666;">${detail.label}:</td><td style="padding: 8px 0;">${detail.value}</td></tr>`,
            )
            .join("")}
        </table>`
      : "";

  const text = `
${greeting}

${params.title}

${params.message}
${detailsText ? `\n${detailsText}` : ""}
${params.ctaUrl ? `\n${params.ctaLabel ?? "Open Meda"}: ${params.ctaUrl}` : ""}

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
  <p style="font-size: 20px; font-weight: 700; margin: 0 0 10px;">${params.title}</p>
  <p>${params.message}</p>
  ${detailsHtml}
  ${
    params.ctaUrl
      ? `<p><a href="${params.ctaUrl}" style="color: #00E5FF; font-weight: 600;">${params.ctaLabel ?? "Open Meda"}</a></p>`
      : ""
  }
  <p style="color: #666; font-size: 14px;">— Meda</p>
</body>
</html>
`.trim();

  const { error } = await getResend().emails.send({
    from: FROM_ADDRESS,
    to: params.to,
    subject: params.subject,
    text,
    html,
  });

  if (error) {
    const msg =
      (error as { message?: string }).message ??
      (typeof error === "object" ? JSON.stringify(error) : String(error));
    logger.error("Resend action notification send failed", {
      error,
      to: params.to,
      subject: params.subject,
    });
    throw new Error(`Resend send failed: ${msg}`);
  }
}
