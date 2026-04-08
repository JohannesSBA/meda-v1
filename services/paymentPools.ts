import {
  ContributionStatus,
  PartyMemberStatus,
  PaymentPoolStatus,
  PaymentProvider,
  Prisma,
} from "@/generated/prisma/client";
import axios from "axios";
import {
  getChapaClient,
  initializeChapaTransaction,
  verifyChapaTransactionWithRetry,
} from "@/lib/chapa";
import { acquireTransactionLock } from "@/lib/dbLocks";
import { getAuthUserByEmail } from "@/lib/auth/userLookup";
import { roundCurrency } from "@/lib/ticketPricing";
import { logger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import { notifyUserById } from "@/services/actionNotifications";
import { recomputeSlotStatusTx } from "@/services/bookingCapacity";
import {
  loadBookingNotificationRecord,
  notifyBookingHost,
  notifyBookingParticipants,
} from "@/services/bookingNotifications";
import {
  type BookingActor,
  finalizeBookingConfirmationTx,
  getBookingForUser,
} from "@/services/bookings";

type TransactionClient = Prisma.TransactionClient;

function asNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeEmail(email?: string | null) {
  const normalized = email?.trim().toLowerCase() ?? "";
  return normalized || null;
}

async function ensureSufficientUserBalanceTx(args: {
  tx: TransactionClient;
  userId: string;
  amount: number;
}) {
  const balanceRecord = await args.tx.userBalance.findUnique({
    where: { userId: args.userId },
    select: { balanceEtb: true },
  });

  const availableBalance = Number(balanceRecord?.balanceEtb ?? 0);
  if (availableBalance < args.amount) {
    throw new Error(
      `Insufficient balance. Available ETB ${availableBalance.toFixed(2)}, required ETB ${args.amount.toFixed(2)}.`,
    );
  }

  await args.tx.userBalance.update({
    where: { userId: args.userId },
    data: {
      balanceEtb: { decrement: args.amount },
    },
  });
}

async function creditPitchOwnerBalanceTx(args: {
  tx: TransactionClient;
  ownerId: string;
  ownerRevenueAmount: number;
}) {
  const ownerShare = roundCurrency(args.ownerRevenueAmount);
  if (ownerShare <= 0) return;

  await args.tx.userBalance.upsert({
    where: { userId: args.ownerId },
    update: {
      balanceEtb: { increment: ownerShare },
    },
    create: {
      userId: args.ownerId,
      balanceEtb: ownerShare,
    },
  });
}

async function reversePitchOwnerBalanceTx(args: {
  tx: TransactionClient;
  ownerId: string;
  ownerRevenueAmount: number;
}) {
  const ownerShare = roundCurrency(args.ownerRevenueAmount);
  if (ownerShare <= 0) return;

  await args.tx.userBalance.upsert({
    where: { userId: args.ownerId },
    update: {
      balanceEtb: { decrement: ownerShare },
    },
    create: {
      userId: args.ownerId,
      balanceEtb: -ownerShare,
    },
  });
}

async function refundUserBalanceTx(args: {
  tx: TransactionClient;
  userId: string;
  amount: number;
}) {
  if (args.amount <= 0) return;

  await args.tx.userBalance.upsert({
    where: { userId: args.userId },
    update: {
      balanceEtb: { increment: args.amount },
    },
    create: {
      userId: args.userId,
      balanceEtb: args.amount,
    },
  });
}

function getContributionOwnerRevenueAmount(args: {
  bookingTotalAmount: number;
  bookingOwnerRevenueAmount: number;
  contributionAmount: number;
}) {
  if (args.bookingTotalAmount <= 0 || args.bookingOwnerRevenueAmount <= 0) {
    return 0;
  }

  return roundCurrency(
    (args.contributionAmount / args.bookingTotalAmount) *
      args.bookingOwnerRevenueAmount,
  );
}

async function getPoolForActor(args: {
  poolId: string;
  actor: BookingActor;
}) {
  const actorEmail = normalizeEmail(args.actor.email);
  const pool = await prisma.paymentPool.findUnique({
    where: { id: args.poolId },
    include: {
      booking: {
        include: {
          slot: {
            include: {
              pitch: {
                select: {
                  id: true,
                  ownerId: true,
                  name: true,
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
        },
      },
      contributions: {
        include: {
          partyMember: true,
        },
        orderBy: [{ createdAt: "asc" }],
      },
    },
  });

  if (!pool) {
    throw new Error("Payment pool not found");
  }

  const canAccess =
    args.actor.role === "admin" ||
    pool.booking.userId === args.actor.userId ||
    pool.booking.slot.pitch.ownerId === args.actor.userId ||
    pool.booking.party?.ownerId === args.actor.userId ||
    pool.booking.party?.members.some(
      (member) =>
        member.userId === args.actor.userId ||
        (actorEmail ? normalizeEmail(member.invitedEmail) === actorEmail : false),
    );

  if (!canAccess) {
    throw new Error("Payment pool not found");
  }

  return pool;
}

async function logOwnerActivityTx(args: {
  tx: TransactionClient;
  ownerId: string;
  pitchId?: string | null;
  entityType: string;
  entityId: string;
  action: string;
  metadata?: Prisma.InputJsonValue;
}) {
  await args.tx.hostActivityLog.create({
    data: {
      ownerId: args.ownerId,
      pitchId: args.pitchId ?? null,
      entityType: args.entityType,
      entityId: args.entityId,
      action: args.action,
      metadataJson: args.metadata,
    },
  });
}

export async function getPaymentPoolForUser(args: {
  poolId: string;
  actor: BookingActor;
}) {
  const pool = await getPoolForActor(args);
  const booking = await getBookingForUser({
    bookingId: pool.bookingId,
    actor: args.actor,
  });

  return booking.paymentPool;
}

type ContributeArgs = {
  poolId: string;
  actor: BookingActor;
  amount?: number;
  partyMemberId?: string;
  paymentMethod: "balance" | "chapa";
  callbackUrl: string;
  returnUrlBase: string;
};

export async function contributeToPaymentPool(args: ContributeArgs) {
  const txRef =
    args.paymentMethod === "chapa"
      ? getChapaClient().genTxRef({ prefix: "MEDAPOOL", size: 20 })
      : null;

  const result = await prisma.$transaction(async (tx) => {
    await acquireTransactionLock(tx, "payment-pool-contribute", args.poolId);

    const actorEmail = normalizeEmail(args.actor.email);
    const pool = await tx.paymentPool.findUnique({
      where: { id: args.poolId },
      include: {
        booking: {
          include: {
            slot: {
              include: {
                pitch: {
                  select: {
                    id: true,
                    ownerId: true,
                    name: true,
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
          },
        },
        contributions: {
          include: {
            partyMember: true,
          },
          orderBy: [{ createdAt: "asc" }],
        },
      },
    });

    if (!pool) {
      throw new Error("Payment pool not found");
    }
    if (pool.status !== PaymentPoolStatus.PENDING) {
      throw new Error("This payment pool is no longer accepting contributions.");
    }
    if (pool.expiresAt <= new Date()) {
      throw new Error("This payment pool has already expired.");
    }

    const canManageContribution =
      args.actor.role === "admin" ||
      pool.booking.userId === args.actor.userId ||
      pool.booking.party?.ownerId === args.actor.userId ||
      pool.booking.slot.pitch.ownerId === args.actor.userId ||
      (args.actor.role === "facilitator" &&
        args.actor.parentPitchOwnerUserId === pool.booking.slot.pitch.ownerId);
    const matchingMember = pool.booking.party?.members.find(
      (member) =>
        member.userId === args.actor.userId ||
        (actorEmail ? normalizeEmail(member.invitedEmail) === actorEmail : false),
    );
    if (!matchingMember && !canManageContribution) {
      throw new Error("You are not allowed to contribute to this pool.");
    }

    const targetMember = args.partyMemberId
      ? pool.booking.party?.members.find((member) => member.id === args.partyMemberId) ?? null
      : matchingMember ?? null;
    if (args.partyMemberId && !targetMember) {
      throw new Error("That group member does not belong to this payment pool.");
    }
    if (args.partyMemberId && !canManageContribution) {
      throw new Error("You are not allowed to pay this member's share.");
    }

    let contribution = pool.contributions.find(
      (entry) =>
        args.partyMemberId
          ? entry.partyMemberId === args.partyMemberId
          : entry.userId === args.actor.userId ||
            (matchingMember ? entry.partyMemberId === matchingMember.id : false),
    );

    if (!contribution && !targetMember) {
      throw new Error("No contribution record exists for this member.");
    }

    const knownUser =
      actorEmail && !matchingMember?.userId ? await getAuthUserByEmail(actorEmail) : null;

    if (matchingMember && !matchingMember.userId && (knownUser?.id ?? args.actor.userId)) {
      await tx.partyMember.update({
        where: { id: matchingMember.id },
        data: {
          userId: knownUser?.id ?? args.actor.userId,
          status:
            matchingMember.status === PartyMemberStatus.INVITED
              ? PartyMemberStatus.JOINED
              : matchingMember.status,
          joinedAt: matchingMember.joinedAt ?? new Date(),
        },
      });
    }

    if (!contribution && targetMember) {
      contribution = await tx.paymentContribution.create({
        data: {
          poolId: pool.id,
          userId: args.partyMemberId ? targetMember.userId : knownUser?.id ?? args.actor.userId,
          partyMemberId: targetMember.id,
          expectedAmount: 0,
          paidAmount: 0,
          status: ContributionStatus.PENDING,
        },
        include: {
          partyMember: true,
        },
      });
    }

    if (!contribution) {
      throw new Error("No contribution record exists for this member.");
    }

    const outstandingAmount = roundCurrency(
      Math.max(0, asNumber(contribution.expectedAmount) - asNumber(contribution.paidAmount)),
    );
    if (outstandingAmount <= 0) {
      return {
        mode: "ready" as const,
        bookingId: pool.bookingId,
        txRef: null,
        checkoutUrl: null,
      };
    }

    const amountToPay = roundCurrency(
      Math.min(args.amount ?? outstandingAmount, outstandingAmount),
    );

    if (amountToPay <= 0) {
      throw new Error("Contribution amount must be greater than zero.");
    }

    if (args.paymentMethod === "balance") {
      await ensureSufficientUserBalanceTx({
        tx,
        userId: args.actor.userId,
        amount: amountToPay,
      });

      const updatedContribution = await tx.paymentContribution.update({
        where: { id: contribution.id },
        data: {
          userId: args.actor.userId,
          paidAmount: { increment: amountToPay },
          status:
            amountToPay >= outstandingAmount
              ? ContributionStatus.PAID
              : ContributionStatus.PENDING,
          paidAt: amountToPay >= outstandingAmount ? new Date() : null,
          providerRef: null,
        },
        include: {
          partyMember: true,
        },
      });

      if (updatedContribution.partyMemberId) {
        await tx.partyMember.update({
          where: { id: updatedContribution.partyMemberId },
          data: {
            userId:
              updatedContribution.partyMember?.userId ??
              (args.partyMemberId ? null : knownUser?.id ?? args.actor.userId),
            status:
              amountToPay >= outstandingAmount
                ? PartyMemberStatus.PAID
                : PartyMemberStatus.JOINED,
            joinedAt: new Date(),
            paidAt: amountToPay >= outstandingAmount ? new Date() : null,
          },
        });
      }

      const updatedPool = await tx.paymentPool.update({
        where: { id: pool.id },
        data: {
          amountPaid: { increment: amountToPay },
        },
      });

      await creditPitchOwnerBalanceTx({
        tx,
        ownerId: pool.booking.slot.pitch.ownerId,
        ownerRevenueAmount: getContributionOwnerRevenueAmount({
          bookingTotalAmount: asNumber(pool.booking.totalAmount),
          bookingOwnerRevenueAmount: asNumber(pool.booking.ownerRevenueAmount),
          contributionAmount: amountToPay,
        }),
      });

      if (asNumber(updatedPool.amountPaid) + 0.0001 >= asNumber(updatedPool.totalAmount)) {
        await finalizeBookingConfirmationTx(tx, pool.bookingId, {
          paidAt: new Date(),
          paymentProvider: PaymentProvider.balance,
          markPoolFulfilled: true,
        });
      }

      await logOwnerActivityTx({
        tx,
        ownerId: pool.booking.slot.pitch.ownerId,
        pitchId: pool.booking.slot.pitch.id,
        entityType: "payment_pool",
        entityId: pool.id,
        action: "payment_pool.contribution_paid",
        metadata: {
          contributionId: updatedContribution.id,
          amount: amountToPay,
          paymentProvider: "balance",
        },
      });

      return {
        mode: "ready" as const,
        bookingId: pool.bookingId,
        txRef: null,
        checkoutUrl: null,
      };
    }

    await tx.paymentContribution.update({
      where: { id: contribution.id },
      data: {
        userId: args.actor.userId,
        providerRef: txRef,
        status: ContributionStatus.PENDING,
      },
    });
    return {
      mode: "checkout" as const,
      bookingId: pool.bookingId,
      amountToPay,
      currency: pool.currency,
      pitchName: pool.booking.slot.pitch.name,
    };
  });

  if (result.mode === "ready") {
    const booking = await getBookingForUser({
      bookingId: result.bookingId,
      actor: args.actor,
    });

    await notifyUserById({
      userId: args.actor.userId,
      subject: "Your group payment was saved",
      title: "Your payment was saved",
      message: "Your share is now recorded in the group payment.",
      details: [
        { label: "Place", value: booking.slot.pitchName },
        {
          label: "Time",
          value: `${new Date(booking.slot.startsAt).toLocaleString()} - ${new Date(booking.slot.endsAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`,
        },
      ],
      ctaLabel: "Open Tickets",
      ctaPath: "/tickets",
    });

    return {
      booking,
      txRef: result.txRef,
      checkoutUrl: result.checkoutUrl,
    };
  }

  let checkoutUrl: string | null = null;
  if (txRef) {
    try {
      const returnUrl = `${args.returnUrlBase}${
        args.returnUrlBase.includes("?") ? "&" : "?"
      }pool_tx_ref=${encodeURIComponent(txRef)}`;
      const response = await initializeChapaTransaction({
        first_name: "Meda",
        last_name: "Player",
        email: args.actor.email ?? `user-${args.actor.userId}@meda.app`,
        currency: result.currency,
        amount: result.amountToPay.toFixed(2),
        tx_ref: txRef,
        callback_url: args.callbackUrl,
        return_url: returnUrl,
        customization: {
          title: "Meda Pool",
          description: `Pool contribution for ${result.pitchName}`,
        },
      });

      if (response.status !== "success" || !response.data?.checkout_url) {
        throw new Error("Unable to initialize Chapa checkout for this pool contribution.");
      }

      checkoutUrl = response.data.checkout_url;
    } catch (error) {
      logger.error("Failed to initialize payment-pool contribution checkout", error);
      await prisma.paymentContribution.updateMany({
        where: { providerRef: txRef },
        data: {
          providerRef: null,
          status: ContributionStatus.FAILED,
        },
      });
      if (axios.isAxiosError(error)) {
        const providerMessage =
          typeof error.response?.data?.message === "string"
            ? error.response.data.message
            : error.message;
        throw new Error(providerMessage || "Failed to initialize pool contribution payment");
      }
      throw error instanceof Error
        ? error
        : new Error("Failed to initialize pool contribution payment");
    }
  }

  await notifyUserById({
    userId: args.actor.userId,
    subject: "Finish paying your group share",
    title: "Your share is waiting for payment",
    message: "Finish the payment to keep your group booking moving.",
    ctaLabel: "Open Tickets",
    ctaPath: "/tickets",
  });

  return {
    booking: await getBookingForUser({
      bookingId: result.bookingId,
      actor: args.actor,
    }),
    txRef,
    checkoutUrl,
  };
}

export async function confirmPaymentPoolContribution(args: {
  txRef: string;
  actor?: BookingActor | null;
}) {
  const contribution = await prisma.paymentContribution.findFirst({
    where: { providerRef: args.txRef },
    include: {
      pool: {
        include: {
          booking: {
            include: {
              slot: {
                include: {
                  pitch: {
                    select: {
                      id: true,
                      ownerId: true,
                      name: true,
                    },
                  },
                },
              },
              party: {
                include: {
                  members: true,
                },
              },
            },
          },
        },
      },
      partyMember: true,
    },
  });

  if (!contribution) {
    throw new Error("Pool contribution not found");
  }

  if (args.actor) {
    const actorEmail = normalizeEmail(args.actor.email);
    const canAccess =
      args.actor.role === "admin" ||
      contribution.userId === args.actor.userId ||
      contribution.pool.booking.userId === args.actor.userId ||
      contribution.pool.booking.slot.pitch.ownerId === args.actor.userId ||
      contribution.partyMember?.userId === args.actor.userId ||
      (actorEmail &&
        normalizeEmail(contribution.partyMember?.invitedEmail) === actorEmail);

    if (!canAccess) {
      throw new Error("Pool contribution not found");
    }
  }

  if (contribution.status === ContributionStatus.PAID) {
    return {
      ok: true as const,
      status: "already_confirmed" as const,
      booking: await getBookingForUser({
        bookingId: contribution.pool.bookingId,
        actor:
          args.actor ??
          ({
            userId:
              contribution.pool.booking.userId ??
              contribution.pool.booking.slot.pitch.ownerId,
            role: "user",
          } satisfies BookingActor),
      }),
    };
  }

  const verification = await verifyChapaTransactionWithRetry(args.txRef);
  const providerStatus = verification.data?.status?.toLowerCase() ?? "";
  if (providerStatus !== "success") {
    if (providerStatus === "failed") {
      await prisma.paymentContribution.update({
        where: { id: contribution.id },
        data: {
          status: ContributionStatus.FAILED,
        },
      });
      return {
        ok: false as const,
        status: "failed" as const,
        booking: await getBookingForUser({
          bookingId: contribution.pool.bookingId,
          actor:
            args.actor ??
            ({
              userId:
                contribution.pool.booking.userId ??
                contribution.pool.booking.slot.pitch.ownerId,
              role: "user",
            } satisfies BookingActor),
        }),
      };
    }
    return {
      ok: false as const,
      status: "processing" as const,
      booking: await getBookingForUser({
        bookingId: contribution.pool.bookingId,
        actor:
          args.actor ??
          ({
            userId:
              contribution.pool.booking.userId ??
              contribution.pool.booking.slot.pitch.ownerId,
            role: "user",
          } satisfies BookingActor),
      }),
    };
  }

  const outstandingAmount = roundCurrency(
    Math.max(0, asNumber(contribution.expectedAmount) - asNumber(contribution.paidAmount)),
  );
  const verifiedAmount = Number(verification.data?.amount);
  if (
    Number.isFinite(verifiedAmount) &&
    Math.abs(verifiedAmount - outstandingAmount) > 0.009
  ) {
    await prisma.paymentContribution.update({
      where: { id: contribution.id },
      data: {
        status: ContributionStatus.FAILED,
      },
    });
    throw new Error("Verified pool contribution amount did not match the outstanding amount.");
  }

  const booking = await prisma.$transaction(async (tx) => {
    await acquireTransactionLock(tx, "payment-pool-confirm", contribution.poolId);
    const latest = await tx.paymentContribution.findUnique({
      where: { id: contribution.id },
      include: {
        pool: {
          include: {
            booking: {
              include: {
                slot: {
                  include: {
                    pitch: {
                      select: {
                        id: true,
                        ownerId: true,
                      },
                    },
                  },
                },
              },
            },
          },
        },
        partyMember: true,
      },
    });

    if (!latest) {
      throw new Error("Pool contribution not found");
    }
    if (latest.status === ContributionStatus.PAID) {
      return {
        bookingId: latest.pool.bookingId,
      };
    }
    if (latest.pool.status !== PaymentPoolStatus.PENDING) {
      throw new Error("This payment pool is no longer accepting contributions.");
    }

    const paidAt = new Date();
    await tx.paymentContribution.update({
      where: { id: latest.id },
      data: {
        paidAmount: { increment: outstandingAmount },
        status: ContributionStatus.PAID,
        paidAt,
      },
    });

    if (latest.partyMemberId) {
      await tx.partyMember.update({
        where: { id: latest.partyMemberId },
        data: {
          userId: latest.userId ?? args.actor?.userId ?? latest.partyMember?.userId ?? null,
          status: PartyMemberStatus.PAID,
          joinedAt: latest.partyMember?.joinedAt ?? paidAt,
          paidAt,
        },
      });
    }

    const updatedPool = await tx.paymentPool.update({
      where: { id: latest.poolId },
      data: {
        amountPaid: { increment: outstandingAmount },
      },
    });

    await creditPitchOwnerBalanceTx({
      tx,
      ownerId: latest.pool.booking.slot.pitch.ownerId,
      ownerRevenueAmount: getContributionOwnerRevenueAmount({
        bookingTotalAmount: asNumber(latest.pool.booking.totalAmount),
        bookingOwnerRevenueAmount: asNumber(latest.pool.booking.ownerRevenueAmount),
        contributionAmount: outstandingAmount,
      }),
    });

    const bookingConfirmedNow =
      asNumber(updatedPool.amountPaid) + 0.0001 >= asNumber(updatedPool.totalAmount);

    if (bookingConfirmedNow) {
      await finalizeBookingConfirmationTx(tx, latest.pool.bookingId, {
        paidAt,
        paymentProvider: PaymentProvider.chapa,
        markPoolFulfilled: true,
      });
    }

    await logOwnerActivityTx({
      tx,
      ownerId: latest.pool.booking.slot.pitch.ownerId,
      pitchId: latest.pool.booking.slot.pitch.id,
      entityType: "payment_pool",
      entityId: latest.poolId,
      action: "payment_pool.contribution_paid",
      metadata: {
        contributionId: latest.id,
        amount: outstandingAmount,
        paymentProvider: "chapa",
      },
    });

    return {
      bookingId: latest.pool.bookingId,
      bookingConfirmedNow,
    };
  });

  const serializedBooking = await getBookingForUser({
    bookingId: booking.bookingId,
    actor:
      args.actor ??
      ({
        userId:
          contribution.pool.booking.userId ?? contribution.pool.booking.slot.pitch.ownerId,
        role: "user",
      } satisfies BookingActor),
  });

  if (booking.bookingConfirmedNow) {
    const confirmedBooking = await loadBookingNotificationRecord(booking.bookingId);
    await notifyBookingParticipants({
      booking: confirmedBooking,
      subject: "Your group booking is confirmed",
      title: "Your group booking is ready",
      message: "The full group payment cleared and every spot on this booking is now ready in Meda.",
      details: [
        { label: "Place", value: serializedBooking.slot.pitchName },
        {
          label: "Time",
          value: `${new Date(serializedBooking.slot.startsAt).toLocaleString()} - ${new Date(serializedBooking.slot.endsAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`,
        },
        { label: "Group total", value: `ETB ${serializedBooking.totalAmount.toFixed(2)}` },
      ],
      ctaLabel: "Open Tickets",
      ctaPath: "/tickets",
    });

    if (confirmedBooking.slot.pitch.ownerId !== serializedBooking.purchaser?.id) {
      await notifyBookingHost({
        booking: confirmedBooking,
        subject: "A new group booking was confirmed at your place",
        title: "A group booking is confirmed",
        message: "A group finished paying for one of your time slots in Meda.",
        details: [
          { label: "Place", value: serializedBooking.slot.pitchName },
          {
            label: "Time",
            value: `${new Date(serializedBooking.slot.startsAt).toLocaleString()} - ${new Date(serializedBooking.slot.endsAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`,
          },
          { label: "Players", value: String(serializedBooking.ticketSummary.sold) },
          { label: "Total", value: `ETB ${serializedBooking.totalAmount.toFixed(2)}` },
        ],
        ctaLabel: "Open Host",
        ctaPath: "/host",
      });
    }
  } else if (contribution.userId ?? contribution.partyMember?.userId) {
    await notifyUserById({
      userId:
        contribution.userId ??
        contribution.partyMember?.userId ??
        contribution.pool.booking.userId!,
      subject: "Your group payment was confirmed",
      title: "Your payment was confirmed",
      message: "We received your share and updated the group payment status.",
      details: [
        { label: "Place", value: serializedBooking.slot.pitchName },
        {
          label: "Time",
          value: `${new Date(serializedBooking.slot.startsAt).toLocaleString()} - ${new Date(serializedBooking.slot.endsAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`,
        },
      ],
      ctaLabel: "Open Tickets",
      ctaPath: "/tickets",
    });
  }

  return {
    ok: true as const,
    status: "confirmed" as const,
    booking: serializedBooking,
  };
}

export async function expirePaymentPools(now = new Date()) {
  const pools = await prisma.paymentPool.findMany({
    where: {
      status: PaymentPoolStatus.PENDING,
      expiresAt: {
        lt: now,
      },
    },
    select: {
      id: true,
    },
  });

  let expiredCount = 0;
  for (const pool of pools) {
    const refundNotifications: Array<{
      userId: string;
      refundAmount: number;
      pitchName: string;
    }> = [];
    await prisma.$transaction(async (tx) => {
      await acquireTransactionLock(tx, "payment-pool-expire", pool.id);
      const latest = await tx.paymentPool.findUnique({
        where: { id: pool.id },
        include: {
          booking: {
            include: {
              slot: {
                include: {
                  pitch: {
                    select: {
                      id: true,
                      ownerId: true,
                      name: true,
                    },
                  },
                },
              },
            },
          },
          contributions: {
            include: {
              partyMember: true,
            },
          },
        },
      });

      if (!latest || latest.status !== PaymentPoolStatus.PENDING || latest.expiresAt >= now) {
        return;
      }

      await tx.paymentPool.update({
        where: { id: latest.id },
        data: {
          status: PaymentPoolStatus.EXPIRED,
        },
      });

      await tx.paymentContribution.updateMany({
        where: {
          poolId: latest.id,
          status: ContributionStatus.PENDING,
        },
        data: {
          status: ContributionStatus.EXPIRED,
        },
      });

      const paidContributions = latest.contributions.filter(
        (contribution) =>
          contribution.status === ContributionStatus.PAID &&
          asNumber(contribution.paidAmount) > 0,
      );
      let refundedTotal = 0;

      for (const contribution of paidContributions) {
        const refundUserId =
          contribution.userId ?? contribution.partyMember?.userId ?? null;
        const refundAmount = roundCurrency(asNumber(contribution.paidAmount));

        if (!refundUserId || refundAmount <= 0) {
          continue;
        }

        await refundUserBalanceTx({
          tx,
          userId: refundUserId,
          amount: refundAmount,
        });

        await reversePitchOwnerBalanceTx({
          tx,
          ownerId: latest.booking.slot.pitch.ownerId,
          ownerRevenueAmount: getContributionOwnerRevenueAmount({
            bookingTotalAmount: asNumber(latest.booking.totalAmount),
            bookingOwnerRevenueAmount: asNumber(latest.booking.ownerRevenueAmount),
            contributionAmount: refundAmount,
          }),
        });
        refundedTotal += refundAmount;

        await tx.paymentContribution.update({
          where: { id: contribution.id },
          data: {
            status: ContributionStatus.REFUNDED,
          },
        });

        await logOwnerActivityTx({
          tx,
          ownerId: latest.booking.slot.pitch.ownerId,
          pitchId: latest.booking.slot.pitch.id,
          entityType: "payment_pool",
          entityId: latest.id,
          action: "payment_pool.contribution_refunded",
          metadata: {
            contributionId: contribution.id,
            refundedToUserId: refundUserId,
            amount: refundAmount,
            reason: "expired_to_meda_balance",
          },
        });
        refundNotifications.push({
          userId: refundUserId,
          refundAmount,
          pitchName: latest.booking.slot.pitch.name,
        });
      }

      if (refundedTotal > 0) {
        await tx.paymentPool.update({
          where: { id: latest.id },
          data: {
            amountPaid: {
              decrement: refundedTotal,
            },
          },
        });
      }

      await tx.booking.update({
        where: { id: latest.bookingId },
        data: {
          status: "EXPIRED",
          failureReason: "Monthly payment pool expired before all contributions cleared.",
        },
      });

      if (latest.booking.partyId) {
        await tx.party.update({
          where: { id: latest.booking.partyId },
          data: {
            status: "EXPIRED",
          },
        });
      }

      await recomputeSlotStatusTx(tx, latest.booking.slotId, now);

      await logOwnerActivityTx({
        tx,
        ownerId: latest.booking.slot.pitch.ownerId,
        pitchId: latest.booking.slot.pitch.id,
        entityType: "payment_pool",
        entityId: latest.id,
        action: "payment_pool.expired",
        metadata: {
          bookingId: latest.bookingId,
        },
      });
      expiredCount += 1;
    });

    for (const notification of refundNotifications) {
      await notifyUserById({
        userId: notification.userId,
        subject: "Your group payment was refunded",
        title: "Your payment went back to your Meda balance",
        message:
          "The group payment expired before everyone paid, so your paid share went back to your Meda balance automatically.",
        details: [
          { label: "Refund", value: `ETB ${notification.refundAmount.toFixed(2)}` },
          { label: "Place", value: notification.pitchName },
        ],
        ctaLabel: "Open Tickets",
        ctaPath: "/tickets",
      });
    }
  }

  return { expiredCount };
}
