import {
  PartyMemberStatus,
  Prisma,
  TicketStatus,
} from "@/generated/prisma/client";
import { getAuthUserEmails } from "@/lib/auth/userLookup";
import { prisma } from "@/lib/prisma";
import {
  notifyUserByEmail,
  notifyUserById,
} from "@/services/actionNotifications";

export const bookingNotificationInclude = {
  slot: {
    include: {
      pitch: {
        select: {
          id: true,
          ownerId: true,
          name: true,
          addressLabel: true,
          latitude: true,
          longitude: true,
        },
      },
    },
  },
  party: {
    include: {
      members: {
        orderBy: [{ createdAt: "asc" }],
      },
    },
  },
  tickets: {
    orderBy: [{ createdAt: "asc" }],
  },
} satisfies Prisma.BookingInclude;

export type BookingNotificationRecord = Prisma.BookingGetPayload<{
  include: typeof bookingNotificationInclude;
}>;

export type BookingNotificationRecipient = {
  key: string;
  userId?: string;
  email?: string;
  userName?: string | null;
};

function normalizeEmail(email?: string | null) {
  const normalized = email?.trim().toLowerCase() ?? "";
  return normalized || null;
}

export async function loadBookingNotificationRecord(bookingId: string) {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: bookingNotificationInclude,
  });

  if (!booking) {
    throw new Error("Booking not found");
  }

  return booking;
}

export async function listBookingNotificationRecipients(
  booking: BookingNotificationRecord,
) {
  const userIds = new Set<string>();
  const emailCandidates: Array<{ email: string; userName?: string | null }> = [];

  if (booking.userId) {
    userIds.add(booking.userId);
  }

  for (const member of booking.party?.members ?? []) {
    if (
      member.status === PartyMemberStatus.REMOVED ||
      member.status === PartyMemberStatus.EXPIRED
    ) {
      continue;
    }

    if (member.userId) {
      userIds.add(member.userId);
      continue;
    }

    const invitedEmail = normalizeEmail(member.invitedEmail);
    if (invitedEmail) {
      emailCandidates.push({ email: invitedEmail });
    }
  }

  for (const ticket of booking.tickets) {
    if (ticket.status === TicketStatus.CANCELLED) {
      continue;
    }

    if (ticket.assignedUserId) {
      userIds.add(ticket.assignedUserId);
      continue;
    }

    const assignedEmail = normalizeEmail(ticket.assignedEmail);
    if (assignedEmail) {
      emailCandidates.push({
        email: assignedEmail,
        userName: ticket.assignedName ?? null,
      });
    }
  }

  const authUsers = userIds.size
    ? await getAuthUserEmails([...userIds])
    : new Map<string, { email?: string | null; name?: string | null }>();
  const recipients: BookingNotificationRecipient[] = [];
  const coveredEmails = new Set<string>();

  for (const userId of userIds) {
    const authUser = authUsers.get(userId);
    const email = normalizeEmail(authUser?.email);
    if (email) {
      coveredEmails.add(email);
    }

    recipients.push({
      key: `user:${userId}`,
      userId,
      email: email ?? undefined,
      userName: authUser?.name ?? null,
    });
  }

  const seenEmails = new Set<string>();

  for (const candidate of emailCandidates) {
    const email = normalizeEmail(candidate.email);
    if (!email || coveredEmails.has(email) || seenEmails.has(email)) {
      continue;
    }

    seenEmails.add(email);
    recipients.push({
      key: `email:${email}`,
      email,
      userName: candidate.userName ?? null,
    });
  }

  return recipients;
}

type NotifyBookingRecipientsArgs = {
  booking: BookingNotificationRecord;
  subject: string;
  title: string;
  message: string;
  details?: Array<{ label: string; value: string }>;
  ctaLabel?: string;
  ctaPath?: string;
  ctaUrl?: string;
  excludeUserIds?: string[];
  excludeEmails?: string[];
};

export async function notifyBookingParticipants(
  args: NotifyBookingRecipientsArgs,
) {
  const recipients = await listBookingNotificationRecipients(args.booking);
  const excludedUserIds = new Set(args.excludeUserIds ?? []);
  const excludedEmails = new Set(
    (args.excludeEmails ?? [])
      .map((email) => normalizeEmail(email))
      .filter((email): email is string => Boolean(email)),
  );

  for (const recipient of recipients) {
    const recipientEmail = normalizeEmail(recipient.email);
    if (
      (recipient.userId && excludedUserIds.has(recipient.userId)) ||
      (recipientEmail && excludedEmails.has(recipientEmail))
    ) {
      continue;
    }

    if (recipient.userId) {
      await notifyUserById({
        userId: recipient.userId,
        subject: args.subject,
        title: args.title,
        message: args.message,
        details: args.details,
        ctaLabel: args.ctaLabel,
        ctaPath: args.ctaPath,
        ctaUrl: args.ctaUrl,
      });
      continue;
    }

    if (!recipientEmail) {
      continue;
    }

    await notifyUserByEmail({
      email: recipientEmail,
      userName: recipient.userName ?? null,
      subject: args.subject,
      title: args.title,
      message: args.message,
      details: args.details,
      ctaLabel: args.ctaLabel,
      ctaPath: args.ctaPath,
      ctaUrl: args.ctaUrl,
    });
  }
}

type NotifyBookingHostArgs = Omit<NotifyBookingRecipientsArgs, "excludeUserIds" | "excludeEmails">;

export async function notifyBookingHost(args: NotifyBookingHostArgs) {
  return notifyUserById({
    userId: args.booking.slot.pitch.ownerId,
    subject: args.subject,
    title: args.title,
    message: args.message,
    details: args.details,
    ctaLabel: args.ctaLabel,
    ctaPath: args.ctaPath,
    ctaUrl: args.ctaUrl,
  });
}
