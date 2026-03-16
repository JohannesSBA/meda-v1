import { Prisma } from "@/generated/prisma/client";
import {
  getChapaClient,
  initializeChapaTransaction,
  verifyChapaTransactionWithRetry,
} from "@/lib/chapa";
import { acquireTransactionLock } from "@/lib/dbLocks";
import { logger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import { createEventWithClient, type CreateEventParams } from "@/services/events";
import {
  computePromoDiscount,
  consumePromoCode,
  findActivePromoCode,
  type EventCreationPromo,
} from "@/services/promoCode";

const EVENT_CREATION_TX_PREFIX = "MEDAFEE";

export type StoredEventCreationPayload = Omit<CreateEventParams, "image"> & {
  pictureUrl?: string | null;
};

export type EventCreationQuote = {
  baseAmountEtb: number;
  discountAmountEtb: number;
  amountDueEtb: number;
  promo: EventCreationPromo | null;
};

export type EventCreationCheckoutInitResult =
  | {
      kind: "waived";
      quote: EventCreationQuote;
    }
  | {
      kind: "checkout";
      quote: EventCreationQuote;
      paymentId: string;
      txRef: string;
      checkoutUrl: string;
    };

export type EventCreationConfirmationResult =
  | {
      ok: true;
      status: "fulfilled" | "already_confirmed";
      eventId: string;
      createdOccurrences: number;
      alreadyConfirmed: boolean;
    }
  | {
      ok: false;
      status: "failed";
      message: string;
    };

function roundCurrency(value: number) {
  return Math.round(value * 100) / 100;
}

function toNumber(value: Prisma.Decimal | number | string | null | undefined) {
  if (value == null) return 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function toDecimal(value: number) {
  return new Prisma.Decimal(value.toFixed(2));
}

function assertStoredPayload(value: Prisma.JsonValue | null): StoredEventCreationPayload {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Stored event creation payload is invalid");
  }

  const record = value as Record<string, unknown>;

  return {
    userId: String(record.userId ?? ""),
    eventName: String(record.eventName ?? ""),
    categoryId: String(record.categoryId ?? ""),
    description:
      record.description == null ? null : String(record.description),
    startDate: String(record.startDate ?? ""),
    endDate: String(record.endDate ?? ""),
    location: String(record.location ?? ""),
    latitude: String(record.latitude ?? ""),
    longitude: String(record.longitude ?? ""),
    capacity:
      record.capacity == null ? null : Number(record.capacity),
    price:
      record.price == null ? null : Number(record.price),
    pictureUrl:
      typeof record.pictureUrl === "string" ? record.pictureUrl : null,
    recurrenceEnabled: Boolean(record.recurrenceEnabled),
    recurrenceFrequency:
      record.recurrenceFrequency === "daily" ||
      record.recurrenceFrequency === "weekly" ||
      record.recurrenceFrequency === "custom"
        ? record.recurrenceFrequency
        : undefined,
    recurrenceInterval:
      record.recurrenceInterval == null
        ? undefined
        : Number(record.recurrenceInterval),
    recurrenceUntil:
      typeof record.recurrenceUntil === "string"
        ? record.recurrenceUntil
        : undefined,
    recurrenceWeekdays:
      typeof record.recurrenceWeekdays === "string"
        ? record.recurrenceWeekdays
        : undefined,
  };
}

function isValidStoredPayload(payload: StoredEventCreationPayload) {
  return Boolean(
    payload.userId &&
      payload.eventName &&
      payload.categoryId &&
      payload.startDate &&
      payload.endDate &&
      payload.location &&
      payload.latitude &&
      payload.longitude,
  );
}

export async function getActiveEventCreationFeeConfig(now = new Date()) {
  return prisma.eventCreationFeeConfig.findFirst({
    where: {
      effectiveFrom: { lte: now },
      OR: [{ effectiveTo: null }, { effectiveTo: { gt: now } }],
    },
    orderBy: { effectiveFrom: "desc" },
  });
}

export async function getCurrentEventCreationFee() {
  const config = await getActiveEventCreationFeeConfig();
  return config
    ? {
        id: config.id,
        amountEtb: toNumber(config.amountEtb),
        effectiveFrom: config.effectiveFrom.toISOString(),
        effectiveTo: config.effectiveTo?.toISOString() ?? null,
      }
    : null;
}

export async function setEventCreationFeeAmount(amountEtb: number) {
  const now = new Date();

  const created = await prisma.$transaction(async (tx) => {
    await tx.eventCreationFeeConfig.updateMany({
      where: {
        effectiveTo: null,
        effectiveFrom: { lte: now },
      },
      data: {
        effectiveTo: now,
      },
    });

    return tx.eventCreationFeeConfig.create({
      data: {
        amountEtb: toDecimal(amountEtb),
        effectiveFrom: now,
      },
    });
  });

  return {
    id: created.id,
    amountEtb: toNumber(created.amountEtb),
    effectiveFrom: created.effectiveFrom.toISOString(),
    effectiveTo: created.effectiveTo?.toISOString() ?? null,
  };
}

export async function getEventCreationQuote(args: {
  pitchOwnerUserId: string;
  promoCode?: string | null;
}) {
  const [config, promo] = await Promise.all([
    getActiveEventCreationFeeConfig(),
    findActivePromoCode(prisma, {
      code: args.promoCode,
      pitchOwnerUserId: args.pitchOwnerUserId,
    }),
  ]);

  const baseAmountEtb = roundCurrency(toNumber(config?.amountEtb));
  const discountAmountEtb = roundCurrency(
    Math.min(baseAmountEtb, computePromoDiscount(baseAmountEtb, promo)),
  );
  const amountDueEtb = roundCurrency(
    Math.max(0, baseAmountEtb - discountAmountEtb),
  );

  return {
    baseAmountEtb,
    discountAmountEtb,
    amountDueEtb,
    promo,
  } satisfies EventCreationQuote;
}

export async function initializeEventCreationCheckout(args: {
  pitchOwnerUserId: string;
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  callbackUrl: string;
  returnUrlBase: string;
  promoCode?: string | null;
  eventPayload: StoredEventCreationPayload;
}) {
  const quote = await getEventCreationQuote({
    pitchOwnerUserId: args.pitchOwnerUserId,
    promoCode: args.promoCode,
  });

  if (quote.amountDueEtb <= 0) {
    return {
      kind: "waived",
      quote,
    } satisfies EventCreationCheckoutInitResult;
  }

  const txRef = getChapaClient().genTxRef({
    prefix: EVENT_CREATION_TX_PREFIX,
    size: 20,
  });
  const payment = await prisma.eventCreationPayment.create({
    data: {
      pitchOwnerUserId: args.pitchOwnerUserId,
      amountEtb: toDecimal(quote.amountDueEtb),
      promoCodeId: quote.promo?.id ?? null,
      status: "pending",
      providerReference: txRef,
      eventPayloadJson: args.eventPayload as Prisma.InputJsonValue,
    },
    select: { id: true },
  });

  const returnUrl = `${args.returnUrlBase}${args.returnUrlBase.includes("?") ? "&" : "?"}tx_ref=${encodeURIComponent(txRef)}`;
  const title =
    args.eventPayload.eventName.trim().slice(0, 16) || "Event fee";

  try {
    const response = await initializeChapaTransaction({
      first_name: args.firstName?.trim() || "Meda",
      last_name: args.lastName?.trim() || "Host",
      email: args.email,
      currency: "ETB",
      amount: quote.amountDueEtb.toFixed(2),
      tx_ref: txRef,
      callback_url: args.callbackUrl,
      return_url: returnUrl,
      customization: {
        title,
        description: `Event creation fee for ${args.eventPayload.eventName}`,
      },
    });

    if (response.status !== "success" || !response.data?.checkout_url) {
      throw new Error(
        typeof response.message === "string"
          ? response.message
          : "Unable to initialize event creation payment",
      );
    }

    return {
      kind: "checkout",
      quote,
      paymentId: payment.id,
      txRef,
      checkoutUrl: response.data.checkout_url,
    } satisfies EventCreationCheckoutInitResult;
  } catch (error) {
    await prisma.eventCreationPayment.update({
      where: { id: payment.id },
      data: {
        status: "failed",
      },
    });
    throw error;
  }
}

export async function recordWaivedEventCreation(args: {
  pitchOwnerUserId: string;
  eventId: string;
  quote: EventCreationQuote;
}) {
  return prisma.$transaction(async (tx) => {
    if (args.quote.promo?.id) {
      await consumePromoCode(tx, args.quote.promo.id);
    }

    return tx.eventCreationPayment.create({
      data: {
        pitchOwnerUserId: args.pitchOwnerUserId,
        eventId: args.eventId,
        amountEtb: toDecimal(args.quote.amountDueEtb),
        promoCodeId: args.quote.promo?.id ?? null,
        status: "waived",
        paidAt: new Date(),
      },
    });
  });
}

export async function confirmChapaEventCreationPayment(args: {
  txRef: string;
  pitchOwnerUserId?: string | null;
}) {
  const payment = await prisma.eventCreationPayment.findFirst({
    where: { providerReference: args.txRef },
  });

  if (!payment) {
    throw new Error("Event creation payment not found");
  }
  if (args.pitchOwnerUserId && payment.pitchOwnerUserId !== args.pitchOwnerUserId) {
    throw new Error("Event creation payment not found");
  }
  if ((payment.status === "paid" || payment.status === "waived") && payment.eventId) {
    return {
      ok: true,
      status: "already_confirmed",
      eventId: payment.eventId,
      createdOccurrences: 0,
      alreadyConfirmed: true,
    } satisfies EventCreationConfirmationResult;
  }

  const verification = await verifyChapaTransactionWithRetry(args.txRef);
  const paidStatus = verification.data?.status?.toLowerCase();
  if (verification.status !== "success" || paidStatus !== "success") {
    await prisma.eventCreationPayment.update({
      where: { id: payment.id },
      data: { status: "failed" },
    });

    return {
      ok: false,
      status: "failed",
      message: "Event creation payment has not been completed",
    } satisfies EventCreationConfirmationResult;
  }

  const verifiedAmount = Number(verification.data?.amount);
  if (
    Number.isFinite(verifiedAmount) &&
    Math.abs(verifiedAmount - toNumber(payment.amountEtb)) > 0.009
  ) {
    await prisma.eventCreationPayment.update({
      where: { id: payment.id },
      data: { status: "failed" },
    });
    return {
      ok: false,
      status: "failed",
      message: "Event creation payment amount verification failed",
    } satisfies EventCreationConfirmationResult;
  }

  if (
    verification.data?.currency &&
    verification.data.currency.toUpperCase() !== "ETB"
  ) {
    await prisma.eventCreationPayment.update({
      where: { id: payment.id },
      data: { status: "failed" },
    });
    return {
      ok: false,
      status: "failed",
      message: "Event creation payment currency verification failed",
    } satisfies EventCreationConfirmationResult;
  }

  return prisma.$transaction(async (tx) => {
    await acquireTransactionLock(tx, "event-creation-confirm", payment.id);

    const latest = await tx.eventCreationPayment.findUnique({
      where: { id: payment.id },
    });
    if (!latest) {
      throw new Error("Event creation payment not found");
    }
    if ((latest.status === "paid" || latest.status === "waived") && latest.eventId) {
      return {
        ok: true,
        status: "already_confirmed",
        eventId: latest.eventId,
        createdOccurrences: 0,
        alreadyConfirmed: true,
      } satisfies EventCreationConfirmationResult;
    }
    if (latest.status === "failed") {
      return {
        ok: false,
        status: "failed",
        message: "Event creation payment can no longer be confirmed",
      } satisfies EventCreationConfirmationResult;
    }

    const storedPayload = assertStoredPayload(latest.eventPayloadJson);
    if (!isValidStoredPayload(storedPayload)) {
      logger.error("Invalid stored event creation payload", {
        paymentId: latest.id,
      });
      throw new Error("Stored event creation payload is invalid");
    }

    const result = await createEventWithClient(tx, {
      ...storedPayload,
      image: null,
    });

    if (latest.promoCodeId) {
      await consumePromoCode(tx, latest.promoCodeId);
    }

    await tx.eventCreationPayment.update({
      where: { id: latest.id },
      data: {
        status: "paid",
        eventId: result.event.eventId,
        paidAt: new Date(),
      },
    });

    return {
      ok: true,
      status: "fulfilled",
      eventId: result.event.eventId,
      createdOccurrences: result.createdOccurrences ?? 1,
      alreadyConfirmed: false,
    } satisfies EventCreationConfirmationResult;
  });
}
