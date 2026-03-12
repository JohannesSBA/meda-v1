/**
 * Payments service -- Chapa checkout intents, balance payments, and idempotent
 * reconciliation for paid ticket orders.
 */

import { randomUUID } from "crypto";
import axios from "axios";
import { Chapa } from "chapa-nodejs";
import { getRequiredEnv } from "@/lib/env";
import { resolveEventLocation } from "@/lib/location";
import { acquireTransactionLock } from "@/lib/dbLocks";
import { CHAPA_HOLD_WINDOW_MS, getLockedAvailabilitySnapshot } from "@/lib/events/availability";
import { logger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import { MAX_TICKETS_PER_USER_PER_EVENT } from "@/lib/constants";
import {
  PaymentProvider,
  PaymentStatus,
} from "@/generated/prisma/client";
import { sendTicketConfirmationEmail } from "@/services/email";

type CheckoutPayload = {
  eventId: string;
  quantity: number;
  userId: string;
  email: string;
  firstName?: string;
  lastName?: string;
  callbackUrl: string;
  returnUrlBase: string;
};

type ConfirmPayload = {
  txRef: string;
  userId?: string | null;
};

type ChapaVerification = {
  status?: string;
  message?: unknown;
  data?: {
    status?: string;
    tx_ref?: string;
    amount?: string | number;
    currency?: string;
  };
};

export type PayWithBalanceParams = {
  eventId: string;
  userId: string;
  quantity: number;
  userEmail?: string | null;
  userName?: string | null;
  baseUrl: string;
};

export type PayWithBalanceResult = {
  ok: true;
  quantity: number;
  amountPaid: number;
  newBalance: number;
};

export type ChapaConfirmationResult =
  | {
      ok: true;
      status: "fulfilled" | "already_confirmed";
      quantity: number;
      eventId: string;
      alreadyConfirmed: boolean;
    }
  | {
      ok: false;
      status: "requires_refund";
      quantity: 0;
      eventId: string;
      failureReason: string;
    };

export class InsufficientBalanceError extends Error {
  constructor(
    public availableBalance: number,
    public totalCost: number,
    public shortfall: number,
  ) {
    super("Insufficient balance");
    this.name = "InsufficientBalanceError";
  }
}

function getChapaClient() {
  return new Chapa({ secretKey: getRequiredEnv("CHAPA_SECRET_KEY") });
}

function getChapaSecretKey() {
  return getRequiredEnv("CHAPA_SECRET_KEY");
}

function toErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  try {
    return JSON.stringify(error);
  } catch {
    return "Unknown error";
  }
}

function isPaymentPending(status: PaymentStatus) {
  return status === PaymentStatus.created || status === PaymentStatus.processing;
}

async function verifyChapaTransaction(txRef: string) {
  const secretKey = getChapaSecretKey();
  let verification: ChapaVerification | undefined;
  try {
    const httpResponse = await axios.get(
      `https://api.chapa.co/v1/transaction/verify/${encodeURIComponent(txRef)}`,
      {
        headers: { Authorization: `Bearer ${secretKey}` },
        timeout: 15000,
      },
    );
    verification = httpResponse.data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      throw new Error(
        `Chapa verify failed: ${toErrorMessage(error.response?.data ?? error.message)}`,
      );
    }
    throw new Error(`Chapa verify failed: ${toErrorMessage(error)}`);
  }
  if (!verification) throw new Error("Chapa verify failed: empty response");
  return verification;
}

const CHAPA_VERIFY_RETRY_DELAYS_MS = [0, 2000, 4000, 6000];
const CHAPA_VERIFY_MAX_ATTEMPTS = 4;

async function verifyChapaTransactionWithRetry(txRef: string) {
  let lastVerification: ChapaVerification | null = null;
  for (let attempt = 0; attempt < CHAPA_VERIFY_MAX_ATTEMPTS; attempt++) {
    if (attempt > 0) {
      const delayMs = CHAPA_VERIFY_RETRY_DELAYS_MS[attempt] ?? 6000;
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
    const verification = await verifyChapaTransaction(txRef);
    lastVerification = verification;
    const paidStatus = verification.data?.status?.toLowerCase();
    if (paidStatus === "success") return verification;
    if (paidStatus === "failed") break;
  }
  return lastVerification!;
}

async function markPaymentRequiresRefund(
  paymentId: string,
  failureReason: string,
) {
  await prisma.payment.update({
    where: { paymentId },
    data: {
      status: PaymentStatus.requires_refund,
      failureReason,
      verifiedAt: new Date(),
      reservationExpiresAt: null,
    },
  });
}

export async function payWithBalance(
  params: PayWithBalanceParams,
): Promise<PayWithBalanceResult> {
  const { eventId, userId, quantity, userEmail, userName, baseUrl } = params;

  const preflightEvent = await prisma.event.findUnique({
    where: { eventId },
    select: {
      eventId: true,
      eventEndtime: true,
      capacity: true,
      priceField: true,
    },
  });
  if (!preflightEvent) throw new Error("Event not found");
  if (preflightEvent.eventEndtime <= new Date()) throw new Error("Event has ended");
  if (!preflightEvent.priceField || preflightEvent.priceField <= 0) {
    throw new Error("This event does not require payment");
  }
  if (preflightEvent.capacity != null && quantity > preflightEvent.capacity) {
    throw new Error("Not enough seats available");
  }

  const preflightCost = preflightEvent.priceField * quantity;
  const preflightBalance = await prisma.userBalance.findUnique({
    where: { userId },
  });
  const preflightAvailableBalance = preflightBalance
    ? Number(preflightBalance.balanceEtb)
    : 0;
  if (preflightAvailableBalance < preflightCost) {
    throw new InsufficientBalanceError(
      preflightAvailableBalance,
      preflightCost,
      preflightCost - preflightAvailableBalance,
    );
  }

  const { event, totalCost } = await prisma.$transaction(async (tx) => {
    const snapshot = await getLockedAvailabilitySnapshot(eventId, tx);
    if (!snapshot) throw new Error("Event not found");

    const { event, spotsLeft } = snapshot;
    if (event.eventEndtime <= new Date()) throw new Error("Event has ended");
    if (!event.priceField || event.priceField <= 0) {
      throw new Error("This event does not require payment");
    }

    const existingTickets =
      typeof tx.eventAttendee?.count === "function"
        ? await tx.eventAttendee.count({ where: { eventId, userId } })
        : 0;
    if (existingTickets + quantity > MAX_TICKETS_PER_USER_PER_EVENT) {
      throw new Error(
        `You can hold at most ${MAX_TICKETS_PER_USER_PER_EVENT} tickets for this event`,
      );
    }
    if (spotsLeft != null && quantity > spotsLeft) {
      throw new Error("Not enough seats available");
    }

    const totalCost = event.priceField * quantity;
    const balance = await tx.userBalance.findUnique({
      where: { userId },
    });
    const availableBalance = balance ? Number(balance.balanceEtb) : 0;
    if (availableBalance < totalCost) {
      throw new InsufficientBalanceError(
        availableBalance,
        totalCost,
        totalCost - availableBalance,
      );
    }

    await tx.userBalance.update({
      where: { userId },
      data: { balanceEtb: { decrement: totalCost } },
    });

    await tx.eventAttendee.createMany({
      data: Array.from({ length: quantity }).map(() => ({
        eventId,
        userId,
        status: "RSVPed" as const,
      })),
    });

    await tx.payment.create({
      data: {
        eventId,
        userId,
        quantity,
        unitPriceEtb: event.priceField,
        amountEtb: totalCost,
        currency: "ETB",
        provider: PaymentProvider.balance,
        status: PaymentStatus.succeeded,
        providerReference: `BALANCE-${randomUUID()}`,
        verifiedAt: new Date(),
        fulfilledAt: new Date(),
      },
    });

    return { event, totalCost };
  });

  if (userEmail) {
    const location = resolveEventLocation(event);
    const attendees = await prisma.eventAttendee.findMany({
      where: { eventId, userId },
      select: { attendeeId: true },
      orderBy: { createdAt: "desc" },
      take: quantity,
    });
    try {
      await sendTicketConfirmationEmail({
        to: userEmail,
        buyerName: userName ?? null,
        eventName: event.eventName,
        eventDateTime: event.eventDatetime,
        eventEndTime: event.eventEndtime,
        locationLabel: location.addressLabel,
        quantity,
        eventId,
        attendeeIds: attendees.map((a) => a.attendeeId),
        baseUrl,
      });
    } catch (error) {
      logger.error("Failed to send ticket confirmation email", error);
    }
  }

  const updatedBalance = await prisma.userBalance.findUnique({ where: { userId } });

  return {
    ok: true,
    quantity,
    amountPaid: totalCost,
    newBalance: updatedBalance ? Number(updatedBalance.balanceEtb) : 0,
  };
}

export async function initializeChapaCheckout(payload: CheckoutPayload) {
  const txRef = getChapaClient().genTxRef({ prefix: "MEDA", size: 20 });
  const reservationExpiresAt = new Date(Date.now() + CHAPA_HOLD_WINDOW_MS);

  const intent = await prisma.$transaction(async (tx) => {
    const now = new Date();
    await acquireTransactionLock(
      tx,
      "payment-checkout",
      `${payload.eventId}:${payload.userId}`,
    );

    await tx.payment.updateMany({
      where: {
        eventId: payload.eventId,
        userId: payload.userId,
        provider: PaymentProvider.chapa,
        status: { in: [PaymentStatus.created, PaymentStatus.processing] },
        reservationExpiresAt: { gt: now },
      },
      data: {
        status: PaymentStatus.canceled,
        failureReason: "Superseded by a newer checkout attempt",
        verifiedAt: now,
        reservationExpiresAt: null,
      },
    });

    const snapshot = await getLockedAvailabilitySnapshot(payload.eventId, tx);
    if (!snapshot) throw new Error("Event not found");

    const { event, spotsLeft } = snapshot;
    if (event.eventEndtime <= now) throw new Error("Event has ended");
    if (!event.priceField || event.priceField <= 0) {
      throw new Error("This event does not require payment");
    }

    const existingTickets =
      typeof tx.eventAttendee?.count === "function"
        ? await tx.eventAttendee.count({
            where: { eventId: payload.eventId, userId: payload.userId },
          })
        : 0;
    if (existingTickets + payload.quantity > MAX_TICKETS_PER_USER_PER_EVENT) {
      throw new Error(
        `You can hold at most ${MAX_TICKETS_PER_USER_PER_EVENT} tickets for this event`,
      );
    }
    if (spotsLeft != null && payload.quantity > spotsLeft) {
      throw new Error("Not enough seats available");
    }

    const totalAmount = event.priceField * payload.quantity;
    const payment = await tx.payment.create({
      data: {
        eventId: payload.eventId,
        userId: payload.userId,
        quantity: payload.quantity,
        unitPriceEtb: event.priceField,
        amountEtb: totalAmount,
        currency: "ETB",
        provider: PaymentProvider.chapa,
        status: PaymentStatus.created,
        providerReference: txRef,
        reservationExpiresAt,
      },
      select: { paymentId: true },
    });

    return {
      paymentId: payment.paymentId,
      eventName: event.eventName,
      amount: totalAmount.toFixed(2),
    };
  });

  const secretKey = getChapaSecretKey();
  const returnUrl = `${payload.returnUrlBase}${payload.returnUrlBase.includes("?") ? "&" : "?"}tx_ref=${encodeURIComponent(txRef)}`;
  const customizationTitle =
    (intent.eventName || "Meda Event").trim().slice(0, 16) || "Meda Event";

  try {
    const httpResponse = await axios.post(
      "https://api.chapa.co/v1/transaction/initialize",
      {
        first_name: payload.firstName?.trim() || "Meda",
        last_name: payload.lastName?.trim() || "User",
        email: payload.email,
        currency: "ETB",
        amount: intent.amount,
        tx_ref: txRef,
        callback_url: payload.callbackUrl,
        return_url: returnUrl,
        customization: {
          title: customizationTitle,
          description: `Ticket purchase for ${intent.eventName}`,
        },
      },
      {
        headers: {
          Authorization: `Bearer ${secretKey}`,
          "Content-Type": "application/json",
        },
        timeout: 15000,
      },
    );

    const response = httpResponse.data as {
      status?: string;
      message?: unknown;
      data?: { checkout_url?: string };
    };

    if (response.status !== "success" || !response.data?.checkout_url) {
      throw new Error(
        `Unable to initialize payment: ${
          typeof response.message === "string"
            ? response.message
            : toErrorMessage(response.message ?? response)
        }`,
      );
    }

    await prisma.payment.update({
      where: {
        provider_providerReference: {
          provider: PaymentProvider.chapa,
          providerReference: txRef,
        },
      },
      data: {
        status: PaymentStatus.processing,
        checkoutUrl: response.data.checkout_url,
      },
      select: { paymentId: true },
    });

    return {
      paymentId: intent.paymentId,
      txRef,
      checkoutUrl: response.data.checkout_url,
      reservationExpiresAt: reservationExpiresAt.toISOString(),
    };
  } catch (error) {
    const failureReason =
      error instanceof Error
        ? error.message
        : `Chapa initialize failed: ${toErrorMessage(error)}`;

    await prisma.payment.update({
      where: {
        provider_providerReference: {
          provider: PaymentProvider.chapa,
          providerReference: txRef,
        },
      },
      data: {
        status: PaymentStatus.failed,
        failureReason,
        verifiedAt: new Date(),
        reservationExpiresAt: null,
      },
    });

    throw new Error(failureReason);
  }
}

export async function confirmChapaPayment(
  payload: ConfirmPayload,
): Promise<ChapaConfirmationResult> {
  const payment = await prisma.payment.findUnique({
    where: {
      provider_providerReference: {
        provider: PaymentProvider.chapa,
        providerReference: payload.txRef,
      },
    },
    include: {
      event: {
        select: {
          eventId: true,
          eventEndtime: true,
          capacity: true,
        },
      },
    },
  });

  if (!payment) throw new Error("Payment not found");
  if (payload.userId && payment.userId !== payload.userId) {
    throw new Error("Payment not found");
  }
  if (payment.status === PaymentStatus.succeeded) {
    return {
      ok: true,
      status: "already_confirmed",
      quantity: 0,
      eventId: payment.eventId,
      alreadyConfirmed: true,
    };
  }
  if (payment.status === PaymentStatus.requires_refund) {
    return {
      ok: false,
      status: "requires_refund",
      quantity: 0,
      eventId: payment.eventId,
      failureReason:
        payment.failureReason ??
        "Payment was captured but the reservation could not be fulfilled.",
    };
  }

  const verification = await verifyChapaTransactionWithRetry(payload.txRef);
  const paidStatus = verification.data?.status?.toLowerCase();
  if (verification.status !== "success" || paidStatus !== "success") {
    await prisma.payment.update({
      where: { paymentId: payment.paymentId },
      data: {
        status: PaymentStatus.failed,
        failureReason: "Payment has not been completed",
        verifiedAt: new Date(),
        reservationExpiresAt: null,
      },
    });
    throw new Error("Payment has not been completed");
  }

  const verifiedAmount = Number(verification.data?.amount);
  if (
    Number.isFinite(verifiedAmount) &&
    Math.abs(verifiedAmount - Number(payment.amountEtb)) > 0.009
  ) {
    await markPaymentRequiresRefund(
      payment.paymentId,
      "Provider verification amount did not match the reserved order amount.",
    );
    return {
      ok: false,
      status: "requires_refund",
      quantity: 0,
      eventId: payment.eventId,
      failureReason:
        "Payment amount verification failed. The order was flagged for manual refund review.",
    };
  }

  if (
    verification.data?.currency &&
    verification.data.currency.toUpperCase() !== payment.currency.toUpperCase()
  ) {
    await markPaymentRequiresRefund(
      payment.paymentId,
      "Provider verification currency did not match the reserved order currency.",
    );
    return {
      ok: false,
      status: "requires_refund",
      quantity: 0,
      eventId: payment.eventId,
      failureReason:
        "Payment currency verification failed. The order was flagged for manual refund review.",
    };
  }

  return prisma.$transaction(async (tx) => {
    await acquireTransactionLock(
      tx,
      "payment-confirm",
      payment.paymentId,
    );

    const latest = await tx.payment.findUnique({
      where: { paymentId: payment.paymentId },
      include: {
        event: {
          select: {
            eventId: true,
            eventName: true,
            eventDatetime: true,
            eventEndtime: true,
            eventLocation: true,
            addressLabel: true,
            latitude: true,
            longitude: true,
            capacity: true,
          },
        },
      },
    });

    if (!latest) throw new Error("Payment not found");
    if (latest.status === PaymentStatus.succeeded) {
      return {
        ok: true,
        status: "already_confirmed",
        quantity: 0,
        eventId: latest.eventId,
        alreadyConfirmed: true,
      } satisfies ChapaConfirmationResult;
    }
    if (latest.status === PaymentStatus.requires_refund) {
      return {
        ok: false,
        status: "requires_refund",
        quantity: 0,
        eventId: latest.eventId,
        failureReason:
          latest.failureReason ??
          "Payment was captured but the reservation could not be fulfilled.",
      } satisfies ChapaConfirmationResult;
    }
    if (!isPaymentPending(latest.status)) {
      throw new Error("Payment can no longer be confirmed");
    }

    const snapshot = await getLockedAvailabilitySnapshot(latest.eventId, tx, {
      excludePaymentId: latest.paymentId,
    });
    if (!snapshot) throw new Error("Event not found");

    const now = new Date();
    const existingTickets =
      typeof tx.eventAttendee?.count === "function"
        ? await tx.eventAttendee.count({
            where: { eventId: latest.eventId, userId: latest.userId },
          })
        : 0;
    if (existingTickets + latest.quantity > MAX_TICKETS_PER_USER_PER_EVENT) {
      const failureReason =
        "Payment succeeded but ticket ownership would exceed the per-user ticket limit.";
      await tx.payment.update({
        where: { paymentId: latest.paymentId },
        data: {
          status: PaymentStatus.requires_refund,
          failureReason,
          verifiedAt: now,
          reservationExpiresAt: null,
        },
      });
      return {
        ok: false,
        status: "requires_refund",
        quantity: 0,
        eventId: latest.eventId,
        failureReason,
      } satisfies ChapaConfirmationResult;
    }

    if (snapshot.event.eventEndtime <= now) {
      const failureReason =
        "Payment succeeded after the event had already ended. Order flagged for refund review.";
      await tx.payment.update({
        where: { paymentId: latest.paymentId },
        data: {
          status: PaymentStatus.requires_refund,
          failureReason,
          verifiedAt: now,
          reservationExpiresAt: null,
        },
      });
      return {
        ok: false,
        status: "requires_refund",
        quantity: 0,
        eventId: latest.eventId,
        failureReason,
      } satisfies ChapaConfirmationResult;
    }

    if (snapshot.spotsLeft != null && latest.quantity > snapshot.spotsLeft) {
      const failureReason =
        "Payment succeeded but the reserved seats are no longer available. Order flagged for refund review.";
      await tx.payment.update({
        where: { paymentId: latest.paymentId },
        data: {
          status: PaymentStatus.requires_refund,
          failureReason,
          verifiedAt: now,
          reservationExpiresAt: null,
        },
      });
      return {
        ok: false,
        status: "requires_refund",
        quantity: 0,
        eventId: latest.eventId,
        failureReason,
      } satisfies ChapaConfirmationResult;
    }

    await tx.eventAttendee.createMany({
      data: Array.from({ length: latest.quantity }).map(() => ({
        eventId: latest.eventId,
        userId: latest.userId,
        status: "RSVPed",
      })),
    });

    await tx.payment.update({
      where: { paymentId: latest.paymentId },
      data: {
        status: PaymentStatus.succeeded,
        verifiedAt: now,
        fulfilledAt: now,
        failureReason: null,
        reservationExpiresAt: null,
      },
    });

    return {
      ok: true,
      status: "fulfilled",
      quantity: latest.quantity,
      eventId: latest.eventId,
      alreadyConfirmed: false,
    } satisfies ChapaConfirmationResult;
  });
}

export async function getPaymentEmailPayloadByReference(
  txRef: string,
  baseUrl: string,
) {
  const payment = await prisma.payment.findUnique({
    where: {
      provider_providerReference: {
        provider: PaymentProvider.chapa,
        providerReference: txRef,
      },
    },
    include: {
      event: {
        select: {
          eventId: true,
          eventName: true,
          eventDatetime: true,
          eventEndtime: true,
          eventLocation: true,
          addressLabel: true,
          latitude: true,
          longitude: true,
        },
      },
    },
  });

  if (!payment || payment.status !== PaymentStatus.succeeded) {
    return null;
  }

  const location = resolveEventLocation(payment.event);
  const attendees = await prisma.eventAttendee.findMany({
    where: { eventId: payment.eventId, userId: payment.userId },
    select: { attendeeId: true },
    orderBy: { createdAt: "desc" },
    take: payment.quantity,
  });

  return {
    quantity: payment.quantity,
    eventId: payment.eventId,
    attendeeIds: attendees.map((a) => a.attendeeId),
    eventName: payment.event.eventName,
    eventDateTime: payment.event.eventDatetime,
    eventEndTime: payment.event.eventEndtime,
    locationLabel: location.addressLabel,
    baseUrl,
  };
}
