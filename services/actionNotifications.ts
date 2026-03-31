import { getAppBaseUrl } from "@/lib/env";
import { getAuthUserEmails } from "@/lib/auth/userLookup";
import { logger } from "@/lib/logger";
import { sendActionNotificationEmail } from "@/services/email";

type NotificationDetail = {
  label: string;
  value: string;
};

type NotifyUserByIdArgs = {
  userId: string;
  subject: string;
  title: string;
  message: string;
  details?: NotificationDetail[];
  ctaLabel?: string;
  ctaPath?: string;
  ctaUrl?: string;
};

type NotifyUserByEmailArgs = {
  email: string;
  userName?: string | null;
  subject: string;
  title: string;
  message: string;
  details?: NotificationDetail[];
  ctaLabel?: string;
  ctaPath?: string;
  ctaUrl?: string;
};

function resolveCtaUrl(args: { ctaPath?: string; ctaUrl?: string }) {
  if (args.ctaUrl) return args.ctaUrl;
  if (!args.ctaPath) return undefined;
  return `${getAppBaseUrl()}${args.ctaPath}`;
}

export async function notifyUserById(args: NotifyUserByIdArgs) {
  const users = await getAuthUserEmails([args.userId]);
  const user = users.get(args.userId);
  if (!user?.email) {
    return false;
  }

  try {
    await sendActionNotificationEmail({
      to: user.email,
      userName: user.name,
      subject: args.subject,
      title: args.title,
      message: args.message,
      details: args.details,
      ctaLabel: args.ctaLabel,
      ctaUrl: resolveCtaUrl(args),
    });
    return true;
  } catch (error) {
    logger.error("Failed to send action notification to user", {
      error,
      userId: args.userId,
      subject: args.subject,
    });
    return false;
  }
}

export async function notifyUserByEmail(args: NotifyUserByEmailArgs) {
  const normalizedEmail = args.email.trim().toLowerCase();
  if (!normalizedEmail) {
    return false;
  }

  try {
    await sendActionNotificationEmail({
      to: normalizedEmail,
      userName: args.userName ?? null,
      subject: args.subject,
      title: args.title,
      message: args.message,
      details: args.details,
      ctaLabel: args.ctaLabel,
      ctaUrl: resolveCtaUrl(args),
    });
    return true;
  } catch (error) {
    logger.error("Failed to send action notification to email", {
      error,
      email: normalizedEmail,
      subject: args.subject,
    });
    return false;
  }
}
