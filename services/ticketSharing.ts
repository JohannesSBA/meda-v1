import { InvitationStatus } from "@/generated/prisma/client";
import { decodeEventLocation } from "@/app/helpers/locationCodec";
import { prisma } from "@/lib/prisma";
import { generateShareToken, hashShareToken } from "@/lib/tickets/shareTokens";

type CreateShareLinkPayload = {
  eventId: string;
  ownerUserId: string;
  baseUrl: string;
};

type ClaimShareLinkPayload = {
  token: string;
  claimantUserId: string;
};

type RevokeShareLinkPayload = {
  token: string;
  ownerUserId: string;
};

function normalizeBaseUrl(baseUrl: string) {
  return baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;
}

export async function createShareLink({
  eventId,
  ownerUserId,
  baseUrl,
}: CreateShareLinkPayload) {
  const now = new Date();
  const event = await prisma.event.findUnique({
    where: { eventId },
    select: {
      eventId: true,
      eventName: true,
      eventDatetime: true,
      eventEndtime: true,
    },
  });
  if (!event) throw new Error("Event not found");
  if (event.eventDatetime <= now) throw new Error("Event has already started");

  const ownerTicketCount = await prisma.eventAttendee.count({
    where: { eventId, userId: ownerUserId },
  });
  if (ownerTicketCount <= 1) {
    throw new Error("You need at least 2 tickets to share");
  }

  const preserved = await prisma.invitation.findFirst({
    where: {
      eventId,
      userId: ownerUserId,
      status: { in: [InvitationStatus.Active, InvitationStatus.Expired] },
    },
    orderBy: { updatedAt: "desc" },
    select: { invitationId: true, claimedCount: true },
  });

  const token = generateShareToken();
  const tokenHash = hashShareToken(token);
  const maxClaims = ownerTicketCount - 1 + (preserved?.claimedCount ?? 0);
  const invitation = preserved
    ? await prisma.invitation.update({
        where: { invitationId: preserved.invitationId },
        data: {
          tokenHash,
          status: InvitationStatus.Active,
          expiresAt: event.eventDatetime,
          maxClaims,
        },
      })
    : await prisma.invitation.create({
        data: {
          eventId,
          userId: ownerUserId,
          expiresAt: event.eventDatetime,
          tokenHash,
          status: InvitationStatus.Active,
          maxClaims,
          claimedCount: 0,
        },
      });

  await prisma.invitation.updateMany({
    where: {
      eventId,
      userId: ownerUserId,
      invitationId: { not: invitation.invitationId },
      status: InvitationStatus.Active,
    },
    data: { status: InvitationStatus.Revoked },
  });

  const shareUrl = `${normalizeBaseUrl(baseUrl)}/tickets/claim/${encodeURIComponent(token)}`;
  const remainingClaims = Math.max(0, invitation.maxClaims - invitation.claimedCount);
  return {
    eventId: event.eventId,
    eventName: event.eventName,
    expiresAt: invitation.expiresAt.toISOString(),
    shareUrl,
    remainingClaims,
    maxClaims: invitation.maxClaims,
    claimedCount: invitation.claimedCount,
  };
}

export async function getShareLinkDetails(token: string) {
  const tokenHash = hashShareToken(token);
  const invitation = await prisma.invitation.findUnique({
    where: { tokenHash },
    include: {
      event: {
        select: {
          eventId: true,
          eventName: true,
          eventDatetime: true,
          eventEndtime: true,
          eventLocation: true,
          pictureUrl: true,
          priceField: true,
        },
      },
    },
  });
  if (!invitation) throw new Error("Share link not found");

  const now = new Date();
  const isTimeExpired =
    invitation.expiresAt <= now || invitation.event.eventDatetime <= now;
  if (isTimeExpired && invitation.status === InvitationStatus.Active) {
    await prisma.invitation.update({
      where: { invitationId: invitation.invitationId },
      data: { status: InvitationStatus.Expired },
    });
  }
  const status = isTimeExpired ? InvitationStatus.Expired : invitation.status;
  const remainingClaims = Math.max(0, invitation.maxClaims - invitation.claimedCount);
  const decoded = decodeEventLocation(invitation.event.eventLocation);

  return {
    invitationId: invitation.invitationId,
    status,
    remainingClaims,
    maxClaims: invitation.maxClaims,
    claimedCount: invitation.claimedCount,
    event: {
      eventId: invitation.event.eventId,
      eventName: invitation.event.eventName,
      eventDatetime: invitation.event.eventDatetime.toISOString(),
      eventEndtime: invitation.event.eventEndtime.toISOString(),
      pictureUrl: invitation.event.pictureUrl,
      priceField: invitation.event.priceField,
      addressLabel: decoded.addressLabel,
    },
  };
}

export async function claimShareLink({
  token,
  claimantUserId,
}: ClaimShareLinkPayload) {
  const tokenHash = hashShareToken(token);

  const result = await prisma.$transaction(async (tx) => {
    const invitation = await tx.invitation.findUnique({
      where: { tokenHash },
      include: { event: { select: { eventId: true, eventDatetime: true } } },
    });
    if (!invitation) throw new Error("Share link not found");
    if (invitation.userId === claimantUserId) {
      throw new Error("You cannot claim your own share link");
    }

    const now = new Date();
    if (
      invitation.expiresAt <= now ||
      invitation.event.eventDatetime <= now
    ) {
      if (invitation.status === InvitationStatus.Active) {
        await tx.invitation.update({
          where: { invitationId: invitation.invitationId },
          data: { status: InvitationStatus.Expired },
        });
      }
      throw new Error("This share link has expired");
    }
    if (invitation.status !== InvitationStatus.Active) {
      throw new Error("This share link is no longer active");
    }
    if (invitation.claimedCount >= invitation.maxClaims) {
      await tx.invitation.update({
        where: { invitationId: invitation.invitationId },
        data: { status: InvitationStatus.Expired },
      });
      throw new Error("No tickets left to claim on this link");
    }

    const alreadyClaimed = await tx.invitationClaim.findUnique({
      where: {
        invitationId_claimedByUserId: {
          invitationId: invitation.invitationId,
          claimedByUserId: claimantUserId,
        },
      },
    });
    if (alreadyClaimed) {
      throw new Error("You already claimed a ticket from this link");
    }

    const ownerTickets = await tx.eventAttendee.findMany({
      where: {
        eventId: invitation.eventId,
        userId: invitation.userId,
      },
      select: { attendeeId: true },
      take: 2,
      orderBy: { createdAt: "asc" },
    });
    if (ownerTickets.length <= 1) {
      throw new Error("No shareable tickets remain");
    }

    const nextClaimedCount = invitation.claimedCount + 1;
    const nextStatus =
      nextClaimedCount >= invitation.maxClaims
        ? InvitationStatus.Expired
        : InvitationStatus.Active;
    const claimSlot = await tx.invitation.updateMany({
      where: {
        invitationId: invitation.invitationId,
        status: InvitationStatus.Active,
        claimedCount: invitation.claimedCount,
      },
      data: {
        claimedCount: { increment: 1 },
        status: nextStatus,
      },
    });
    if (claimSlot.count === 0) {
      throw new Error("Ticket claim conflict. Please try again.");
    }

    const transferred = await tx.eventAttendee.updateMany({
      where: {
        attendeeId: ownerTickets[0]!.attendeeId,
        userId: invitation.userId,
      },
      data: { userId: claimantUserId },
    });
    if (transferred.count === 0) {
      throw new Error("Ticket transfer failed. Please try again.");
    }

    await tx.invitationClaim.create({
      data: {
        invitationId: invitation.invitationId,
        claimedByUserId: claimantUserId,
      },
    });

    return {
      eventId: invitation.event.eventId,
      remainingClaims: Math.max(0, invitation.maxClaims - nextClaimedCount),
    };
  });

  return result;
}

export async function revokeShareLink({ token, ownerUserId }: RevokeShareLinkPayload) {
  const tokenHash = hashShareToken(token);
  const invitation = await prisma.invitation.findUnique({
    where: { tokenHash },
    select: { invitationId: true, userId: true, status: true },
  });
  if (!invitation) throw new Error("Share link not found");
  if (invitation.userId !== ownerUserId) {
    throw new Error("Only the ticket owner can revoke this link");
  }

  if (invitation.status !== InvitationStatus.Revoked) {
    await prisma.invitation.update({
      where: { invitationId: invitation.invitationId },
      data: { status: InvitationStatus.Revoked },
    });
  }
  return { ok: true };
}
