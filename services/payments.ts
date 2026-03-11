/**
 * Payments service -- Chapa checkout and balance payment processing.
 *
 * Handles payment creation, confirmation, and status updates.
 */

import { Chapa } from "chapa-nodejs";
import { decodeEventLocation } from "@/app/helpers/locationCodec";
import { sendTicketConfirmationEmail } from "@/services/email";
import { logger } from "@/lib/logger";
import axios from "axios";
import { prisma } from "@/lib/prisma";
import { PaymentStatus } from "@/generated/prisma/client";

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
  userId: string;
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

export async function payWithBalance(params: PayWithBalanceParams): Promise<PayWithBalanceResult> {
  const { eventId, userId, quantity, userEmail, userName, baseUrl } = params;

  const event = await prisma.event.findUnique({
    where: { eventId },
    select: {
      eventId: true,
      eventName: true,
      eventDatetime: true,
      eventEndtime: true,
      eventLocation: true,
      capacity: true,
      priceField: true,
    },
  });

  if (!event) throw new Error("Event not found");
  if (event.eventEndtime <= new Date()) throw new Error("Event has ended");
  if (!event.priceField || event.priceField <= 0) {
    throw new Error("This event does not require payment");
  }
  if (event.capacity != null && quantity > event.capacity) {
    throw new Error("Not enough seats available");
  }

  const totalCost = event.priceField * quantity;

  const userBalance = await prisma.userBalance.findUnique({
    where: { userId },
  });

  const availableBalance = userBalance ? Number(userBalance.balanceEtb) : 0;

  if (availableBalance < totalCost) {
    throw new InsufficientBalanceError(
      availableBalance,
      totalCost,
      totalCost - availableBalance,
    );
  }

  await prisma.$transaction(async (tx) => {
    const bal = await tx.userBalance.findUnique({ where: { userId } });
    if (!bal || Number(bal.balanceEtb) < totalCost) {
      throw new Error("Insufficient balance");
    }

    await tx.userBalance.update({
      where: { userId },
      data: { balanceEtb: { decrement: totalCost } },
    });

    if (event.capacity != null) {
      const updated = await tx.event.updateMany({
        where: { eventId, capacity: { gte: quantity } },
        data: { capacity: { decrement: quantity } },
      });
      if (updated.count === 0) throw new Error("Not enough seats available");
    }

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
        amountEtb: totalCost,
        currency: "ETB",
        status: "succeeded",
        telebirrPrepayId: `BALANCE-${Date.now()}`,
      },
    });
  });

  if (userEmail) {
    const decoded = decodeEventLocation(event.eventLocation);
    const attendees = await prisma.eventAttendee.findMany({
      where: { eventId, userId },
      select: { attendeeId: true },
      orderBy: { createdAt: "desc" },
    });
    try {
      await sendTicketConfirmationEmail({
        to: userEmail,
        buyerName: userName ?? null,
        eventName: event.eventName,
        eventDateTime: event.eventDatetime,
        eventEndTime: event.eventEndtime,
        locationLabel: decoded.addressLabel,
        quantity,
        eventId,
        attendeeIds: attendees.map((a) => a.attendeeId),
        baseUrl,
      });
    } catch (err) {
      logger.error("Failed to send ticket confirmation email", err);
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

function getChapaClient() {
  const secretKey = process.env.CHAPA_SECRET_KEY;
  if (!secretKey) {
    throw new Error("CHAPA_SECRET_KEY is not configured");
  }
  return new Chapa({ secretKey });
}

function getChapaSecretKey() {
  const secretKey = process.env.CHAPA_SECRET_KEY;
  if (!secretKey) throw new Error("CHAPA_SECRET_KEY is not configured");
  return secretKey;
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

export async function initializeChapaCheckout(payload: CheckoutPayload) {
  const event = await prisma.event.findUnique({
    where: { eventId: payload.eventId },
    select: {
      eventId: true,
      eventName: true,
      eventEndtime: true,
      capacity: true,
      priceField: true,
    },
  });

  if (!event) throw new Error("Event not found");
  if (event.eventEndtime <= new Date()) throw new Error("Event has ended");
  if (!event.priceField || event.priceField <= 0) {
    throw new Error("This event does not require payment");
  }

  // capacity in DB is remaining seats (decremented on registration)
  if (event.capacity != null && payload.quantity > event.capacity) {
    throw new Error("Not enough seats available");
  }

  const amount = (event.priceField * payload.quantity).toFixed(2);
  const txRef = getChapaClient().genTxRef({ prefix: "MEDA", size: 20 });
  const secretKey = getChapaSecretKey();
  const returnUrl = `${payload.returnUrlBase}${payload.returnUrlBase.includes("?") ? "&" : "?"}tx_ref=${encodeURIComponent(txRef)}`;
  const customizationTitle =
    (event.eventName || "Meda Event").trim().slice(0, 16) || "Meda Event";

  let response:
    | { status: string; message?: unknown; data?: { checkout_url?: string } }
    | undefined;
  try {
    const httpResponse = await axios.post(
      "https://api.chapa.co/v1/transaction/initialize",
      {
        first_name: payload.firstName?.trim() || "Meda",
        last_name: payload.lastName?.trim() || "User",
        email: payload.email,
        currency: "ETB",
        amount,
        tx_ref: txRef,
        callback_url: payload.callbackUrl,
        return_url: returnUrl,
        customization: {
          title: customizationTitle,
          description: `Ticket purchase for ${event.eventName}`,
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
    response = httpResponse.data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      throw new Error(
        `Chapa initialize failed: ${toErrorMessage(error.response?.data ?? error.message)}`,
      );
    }
    throw new Error(`Chapa initialize failed: ${toErrorMessage(error)}`);
  }
  if (!response) throw new Error("Chapa initialize failed: empty response");

  if (response.status !== "success" || !response.data?.checkout_url) {
    throw new Error(
      `Unable to initialize payment: ${
        typeof response.message === "string"
          ? response.message
          : toErrorMessage(response.message ?? response)
      }`,
    );
  }

  const payment = await prisma.payment.create({
    data: {
      eventId: payload.eventId,
      userId: payload.userId,
      amountEtb: amount,
      currency: "ETB",
      status: PaymentStatus.processing,
      telebirrPrepayId: txRef,
      telebirrCheckoutUrl: response.data.checkout_url,
    },
    select: { paymentId: true },
  });

  return {
    paymentId: payment.paymentId,
    txRef,
    checkoutUrl: response.data.checkout_url,
  };
}

export async function confirmChapaPayment(payload: ConfirmPayload) {
  const payment = await prisma.payment.findFirst({
    where: {
      telebirrPrepayId: payload.txRef,
      userId: payload.userId,
    },
    include: {
      event: {
        select: {
          eventId: true,
          eventEndtime: true,
          capacity: true,
          priceField: true,
        },
      },
    },
  });

  if (!payment) throw new Error("Payment not found");
  if (payment.status === PaymentStatus.succeeded) {
    return {
      ok: true,
      alreadyConfirmed: true as const,
      quantity: 0,
      eventId: payment.eventId,
    };
  }

  const secretKey = getChapaSecretKey();
  let verification:
    | { status: string; message?: unknown; data?: { status?: string } }
    | undefined;
  try {
    const httpResponse = await axios.get(
      `https://api.chapa.co/v1/transaction/verify/${encodeURIComponent(payload.txRef)}`,
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

  const paidStatus = verification.data?.status?.toLowerCase();
  if (verification.status !== "success" || paidStatus !== "success") {
    await prisma.payment.update({
      where: { paymentId: payment.paymentId },
      data: { status: PaymentStatus.failed },
    });
    throw new Error("Payment has not been completed");
  }

  const eventPrice = payment.event.priceField ?? 0;
  const quantity =
    eventPrice > 0 ? Math.max(1, Math.round(Number(payment.amountEtb) / eventPrice)) : 1;

  if (payment.event.eventEndtime <= new Date()) {
    throw new Error("Event has ended");
  }

  // capacity in DB is remaining seats (decremented on registration)
  if (payment.event.capacity != null && quantity > payment.event.capacity) {
    throw new Error("Not enough seats available");
  }

  await prisma.$transaction(async (tx) => {
    const latest = await tx.payment.findUnique({
      where: { paymentId: payment.paymentId },
      select: { status: true },
    });
    if (!latest || latest.status === PaymentStatus.succeeded) return;

    if (payment.event.capacity != null) {
      const updated = await tx.event.updateMany({
        where: {
          eventId: payment.eventId,
          capacity: { gte: quantity },
        },
        data: {
          capacity: { decrement: quantity },
        },
      });
      if (updated.count === 0) throw new Error("Not enough seats available");
    }

    await tx.eventAttendee.createMany({
      data: Array.from({ length: quantity }).map(() => ({
        eventId: payment.eventId,
        userId: payment.userId,
        status: "RSVPed",
      })),
    });

    await tx.payment.update({
      where: { paymentId: payment.paymentId },
      data: { status: PaymentStatus.succeeded },
    });
  });

  return {
    ok: true,
    alreadyConfirmed: false as const,
    quantity,
    eventId: payment.eventId,
  };
}
