import { FROM_ADDRESS, getResend } from "./client";
import { logger } from "@/lib/logger";

export type SubscriptionNoticeParams = {
  to: string;
  userName?: string | null;
  subject: string;
  title: string;
  message: string;
  planLabel: string;
  amountEtb: number;
  renewalDate?: Date | null;
  graceEndsAt?: Date | null;
  ctaUrl?: string;
};

function formatCurrency(value: number) {
  return `ETB ${value.toFixed(2)}`;
}

export async function sendSubscriptionNoticeEmail(
  params: SubscriptionNoticeParams,
): Promise<void> {
  const greeting = params.userName ? `Hi ${params.userName},` : "Hi,";
  const text = `
${greeting}

${params.title}

${params.message}

Plan: ${params.planLabel}
Fee: ${formatCurrency(params.amountEtb)}
${params.renewalDate ? `Renewal date: ${params.renewalDate.toLocaleDateString()}` : ""}
${params.graceEndsAt ? `Grace period ends: ${params.graceEndsAt.toLocaleDateString()}` : ""}
${params.ctaUrl ? `Open Meda: ${params.ctaUrl}` : ""}

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
  <table style="border-collapse: collapse; margin: 20px 0;">
    <tr><td style="padding: 8px 12px 8px 0; color: #666;">Plan:</td><td style="padding: 8px 0;">${params.planLabel}</td></tr>
    <tr><td style="padding: 8px 12px 8px 0; color: #666;">Fee:</td><td style="padding: 8px 0;">${formatCurrency(params.amountEtb)}</td></tr>
    ${params.renewalDate ? `<tr><td style="padding: 8px 12px 8px 0; color: #666;">Renewal date:</td><td style="padding: 8px 0;">${params.renewalDate.toLocaleDateString()}</td></tr>` : ""}
    ${params.graceEndsAt ? `<tr><td style="padding: 8px 12px 8px 0; color: #666;">Grace period ends:</td><td style="padding: 8px 0;">${params.graceEndsAt.toLocaleDateString()}</td></tr>` : ""}
  </table>
  ${params.ctaUrl ? `<p><a href="${params.ctaUrl}" style="color: #00E5FF; font-weight: 600;">Open Meda</a></p>` : ""}
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
    logger.error("Resend subscription notice send failed", {
      error,
      to: params.to,
      subject: params.subject,
    });
    throw new Error(`Resend send failed: ${msg}`);
  }
}
