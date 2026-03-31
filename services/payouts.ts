import { randomUUID } from "crypto";
import {
  BookingStatus,
  PaymentStatus,
  PayoutStatus,
  Prisma,
} from "@/generated/prisma/client";
import { getAuthUserEmails } from "@/lib/auth/userLookup";
import { createChapaTransfer } from "@/lib/chapa";
import {
  PLATFORM_COMMISSION_PERCENT,
  TICKET_SURCHARGE_ETB,
} from "@/lib/constants";
import { decryptPayoutValue, maskAccountNumber } from "@/lib/encryption";
import { prisma } from "@/lib/prisma";
import { roundCurrency } from "@/lib/ticketPricing";
import { notifyUserById } from "@/services/actionNotifications";

const PAYOUT_REFERENCE_PREFIX = "MEDAPAYOUT";

type PayoutRecord = Prisma.PitchOwnerPayoutGetPayload<Record<string, never>>;

export type SerializedPitchOwnerPayout = {
  id: string;
  ownerId: string;
  amountEtb: number;
  currency: string;
  reference: string;
  providerTransferId: string | null;
  status: PayoutStatus;
  destinationBusinessName: string | null;
  destinationAccountLast4: string | null;
  destinationBankCode: string | null;
  failureReason: string | null;
  initiatedByUserId: string | null;
  paidAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AdminOwnerPayoutSummary = {
  ownerId: string;
  ownerName: string | null;
  ownerEmail: string | null;
  businessName: string | null;
  payoutReady: boolean;
  destinationLabel: string | null;
  destinationBankCode: string | null;
  grossTicketSalesEtb: number;
  platformCommissionEtb: number;
  ticketSurchargeEtb: number;
  netOwnerRevenueEtb: number;
  totalPaidOutEtb: number;
  totalPendingPayoutEtb: number;
  availablePayoutEtb: number;
  recentPayouts: SerializedPitchOwnerPayout[];
};

export type PitchOwnerPayoutSummary = {
  ownerId: string;
  businessName: string | null;
  payoutReady: boolean;
  destinationLabel: string | null;
  destinationBankCode: string | null;
  currentBalanceEtb: number;
  grossTicketSalesEtb: number;
  platformCommissionEtb: number;
  ticketSurchargeEtb: number;
  netOwnerRevenueEtb: number;
  totalPaidOutEtb: number;
  totalPendingPayoutEtb: number;
  availablePayoutEtb: number;
  recentPayouts: SerializedPitchOwnerPayout[];
};

function asNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function serializePayout(record: PayoutRecord): SerializedPitchOwnerPayout {
  return {
    id: record.id,
    ownerId: record.ownerId,
    amountEtb: asNumber(record.amountEtb),
    currency: record.currency,
    reference: record.reference,
    providerTransferId: record.providerTransferId ?? null,
    status: record.status,
    destinationBusinessName: record.destinationBusinessName ?? null,
    destinationAccountLast4: record.destinationAccountLast4 ?? null,
    destinationBankCode: record.destinationBankCode ?? null,
    failureReason: record.failureReason ?? null,
    initiatedByUserId: record.initiatedByUserId ?? null,
    paidAt: record.paidAt?.toISOString() ?? null,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

function mapTransferStatus(status?: string | null) {
  const normalized = status?.trim().toLowerCase() ?? "";
  if (
    normalized.includes("paid") ||
    normalized.includes("success") ||
    normalized.includes("complete")
  ) {
    return PayoutStatus.PAID;
  }
  if (normalized.includes("cancel")) {
    return PayoutStatus.CANCELED;
  }
  if (
    normalized.includes("fail") ||
    normalized.includes("error") ||
    normalized.includes("reject")
  ) {
    return PayoutStatus.FAILED;
  }
  return PayoutStatus.PROCESSING;
}

async function computeOwnerPayoutSummary(args: {
  ownerId: string;
  recentPayoutLimit?: number;
}): Promise<PitchOwnerPayoutSummary> {
  const [profile, balanceRecord, payments, bookings, payouts] = await Promise.all([
    prisma.pitchOwnerProfile.findUnique({
      where: { userId: args.ownerId },
      select: {
        userId: true,
        businessName: true,
        accountNumberEnc: true,
        bankCodeEnc: true,
        payoutSetupVerifiedAt: true,
      },
    }),
    prisma.userBalance.findUnique({
      where: { userId: args.ownerId },
      select: { balanceEtb: true },
    }),
    prisma.payment.findMany({
      where: {
        event: {
          userId: args.ownerId,
        },
        status: PaymentStatus.succeeded,
      },
      select: {
        paymentId: true,
        quantity: true,
        amountEtb: true,
        surchargeEtb: true,
        ownerRevenueEtb: true,
        refunds: {
          select: {
            ticketCount: true,
          },
        },
      },
    }),
    prisma.booking.findMany({
      where: {
        slot: {
          pitch: {
            ownerId: args.ownerId,
          },
        },
        status: {
          in: [BookingStatus.CONFIRMED, BookingStatus.COMPLETED],
        },
      },
      select: {
        id: true,
        totalAmount: true,
        surchargeAmount: true,
        ownerRevenueAmount: true,
      },
    }),
    prisma.pitchOwnerPayout.findMany({
      where: {
        ownerId: args.ownerId,
      },
      orderBy: [{ createdAt: "desc" }],
      take: args.recentPayoutLimit ?? 8,
    }),
  ]);

  const grossEventBreakdown = payments.reduce(
    (totals, payment) => {
      const amountEtb = asNumber(payment.amountEtb);
      const surchargeEtb = asNumber(payment.surchargeEtb);
      const ownerRevenueEtb = asNumber(payment.ownerRevenueEtb);
      const ticketSalesEtb = roundCurrency(amountEtb - surchargeEtb);
      const refundedTicketCount = payment.refunds.reduce(
        (count, refund) => count + refund.ticketCount,
        0,
      );
      const refundableRatio =
        payment.quantity > 0
          ? Math.min(1, Math.max(0, refundedTicketCount / payment.quantity))
          : 0;
      const refundedTicketSalesEtb = roundCurrency(ticketSalesEtb * refundableRatio);
      const refundedSurchargeEtb = roundCurrency(surchargeEtb * refundableRatio);
      const refundedOwnerRevenueEtb = roundCurrency(ownerRevenueEtb * refundableRatio);
      const platformCommissionEtb = roundCurrency(
        ticketSalesEtb - ownerRevenueEtb - refundedTicketSalesEtb + refundedOwnerRevenueEtb,
      );

      totals.grossTicketSalesEtb += roundCurrency(
        ticketSalesEtb - refundedTicketSalesEtb,
      );
      totals.ticketSurchargeEtb += roundCurrency(
        surchargeEtb - refundedSurchargeEtb,
      );
      totals.platformCommissionEtb += platformCommissionEtb;
      totals.netOwnerRevenueEtb += roundCurrency(
        ownerRevenueEtb - refundedOwnerRevenueEtb,
      );
      return totals;
    },
    {
      grossTicketSalesEtb: 0,
      ticketSurchargeEtb: 0,
      platformCommissionEtb: 0,
      netOwnerRevenueEtb: 0,
    },
  );

  const bookingBreakdown = bookings.reduce(
    (totals, booking) => {
      const totalAmount = asNumber(booking.totalAmount);
      const surchargeAmount = asNumber(booking.surchargeAmount);
      const ownerRevenueAmount = asNumber(booking.ownerRevenueAmount);
      const ticketSalesEtb = roundCurrency(totalAmount - surchargeAmount);
      const platformCommissionEtb = roundCurrency(
        ticketSalesEtb - ownerRevenueAmount,
      );

      totals.grossTicketSalesEtb += ticketSalesEtb;
      totals.ticketSurchargeEtb += surchargeAmount;
      totals.platformCommissionEtb += platformCommissionEtb;
      totals.netOwnerRevenueEtb += ownerRevenueAmount;
      return totals;
    },
    {
      grossTicketSalesEtb: 0,
      ticketSurchargeEtb: 0,
      platformCommissionEtb: 0,
      netOwnerRevenueEtb: 0,
    },
  );

  const totalPaidOutEtb = payouts
    .filter((payout) => payout.status === PayoutStatus.PAID)
    .reduce((sum, payout) => sum + asNumber(payout.amountEtb), 0);
  const totalPendingPayoutEtb = payouts
    .filter((payout) =>
      payout.status === PayoutStatus.PENDING ||
      payout.status === PayoutStatus.PROCESSING,
    )
    .reduce((sum, payout) => sum + asNumber(payout.amountEtb), 0);
  const reservedPayoutEtb = payouts
    .filter(
      (payout) =>
        payout.status === PayoutStatus.PENDING ||
        payout.status === PayoutStatus.PROCESSING ||
        payout.status === PayoutStatus.PAID,
    )
    .reduce((sum, payout) => sum + asNumber(payout.amountEtb), 0);

  const accountNumber = decryptPayoutValue(profile?.accountNumberEnc);
  const bankCode = decryptPayoutValue(profile?.bankCodeEnc);
  const currentBalanceEtb = roundCurrency(asNumber(balanceRecord?.balanceEtb));
  const remainingOwnerRevenueEtb = roundCurrency(
    grossEventBreakdown.netOwnerRevenueEtb +
      bookingBreakdown.netOwnerRevenueEtb -
      reservedPayoutEtb,
  );
  const destinationLabel =
    accountNumber && bankCode
      ? `${maskAccountNumber(accountNumber)}${bankCode ? ` via bank ${bankCode}` : ""}`
      : null;

  return {
    ownerId: args.ownerId,
    businessName: profile?.businessName ?? null,
    payoutReady: Boolean(profile?.payoutSetupVerifiedAt && accountNumber && bankCode),
    destinationLabel,
    destinationBankCode: bankCode,
    currentBalanceEtb,
    grossTicketSalesEtb: roundCurrency(
      grossEventBreakdown.grossTicketSalesEtb + bookingBreakdown.grossTicketSalesEtb,
    ),
    platformCommissionEtb: roundCurrency(
      grossEventBreakdown.platformCommissionEtb + bookingBreakdown.platformCommissionEtb,
    ),
    ticketSurchargeEtb: roundCurrency(
      grossEventBreakdown.ticketSurchargeEtb + bookingBreakdown.ticketSurchargeEtb,
    ),
    netOwnerRevenueEtb: roundCurrency(
      grossEventBreakdown.netOwnerRevenueEtb + bookingBreakdown.netOwnerRevenueEtb,
    ),
    totalPaidOutEtb: roundCurrency(totalPaidOutEtb),
    totalPendingPayoutEtb: roundCurrency(totalPendingPayoutEtb),
    availablePayoutEtb: Math.max(
      0,
      roundCurrency(Math.min(currentBalanceEtb, remainingOwnerRevenueEtb)),
    ),
    recentPayouts: payouts.map((payout) => serializePayout(payout)),
  };
}

export async function getPitchOwnerPayoutSummary(ownerId: string) {
  const summary = await computeOwnerPayoutSummary({
    ownerId,
    recentPayoutLimit: 8,
  });

  return {
    commissionPercent: PLATFORM_COMMISSION_PERCENT,
    ticketSurchargeEtb: TICKET_SURCHARGE_ETB,
    summary,
  };
}

export async function listAdminPitchOwnerPayoutSummaries() {
  const profiles = await prisma.pitchOwnerProfile.findMany({
    orderBy: [{ createdAt: "desc" }],
    select: {
      userId: true,
      businessName: true,
    },
  });

  const authUsers = await getAuthUserEmails(profiles.map((profile) => profile.userId));
  const summaries = await Promise.all(
    profiles.map(async (profile) => {
      const payoutSummary = await computeOwnerPayoutSummary({
        ownerId: profile.userId,
      });
      const authUser = authUsers.get(profile.userId);

      return {
        ownerId: profile.userId,
        ownerName: authUser?.name ?? profile.businessName ?? null,
        ownerEmail: authUser?.email ?? null,
        businessName: payoutSummary.businessName,
        payoutReady: payoutSummary.payoutReady,
        destinationLabel: payoutSummary.destinationLabel,
        destinationBankCode: payoutSummary.destinationBankCode,
        grossTicketSalesEtb: payoutSummary.grossTicketSalesEtb,
        platformCommissionEtb: payoutSummary.platformCommissionEtb,
        ticketSurchargeEtb: payoutSummary.ticketSurchargeEtb,
        netOwnerRevenueEtb: payoutSummary.netOwnerRevenueEtb,
        totalPaidOutEtb: payoutSummary.totalPaidOutEtb,
        totalPendingPayoutEtb: payoutSummary.totalPendingPayoutEtb,
        availablePayoutEtb: payoutSummary.availablePayoutEtb,
        recentPayouts: payoutSummary.recentPayouts,
      } satisfies AdminOwnerPayoutSummary;
    }),
  );

  return {
    commissionPercent: PLATFORM_COMMISSION_PERCENT,
    ticketSurchargeEtb: TICKET_SURCHARGE_ETB,
    owners: summaries.sort(
      (left, right) => right.availablePayoutEtb - left.availablePayoutEtb,
    ),
  };
}

export async function createPitchOwnerPayout(args: {
  ownerId: string;
  amountEtb?: number | null;
  initiatedByUserId: string;
  callbackUrl: string;
}) {
  const profile = await prisma.pitchOwnerProfile.findUnique({
    where: { userId: args.ownerId },
    select: {
      userId: true,
      businessName: true,
      accountNameEnc: true,
      accountNumberEnc: true,
      bankCodeEnc: true,
      payoutSetupVerifiedAt: true,
    },
  });

  if (!profile?.payoutSetupVerifiedAt) {
    throw new Error("This pitch owner has not finished payout setup.");
  }

  const summary = await computeOwnerPayoutSummary({
    ownerId: args.ownerId,
    recentPayoutLimit: 8,
  });

  if (!summary.payoutReady) {
    throw new Error("This pitch owner does not have a verified payout destination.");
  }

  const payoutAmount = roundCurrency(
    args.amountEtb == null ? summary.availablePayoutEtb : args.amountEtb,
  );
  if (payoutAmount <= 0) {
    throw new Error("There is no payout amount available for this owner.");
  }
  if (payoutAmount - summary.availablePayoutEtb > 0.009) {
    throw new Error(
      `Only ETB ${summary.availablePayoutEtb.toFixed(2)} is currently available for payout.`,
    );
  }

  const accountName = decryptPayoutValue(profile.accountNameEnc);
  const accountNumber = decryptPayoutValue(profile.accountNumberEnc);
  const bankCode = decryptPayoutValue(profile.bankCodeEnc);
  if (!accountName || !accountNumber || !bankCode) {
    throw new Error("The verified payout destination is incomplete.");
  }

  const reference = `${PAYOUT_REFERENCE_PREFIX}-${randomUUID()}`;
  const payout = await prisma.pitchOwnerPayout.create({
    data: {
      ownerId: args.ownerId,
      amountEtb: payoutAmount,
      currency: "ETB",
      reference,
      status: PayoutStatus.PENDING,
      destinationBusinessName: profile.businessName ?? accountName,
      destinationAccountLast4: accountNumber.slice(-4),
      destinationBankCode: bankCode,
      initiatedByUserId: args.initiatedByUserId,
    },
  });

  try {
    const transfer = await createChapaTransfer({
      account_name: accountName,
      account_number: accountNumber,
      amount: payoutAmount.toFixed(2),
      currency: "ETB",
      beneficiary_name: profile.businessName ?? accountName,
      reference,
      bank_code: bankCode,
      callback_url: args.callbackUrl,
    });

    const nextStatus = mapTransferStatus(
      transfer.data?.status ??
        (typeof transfer.status === "string" ? transfer.status : null),
    );
    const updated = await prisma.pitchOwnerPayout.update({
      where: { id: payout.id },
      data: {
        providerTransferId:
          transfer.data?.transfer_id ?? transfer.data?.id ?? null,
        status: nextStatus,
        callbackPayloadJson: transfer as Prisma.InputJsonValue,
        failureReason:
          nextStatus === PayoutStatus.FAILED
            ? String(transfer.message ?? "Transfer failed")
            : null,
        paidAt: nextStatus === PayoutStatus.PAID ? new Date() : null,
      },
    });

    await notifyUserById({
      userId: args.ownerId,
      subject:
        nextStatus === PayoutStatus.PAID
          ? "Your Meda payout was sent"
          : "Your Meda payout is being processed",
      title:
        nextStatus === PayoutStatus.PAID
          ? "Your payout was sent"
          : "Your payout is on the way",
      message:
        nextStatus === PayoutStatus.PAID
          ? "We sent your host payout from Meda's Chapa balance to your verified payout destination."
          : "We started your host payout from Meda's Chapa balance. Chapa may still require approval before it lands.",
      details: [
        { label: "Amount", value: `ETB ${payoutAmount.toFixed(2)}` },
        {
          label: "Destination",
          value: `${maskAccountNumber(accountNumber)} (${bankCode})`,
        },
        { label: "Reference", value: reference },
      ],
      ctaLabel: "Open profile",
      ctaPath: "/profile",
    });

    return serializePayout(updated);
  } catch (error) {
    await prisma.pitchOwnerPayout.update({
      where: { id: payout.id },
      data: {
        status: PayoutStatus.FAILED,
        failureReason: error instanceof Error ? error.message : "Transfer failed",
      },
    });
    throw error;
  }
}

export async function createAdminPitchOwnerPayout(args: {
  ownerId: string;
  amountEtb?: number | null;
  initiatedByUserId: string;
  callbackUrl: string;
}) {
  return createPitchOwnerPayout(args);
}

function extractStatusFromPayload(payload: Prisma.JsonValue | null) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return null;
  }
  const record = payload as Record<string, unknown>;
  if (typeof record.status === "string") return record.status;
  if (record.data && typeof record.data === "object") {
    const nested = record.data as Record<string, unknown>;
    if (typeof nested.status === "string") return nested.status;
  }
  return null;
}

export async function reconcilePitchOwnerPayout(args: {
  reference: string;
  payload?: Prisma.JsonValue | null;
}) {
  const payout = await prisma.pitchOwnerPayout.findUnique({
    where: { reference: args.reference },
  });
  if (!payout) {
    throw new Error("Payout not found");
  }

  const extractedStatus = extractStatusFromPayload(args.payload ?? null);
  const nextStatus = extractedStatus
    ? mapTransferStatus(extractedStatus)
    : payout.status === PayoutStatus.PENDING
      ? PayoutStatus.PROCESSING
      : payout.status;
  const updated = await prisma.pitchOwnerPayout.update({
    where: { id: payout.id },
    data: {
      status: nextStatus,
      ...(args.payload !== undefined
        ? {
            callbackPayloadJson: args.payload as Prisma.InputJsonValue,
          }
        : {}),
      paidAt:
        nextStatus === PayoutStatus.PAID ? payout.paidAt ?? new Date() : payout.paidAt,
      failureReason:
        nextStatus === PayoutStatus.FAILED
          ? payout.failureReason ?? "Transfer failed at the provider."
          : nextStatus === PayoutStatus.CANCELED
            ? payout.failureReason ?? "Transfer was canceled."
            : payout.failureReason,
    },
  });

  if (nextStatus === PayoutStatus.PAID || nextStatus === PayoutStatus.FAILED) {
    await notifyUserById({
      userId: updated.ownerId,
      subject:
        nextStatus === PayoutStatus.PAID
          ? "Your Meda payout was completed"
          : "Your Meda payout failed",
      title:
        nextStatus === PayoutStatus.PAID
          ? "Your payout is complete"
          : "Your payout needs attention",
      message:
        nextStatus === PayoutStatus.PAID
          ? "Chapa marked your payout as completed."
          : "Chapa could not complete your payout. Meda support should review the transfer status.",
      details: [
        { label: "Amount", value: `ETB ${asNumber(updated.amountEtb).toFixed(2)}` },
        { label: "Reference", value: updated.reference },
      ],
      ctaLabel: "Open profile",
      ctaPath: "/profile",
    });
  }

  return serializePayout(updated);
}
