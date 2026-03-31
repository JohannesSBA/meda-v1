import { randomUUID } from "crypto";
import {
  OwnerSubscriptionStatus,
  Prisma,
} from "@/generated/prisma/client";
import {
  getChapaClient,
  initializeChapaTransaction,
  verifyChapaTransactionWithRetry,
} from "@/lib/chapa";
import {
  OWNER_SUBSCRIPTION_DURATION_DAYS,
  OWNER_SUBSCRIPTION_FEE_ETB,
  OWNER_SUBSCRIPTION_GRACE_DAYS,
  OWNER_SUBSCRIPTION_PLAN_CODE,
} from "@/lib/constants";
import { acquireTransactionLock } from "@/lib/dbLocks";
import { getAppBaseUrl } from "@/lib/env";
import { getAuthUserEmails } from "@/lib/auth/userLookup";
import { logger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import {
  sendActionNotificationEmail,
  sendSubscriptionNoticeEmail,
} from "@/services/email";

const SUBSCRIPTION_TX_PREFIX = "MEDASUB";
const EXPIRING_SOON_DAYS = 7;
const DAY_MS = 24 * 60 * 60 * 1000;

type TransactionClient = Prisma.TransactionClient;

const subscriptionInclude = {
  pitch: {
    select: {
      id: true,
      name: true,
    },
  },
} satisfies Prisma.PitchSubscriptionInclude;

type SubscriptionRecord = Prisma.PitchSubscriptionGetPayload<{
  include: typeof subscriptionInclude;
}>;

type PendingSubscriptionPaymentMetadata = {
  ownerId: string;
  pitchId: string | null;
  planCode: string;
  operation: "start" | "renew";
  amountEtb: number;
};

export type OwnerSubscriptionSummary = {
  id: string;
  ownerId: string;
  pitchId: string | null;
  pitchName: string | null;
  status: OwnerSubscriptionStatus;
  startsAt: string;
  endsAt: string;
  renewalAt: string | null;
  providerRef: string | null;
  planCode: string;
  entitlementActive: boolean;
  daysRemaining: number;
  graceEndsAt: string | null;
  gracePeriodActive: boolean;
  graceDaysRemaining: number;
  feeAmountEtb: number;
} | null;

export type OwnerSubscriptionMutationResult = {
  subscription: OwnerSubscriptionSummary;
  checkoutUrl: string | null;
  txRef: string | null;
  feeAmountEtb: number;
  paymentMethod: "balance" | "chapa";
};

export type OwnerSubscriptionConfirmationResult =
  | {
      ok: true;
      status: "confirmed" | "already_confirmed";
      subscription: OwnerSubscriptionSummary;
    }
  | {
      ok: false;
      status: "processing" | "failed";
      subscription: OwnerSubscriptionSummary;
    };

function addDays(date: Date, days: number) {
  return new Date(date.getTime() + days * DAY_MS);
}

function normalizePlanCode(planCode?: string | null) {
  const normalized = planCode?.trim();
  return normalized || OWNER_SUBSCRIPTION_PLAN_CODE;
}

function daysUntil(target: Date, now: Date) {
  return Math.max(0, Math.ceil((target.getTime() - now.getTime()) / DAY_MS));
}

function computeDerivedState(
  subscription: Pick<SubscriptionRecord, "status" | "endsAt">,
  now: Date,
) {
  const graceEndsAt = addDays(subscription.endsAt, OWNER_SUBSCRIPTION_GRACE_DAYS);
  const gracePeriodActive =
    subscription.status === OwnerSubscriptionStatus.PAST_DUE &&
    graceEndsAt.getTime() > now.getTime();
  const entitlementActive =
    ((subscription.status === OwnerSubscriptionStatus.ACTIVE ||
      subscription.status === OwnerSubscriptionStatus.TRIAL) &&
      subscription.endsAt.getTime() > now.getTime()) ||
    gracePeriodActive;

  return {
    graceEndsAt,
    gracePeriodActive,
    entitlementActive,
    daysRemaining: entitlementActive
      ? gracePeriodActive
        ? daysUntil(graceEndsAt, now)
        : daysUntil(subscription.endsAt, now)
      : 0,
    graceDaysRemaining: gracePeriodActive ? daysUntil(graceEndsAt, now) : 0,
  };
}

function getExpectedStatus(
  subscription: Pick<SubscriptionRecord, "status" | "endsAt">,
  now: Date,
) {
  if (
    subscription.status === OwnerSubscriptionStatus.CANCELLED ||
    subscription.status === OwnerSubscriptionStatus.EXPIRED
  ) {
    return subscription.status;
  }

  const graceEndsAt = addDays(subscription.endsAt, OWNER_SUBSCRIPTION_GRACE_DAYS);
  if (
    (subscription.status === OwnerSubscriptionStatus.ACTIVE ||
      subscription.status === OwnerSubscriptionStatus.TRIAL) &&
    subscription.endsAt.getTime() <= now.getTime()
  ) {
    return graceEndsAt.getTime() > now.getTime()
      ? OwnerSubscriptionStatus.PAST_DUE
      : OwnerSubscriptionStatus.EXPIRED;
  }

  if (
    subscription.status === OwnerSubscriptionStatus.PAST_DUE &&
    graceEndsAt.getTime() <= now.getTime()
  ) {
    return OwnerSubscriptionStatus.EXPIRED;
  }

  return subscription.status;
}

function serializeSubscription(
  subscription: SubscriptionRecord | null,
  now = new Date(),
): OwnerSubscriptionSummary {
  if (!subscription) return null;

  const derived = computeDerivedState(subscription, now);
  return {
    id: subscription.id,
    ownerId: subscription.ownerId,
    pitchId: subscription.pitchId ?? null,
    pitchName: subscription.pitch?.name ?? null,
    status: subscription.status,
    startsAt: subscription.startsAt.toISOString(),
    endsAt: subscription.endsAt.toISOString(),
    renewalAt: subscription.renewalAt?.toISOString() ?? null,
    providerRef: subscription.providerRef ?? null,
    planCode: subscription.planCode,
    entitlementActive: derived.entitlementActive,
    daysRemaining: derived.daysRemaining,
    graceEndsAt: derived.graceEndsAt.toISOString(),
    gracePeriodActive: derived.gracePeriodActive,
    graceDaysRemaining: derived.graceDaysRemaining,
    feeAmountEtb: OWNER_SUBSCRIPTION_FEE_ETB,
  };
}

function parsePendingPaymentMetadata(
  value: Prisma.JsonValue | null,
): PendingSubscriptionPaymentMetadata | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const record = value as Record<string, unknown>;
  const ownerId = typeof record.ownerId === "string" ? record.ownerId : null;
  const pitchId =
    typeof record.pitchId === "string"
      ? record.pitchId
      : record.pitchId === null
        ? null
        : null;
  const planCode = typeof record.planCode === "string" ? record.planCode : null;
  const operation =
    record.operation === "start" || record.operation === "renew"
      ? record.operation
      : null;
  const amountEtb = Number(record.amountEtb);

  if (!ownerId || !planCode || !operation || !Number.isFinite(amountEtb)) {
    return null;
  }

  return {
    ownerId,
    pitchId,
    planCode,
    operation,
    amountEtb,
  };
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

async function hasHostActivityLogTx(args: {
  tx: TransactionClient;
  ownerId: string;
  entityType: string;
  entityId: string;
  action: string;
}) {
  const existing = await args.tx.hostActivityLog.findFirst({
    where: {
      ownerId: args.ownerId,
      entityType: args.entityType,
      entityId: args.entityId,
      action: args.action,
    },
    select: { id: true },
  });

  return Boolean(existing);
}

async function getLatestSubscriptionTx(
  tx: TransactionClient,
  ownerId: string,
) {
  return tx.pitchSubscription.findFirst({
    where: { ownerId },
    include: subscriptionInclude,
    orderBy: [{ endsAt: "desc" }, { createdAt: "desc" }],
  });
}

async function syncSubscriptionStateTx(
  tx: TransactionClient,
  subscription: SubscriptionRecord,
  now: Date,
) {
  const nextStatus = getExpectedStatus(subscription, now);
  if (nextStatus === subscription.status) {
    return subscription;
  }

  return tx.pitchSubscription.update({
    where: { id: subscription.id },
    data: {
      status: nextStatus,
      renewalAt:
        nextStatus === OwnerSubscriptionStatus.EXPIRED ? null : subscription.renewalAt,
    },
    include: subscriptionInclude,
  });
}

async function getCurrentSubscriptionTx(
  tx: TransactionClient,
  ownerId: string,
  now = new Date(),
) {
  const subscription = await getLatestSubscriptionTx(tx, ownerId);
  if (!subscription) return null;
  return syncSubscriptionStateTx(tx, subscription, now);
}

async function ensureSufficientBalanceTx(args: {
  tx: TransactionClient;
  userId: string;
  amount: number;
}) {
  const balanceRecord = await args.tx.userBalance.findUnique({
    where: { userId: args.userId },
    select: { balanceEtb: true },
  });
  const available = Number(balanceRecord?.balanceEtb ?? 0);

  if (available < args.amount) {
    throw new Error(
      `Insufficient balance. Available ETB ${available.toFixed(2)}, required ETB ${args.amount.toFixed(2)}.`,
    );
  }

  await args.tx.userBalance.update({
    where: { userId: args.userId },
    data: {
      balanceEtb: {
        decrement: args.amount,
      },
    },
  });
}

async function sendSubscriptionReceipt(args: {
  ownerId: string;
  subject: string;
  title: string;
  message: string;
  renewalDate?: Date | null;
  graceEndsAt?: Date | null;
}) {
  const users = await getAuthUserEmails([args.ownerId]);
  const owner = users.get(args.ownerId);
  if (!owner?.email) {
    return false;
  }

  try {
    await sendSubscriptionNoticeEmail({
      to: owner.email,
      userName: owner.name,
      subject: args.subject,
      title: args.title,
      message: args.message,
      planLabel: "Meda host plan",
      amountEtb: OWNER_SUBSCRIPTION_FEE_ETB,
      renewalDate: args.renewalDate ?? null,
      graceEndsAt: args.graceEndsAt ?? null,
      ctaUrl: `${getAppBaseUrl()}/host`,
    });
    return true;
  } catch (error) {
    logger.error("Failed to send subscription notice", {
      error,
      ownerId: args.ownerId,
      subject: args.subject,
    });
    return false;
  }
}

async function sendPendingPaymentReceipt(args: {
  ownerId: string;
  operation: "start" | "renew";
}) {
  const users = await getAuthUserEmails([args.ownerId]);
  const owner = users.get(args.ownerId);
  if (!owner?.email) {
    return false;
  }

  try {
    await sendActionNotificationEmail({
      to: owner.email,
      userName: owner.name,
      subject:
        args.operation === "start"
          ? "Finish paying for your Meda host plan"
          : "Finish renewing your Meda host plan",
      title:
        args.operation === "start"
          ? "Your host plan payment is waiting"
          : "Your host plan renewal payment is waiting",
      message:
        args.operation === "start"
          ? "Finish the subscription fee payment to turn on your host plan."
          : "Finish the subscription fee payment to renew your host plan.",
      details: [
        { label: "Fee", value: `ETB ${OWNER_SUBSCRIPTION_FEE_ETB.toFixed(2)}` },
        { label: "Grace period", value: `${OWNER_SUBSCRIPTION_GRACE_DAYS} days` },
      ],
      ctaLabel: "Open Host",
      ctaUrl: `${getAppBaseUrl()}/host`,
    });
    return true;
  } catch (error) {
    logger.error("Failed to send pending subscription payment email", {
      error,
      ownerId: args.ownerId,
      operation: args.operation,
    });
    return false;
  }
}

async function applyPaidSubscriptionMutationTx(args: {
  tx: TransactionClient;
  ownerId: string;
  pitchId?: string | null;
  planCode?: string | null;
  providerRef?: string | null;
  operation: "start" | "renew";
  now?: Date;
}) {
  const now = args.now ?? new Date();
  await acquireTransactionLock(args.tx, "owner-subscription", args.ownerId);

  const current = await getCurrentSubscriptionTx(args.tx, args.ownerId, now);
  const currentSummary = serializeSubscription(current, now);

  if (args.operation === "start" && currentSummary?.entitlementActive) {
    throw new Error("Your host plan is already active.");
  }

  const baseStart =
    args.operation === "renew" &&
    current?.status === OwnerSubscriptionStatus.ACTIVE &&
    current.endsAt.getTime() > now.getTime()
      ? current.startsAt
      : now;
  const baseEnd =
    args.operation === "renew" &&
    current?.status === OwnerSubscriptionStatus.ACTIVE &&
    current.endsAt.getTime() > now.getTime()
      ? current.endsAt
      : now;
  const endsAt = addDays(baseEnd, OWNER_SUBSCRIPTION_DURATION_DAYS);

  const payload = {
    ownerId: args.ownerId,
    pitchId: args.pitchId ?? current?.pitchId ?? null,
    status: OwnerSubscriptionStatus.ACTIVE,
    startsAt: baseStart,
    endsAt,
    renewalAt: endsAt,
    providerRef: args.providerRef ?? null,
    planCode: normalizePlanCode(args.planCode),
  };

  const next =
    current
      ? await args.tx.pitchSubscription.update({
          where: { id: current.id },
          data: payload,
          include: subscriptionInclude,
        })
      : await args.tx.pitchSubscription.create({
          data: payload,
          include: subscriptionInclude,
        });

  await logOwnerActivityTx({
    tx: args.tx,
    ownerId: args.ownerId,
    pitchId: next.pitchId,
    entityType: "subscription",
    entityId: next.id,
    action:
      args.operation === "start" ? "subscription.started" : "subscription.renewed",
    metadata: {
      amountEtb: OWNER_SUBSCRIPTION_FEE_ETB,
      providerRef: args.providerRef ?? null,
      planCode: next.planCode,
      endsAt: next.endsAt.toISOString(),
    },
  });

  return next;
}

async function createSubscriptionCheckout(args: {
  ownerId: string;
  pitchId?: string | null;
  planCode?: string | null;
  operation: "start" | "renew";
  callbackUrl: string;
  returnUrlBase: string;
}) {
  const users = await getAuthUserEmails([args.ownerId]);
  const owner = users.get(args.ownerId);
  if (!owner?.email) {
    throw new Error("Your account needs an email address before you can pay for a host plan.");
  }

  const txRef = getChapaClient().genTxRef({
    prefix: SUBSCRIPTION_TX_PREFIX,
    size: 20,
  });
  const planCode = normalizePlanCode(args.planCode);

  await prisma.$transaction(async (tx) => {
    await acquireTransactionLock(tx, "owner-subscription-payment", args.ownerId);
    await logOwnerActivityTx({
      tx,
      ownerId: args.ownerId,
      pitchId: args.pitchId ?? null,
      entityType: "subscription_payment",
      entityId: txRef,
      action: "subscription.payment_pending",
      metadata: {
        ownerId: args.ownerId,
        pitchId: args.pitchId ?? null,
        planCode,
        operation: args.operation,
        amountEtb: OWNER_SUBSCRIPTION_FEE_ETB,
      },
    });
  });

  const returnUrl = `${args.returnUrlBase}${
    args.returnUrlBase.includes("?") ? "&" : "?"
  }subscription_tx_ref=${encodeURIComponent(txRef)}`;

  const response = await initializeChapaTransaction({
    first_name: owner.name?.trim() || "Meda",
    last_name: "Host",
    email: owner.email,
    currency: "ETB",
    amount: OWNER_SUBSCRIPTION_FEE_ETB.toFixed(2),
    tx_ref: txRef,
    callback_url: args.callbackUrl,
    return_url: returnUrl,
    customization: {
      title: "Meda Host Plan",
      description:
        args.operation === "start"
          ? "Monthly host plan subscription"
          : "Monthly host plan renewal",
    },
  });

  if (response.status !== "success" || !response.data?.checkout_url) {
    throw new Error("Unable to start checkout for the host plan.");
  }

  await sendPendingPaymentReceipt({
    ownerId: args.ownerId,
    operation: args.operation,
  });

  return {
    txRef,
    checkoutUrl: response.data.checkout_url,
  };
}

export async function getCurrentOwnerSubscription(ownerId: string) {
  const now = new Date();
  const subscription = await prisma.$transaction((tx) =>
    getCurrentSubscriptionTx(tx, ownerId, now),
  );
  return serializeSubscription(subscription, now);
}

export async function hasActiveOwnerSubscription(ownerId: string) {
  const subscription = await getCurrentOwnerSubscription(ownerId);
  return Boolean(subscription?.entitlementActive);
}

export async function requireActiveOwnerSubscription(ownerId: string) {
  const subscription = await getCurrentOwnerSubscription(ownerId);
  if (subscription?.entitlementActive) {
    return subscription;
  }

  if (subscription?.status === OwnerSubscriptionStatus.PAST_DUE) {
    throw new Error(
      "Your host plan is in its 15-day grace period. Renew it now to keep adding and editing booking times.",
    );
  }

  throw new Error(
    "Your host plan is inactive. Start or renew it before you add or change booking times.",
  );
}

export async function startOwnerSubscription(args: {
  ownerId: string;
  pitchId?: string | null;
  planCode?: string | null;
  providerRef?: string | null;
  paymentMethod: "balance" | "chapa";
  callbackUrl?: string;
  returnUrlBase?: string;
}): Promise<OwnerSubscriptionMutationResult> {
  if (args.paymentMethod === "chapa") {
    if (!args.callbackUrl || !args.returnUrlBase) {
      throw new Error("Checkout URLs are required for Chapa subscription payments.");
    }

    const current = await getCurrentOwnerSubscription(args.ownerId);
    if (current?.entitlementActive) {
      throw new Error("Your host plan is already active.");
    }

    const checkout = await createSubscriptionCheckout({
      ownerId: args.ownerId,
      pitchId: args.pitchId,
      planCode: args.planCode,
      operation: "start",
      callbackUrl: args.callbackUrl,
      returnUrlBase: args.returnUrlBase,
    });

    return {
      subscription: current,
      checkoutUrl: checkout.checkoutUrl,
      txRef: checkout.txRef,
      feeAmountEtb: OWNER_SUBSCRIPTION_FEE_ETB,
      paymentMethod: args.paymentMethod,
    };
  }

  const next = await prisma.$transaction(async (tx) => {
    await ensureSufficientBalanceTx({
      tx,
      userId: args.ownerId,
      amount: OWNER_SUBSCRIPTION_FEE_ETB,
    });

    return applyPaidSubscriptionMutationTx({
      tx,
      ownerId: args.ownerId,
      pitchId: args.pitchId,
      planCode: args.planCode,
      providerRef: args.providerRef ?? `BALANCE-${randomUUID()}`,
      operation: "start",
    });
  });

  await sendSubscriptionReceipt({
    ownerId: args.ownerId,
    subject: "Your Meda host plan is active",
    title: "Your host plan is active",
    message: `We charged ETB ${OWNER_SUBSCRIPTION_FEE_ETB.toFixed(2)} to start your host plan. You can now keep publishing booking times.`,
    renewalDate: next.endsAt,
  });

  return {
    subscription: serializeSubscription(next),
    checkoutUrl: null,
    txRef: null,
    feeAmountEtb: OWNER_SUBSCRIPTION_FEE_ETB,
    paymentMethod: args.paymentMethod,
  };
}

export async function renewOwnerSubscription(args: {
  ownerId: string;
  pitchId?: string | null;
  planCode?: string | null;
  providerRef?: string | null;
  paymentMethod: "balance" | "chapa";
  callbackUrl?: string;
  returnUrlBase?: string;
}): Promise<OwnerSubscriptionMutationResult> {
  if (args.paymentMethod === "chapa") {
    if (!args.callbackUrl || !args.returnUrlBase) {
      throw new Error("Checkout URLs are required for Chapa subscription payments.");
    }

    const checkout = await createSubscriptionCheckout({
      ownerId: args.ownerId,
      pitchId: args.pitchId,
      planCode: args.planCode,
      operation: "renew",
      callbackUrl: args.callbackUrl,
      returnUrlBase: args.returnUrlBase,
    });

    return {
      subscription: await getCurrentOwnerSubscription(args.ownerId),
      checkoutUrl: checkout.checkoutUrl,
      txRef: checkout.txRef,
      feeAmountEtb: OWNER_SUBSCRIPTION_FEE_ETB,
      paymentMethod: args.paymentMethod,
    };
  }

  const next = await prisma.$transaction(async (tx) => {
    await ensureSufficientBalanceTx({
      tx,
      userId: args.ownerId,
      amount: OWNER_SUBSCRIPTION_FEE_ETB,
    });

    return applyPaidSubscriptionMutationTx({
      tx,
      ownerId: args.ownerId,
      pitchId: args.pitchId,
      planCode: args.planCode,
      providerRef: args.providerRef ?? `BALANCE-${randomUUID()}`,
      operation: "renew",
    });
  });

  await sendSubscriptionReceipt({
    ownerId: args.ownerId,
    subject: "Your Meda host plan was renewed",
    title: "Your host plan was renewed",
    message: `We charged ETB ${OWNER_SUBSCRIPTION_FEE_ETB.toFixed(2)} to renew your host plan.`,
    renewalDate: next.endsAt,
  });

  return {
    subscription: serializeSubscription(next),
    checkoutUrl: null,
    txRef: null,
    feeAmountEtb: OWNER_SUBSCRIPTION_FEE_ETB,
    paymentMethod: args.paymentMethod,
  };
}

export async function cancelOwnerSubscription(ownerId: string) {
  const next = await prisma.$transaction(async (tx) => {
    const current = await getCurrentSubscriptionTx(tx, ownerId, new Date());
    if (!current) {
      return null;
    }

    const updated = await tx.pitchSubscription.update({
      where: { id: current.id },
      data: {
        status: OwnerSubscriptionStatus.CANCELLED,
        renewalAt: null,
      },
      include: subscriptionInclude,
    });

    await logOwnerActivityTx({
      tx,
      ownerId,
      pitchId: updated.pitchId,
      entityType: "subscription",
      entityId: updated.id,
      action: "subscription.cancelled",
    });

    return updated;
  });

  if (next) {
    await sendSubscriptionReceipt({
      ownerId,
      subject: "Your Meda host plan was stopped",
      title: "Your host plan was stopped",
      message:
        "Your host plan is now inactive. Your saved places and booking times stay in Meda, but you need an active plan to keep managing them.",
    });
  }

  return serializeSubscription(next);
}

export async function confirmOwnerSubscriptionPayment(args: {
  txRef: string;
  ownerId?: string | null;
}): Promise<OwnerSubscriptionConfirmationResult> {
  const existing = await prisma.pitchSubscription.findFirst({
    where: { providerRef: args.txRef },
    include: subscriptionInclude,
    orderBy: [{ updatedAt: "desc" }],
  });

  if (existing) {
    if (args.ownerId && existing.ownerId !== args.ownerId) {
      throw new Error("Subscription payment not found");
    }

    return {
      ok: true,
      status: "already_confirmed",
      subscription: serializeSubscription(existing),
    };
  }

  const pending = await prisma.hostActivityLog.findFirst({
    where: {
      entityType: "subscription_payment",
      entityId: args.txRef,
      action: "subscription.payment_pending",
    },
    orderBy: [{ createdAt: "desc" }],
  });

  const metadata = parsePendingPaymentMetadata(
    (pending?.metadataJson as Prisma.JsonValue | null) ?? null,
  );
  if (!pending || !metadata) {
    throw new Error("Subscription payment not found");
  }
  if (args.ownerId && metadata.ownerId !== args.ownerId) {
    throw new Error("Subscription payment not found");
  }

  const verification = await verifyChapaTransactionWithRetry(args.txRef);
  const providerStatus = verification.data?.status?.toLowerCase() ?? "";
  if (providerStatus !== "success") {
    return {
      ok: false,
      status: providerStatus === "failed" ? "failed" : "processing",
      subscription: await getCurrentOwnerSubscription(metadata.ownerId),
    };
  }

  const verifiedAmount = Number(verification.data?.amount);
  if (
    Number.isFinite(verifiedAmount) &&
    Math.abs(verifiedAmount - OWNER_SUBSCRIPTION_FEE_ETB) > 0.009
  ) {
    throw new Error("Verified subscription amount did not match the plan fee.");
  }

  if (
    verification.data?.currency &&
    verification.data.currency.toUpperCase() !== "ETB"
  ) {
    throw new Error("Verified subscription currency did not match ETB.");
  }

  const next = await prisma.$transaction(async (tx) => {
    const latestExisting = await tx.pitchSubscription.findFirst({
      where: { providerRef: args.txRef },
      include: subscriptionInclude,
      orderBy: [{ updatedAt: "desc" }],
    });
    if (latestExisting) {
      return latestExisting;
    }

    return applyPaidSubscriptionMutationTx({
      tx,
      ownerId: metadata.ownerId,
      pitchId: metadata.pitchId,
      planCode: metadata.planCode,
      providerRef: args.txRef,
      operation: metadata.operation,
    });
  });

  await sendSubscriptionReceipt({
    ownerId: metadata.ownerId,
    subject:
      metadata.operation === "start"
        ? "Your Meda host plan is active"
        : "Your Meda host plan was renewed",
    title:
      metadata.operation === "start"
        ? "Your host plan is active"
        : "Your host plan was renewed",
    message:
      metadata.operation === "start"
        ? `We received your ETB ${OWNER_SUBSCRIPTION_FEE_ETB.toFixed(2)} host plan payment.`
        : `We received your ETB ${OWNER_SUBSCRIPTION_FEE_ETB.toFixed(2)} host plan renewal payment.`,
    renewalDate: next.endsAt,
  });

  return {
    ok: true,
    status: "confirmed",
    subscription: serializeSubscription(next),
  };
}

export async function expireOwnerSubscriptions(now = new Date()) {
  const subscriptions = await prisma.pitchSubscription.findMany({
    where: {
      status: {
        in: [
          OwnerSubscriptionStatus.ACTIVE,
          OwnerSubscriptionStatus.TRIAL,
          OwnerSubscriptionStatus.PAST_DUE,
        ],
      },
    },
    include: subscriptionInclude,
    orderBy: [{ endsAt: "asc" }, { createdAt: "asc" }],
  });

  let reminderCount = 0;
  let pastDueCount = 0;
  let expiredCount = 0;

  for (const subscription of subscriptions) {
    const result = await prisma.$transaction(async (tx) => {
      const synced = await syncSubscriptionStateTx(tx, subscription, now);
      const summary = serializeSubscription(synced, now);
      if (!summary) {
        return {
          summary: null,
          notice: null as null | "expiring_soon" | "grace_started" | "expired",
        };
      }

      const expiringSoon =
        (synced.status === OwnerSubscriptionStatus.ACTIVE ||
          synced.status === OwnerSubscriptionStatus.TRIAL) &&
        synced.endsAt.getTime() > now.getTime() &&
        synced.endsAt.getTime() <= addDays(now, EXPIRING_SOON_DAYS).getTime();

      if (
        expiringSoon &&
        !(await hasHostActivityLogTx({
          tx,
          ownerId: synced.ownerId,
          entityType: "subscription",
          entityId: synced.id,
          action: "subscription.expiring_soon",
        }))
      ) {
        return { summary, notice: "expiring_soon" as const };
      }

      if (
        synced.status === OwnerSubscriptionStatus.PAST_DUE &&
        !(await hasHostActivityLogTx({
          tx,
          ownerId: synced.ownerId,
          entityType: "subscription",
          entityId: synced.id,
          action: "subscription.grace_started",
        }))
      ) {
        return { summary, notice: "grace_started" as const };
      }

      if (
        synced.status === OwnerSubscriptionStatus.EXPIRED &&
        !(await hasHostActivityLogTx({
          tx,
          ownerId: synced.ownerId,
          entityType: "subscription",
          entityId: synced.id,
          action: "subscription.expired",
        }))
      ) {
        return { summary, notice: "expired" as const };
      }

      return { summary, notice: null };
    });

    if (!result.summary || !result.notice) {
      continue;
    }

    const graceEndsAt = result.summary.graceEndsAt
      ? new Date(result.summary.graceEndsAt)
      : null;

    if (result.notice === "expiring_soon") {
      const sent = await sendSubscriptionReceipt({
        ownerId: result.summary.ownerId,
        subject: "Your Meda host plan is about to expire",
        title: "Your host plan is about to expire",
        message: `Renew before ${new Date(result.summary.endsAt).toLocaleDateString()} to avoid losing access. If you miss it, you still get a ${OWNER_SUBSCRIPTION_GRACE_DAYS}-day grace period.`,
        renewalDate: new Date(result.summary.endsAt),
        graceEndsAt,
      });
      if (sent) {
        await prisma.hostActivityLog.create({
          data: {
            ownerId: result.summary.ownerId,
            pitchId: result.summary.pitchId,
            entityType: "subscription",
            entityId: result.summary.id,
            action: "subscription.expiring_soon",
          },
        });
        reminderCount += 1;
      }
      continue;
    }

    if (result.notice === "grace_started") {
      const sent = await sendSubscriptionReceipt({
        ownerId: result.summary.ownerId,
        subject: "Your Meda host plan is in its grace period",
        title: "Your host plan is in its grace period",
        message: `Your plan term ended, but you still have ${OWNER_SUBSCRIPTION_GRACE_DAYS} days to renew before host tools lock.`,
        graceEndsAt,
      });
      if (sent) {
        await prisma.hostActivityLog.create({
          data: {
            ownerId: result.summary.ownerId,
            pitchId: result.summary.pitchId,
            entityType: "subscription",
            entityId: result.summary.id,
            action: "subscription.grace_started",
          },
        });
        pastDueCount += 1;
      }
      continue;
    }

    const sent = await sendSubscriptionReceipt({
      ownerId: result.summary.ownerId,
      subject: "Your Meda host plan expired",
      title: "Your host plan expired",
      message:
        "Your 15-day grace period ended. Renew your host plan to keep adding and managing booking times.",
      graceEndsAt,
    });
    if (sent) {
      await prisma.hostActivityLog.create({
        data: {
          ownerId: result.summary.ownerId,
          pitchId: result.summary.pitchId,
          entityType: "subscription",
          entityId: result.summary.id,
          action: "subscription.expired",
        },
      });
      expiredCount += 1;
    }
  }

  return {
    reminderCount,
    pastDueCount,
    expiredCount,
  };
}
