import { Prisma } from "@/generated/prisma/client";
import axios from "axios";
import {
  createChapaSubaccount,
  extractChapaSubaccountId,
} from "@/lib/chapa";
import { getAuthUserEmails } from "@/lib/auth/userLookup";
import { PLATFORM_COMMISSION_PERCENT } from "@/lib/constants";
import {
  decryptPayoutValue,
  encryptPayoutValue,
  maskAccountNumber,
} from "@/lib/encryption";
import { logger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
export { PLATFORM_COMMISSION_PERCENT } from "@/lib/constants";

export type PitchOwnerPayoutSettings = {
  businessName: string | null;
  accountName: string | null;
  accountNumberMasked: string | null;
  accountNumberLast4: string | null;
  bankCode: string | null;
  chapaSubaccountId: string | null;
  splitType: string | null;
  splitValue: number | null;
  payoutSetupVerifiedAt: string | null;
  payoutSetupComplete: boolean;
};

export async function ensurePitchOwnerProfile(args: {
  userId: string;
  businessName?: string | null;
}) {
  const authUsers = await getAuthUserEmails([args.userId]);
  const authUser = authUsers.get(args.userId);
  if (!authUser) {
    throw new Error("User not found");
  }

  const existing = await prisma.pitchOwnerProfile.findUnique({
    where: { userId: args.userId },
  });
  if (existing) {
    return {
      profile: existing,
      created: false,
    };
  }

  const fallbackBusinessName =
    authUser.name?.trim() ||
    authUser.email?.split("@")[0]?.trim() ||
    null;

  const profile = await prisma.pitchOwnerProfile.create({
    data: {
      userId: args.userId,
      businessName: args.businessName?.trim() || fallbackBusinessName,
      splitType: "percentage",
      splitValue: new Prisma.Decimal(PLATFORM_COMMISSION_PERCENT),
    },
  });

  return {
    profile,
    created: true,
  };
}

export async function listPitchOwnerProfiles() {
  const profiles = await prisma.pitchOwnerProfile.findMany({
    orderBy: { createdAt: "desc" },
  });
  const authUsers = await getAuthUserEmails(profiles.map((profile) => profile.userId));

  return profiles.map((profile) => {
    const authUser = authUsers.get(profile.userId);
    return {
      ...profile,
      email: authUser?.email ?? null,
      name: authUser?.name ?? profile.businessName ?? null,
    };
  });
}

function toNumber(value: Prisma.Decimal | number | string | null | undefined) {
  if (value == null) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function formatPayoutSettings(profile: {
  businessName: string | null;
  accountNameEnc: string | null;
  accountNumberEnc: string | null;
  bankCodeEnc: string | null;
  chapaSubaccountId: string | null;
  splitType: string | null;
  splitValue: Prisma.Decimal | number | string | null;
  payoutSetupVerifiedAt: Date | null;
}): PitchOwnerPayoutSettings {
  const accountName = decryptPayoutValue(profile.accountNameEnc);
  const accountNumber = decryptPayoutValue(profile.accountNumberEnc);
  const bankCode = decryptPayoutValue(profile.bankCodeEnc);

  return {
    businessName: profile.businessName,
    accountName,
    accountNumberMasked: maskAccountNumber(accountNumber),
    accountNumberLast4: accountNumber ? accountNumber.slice(-4) : null,
    bankCode,
    chapaSubaccountId: profile.chapaSubaccountId,
    splitType: profile.splitType,
    splitValue: toNumber(profile.splitValue),
    payoutSetupVerifiedAt: profile.payoutSetupVerifiedAt?.toISOString() ?? null,
    payoutSetupComplete: Boolean(
      profile.chapaSubaccountId && profile.payoutSetupVerifiedAt,
    ),
  };
}

export async function getPitchOwnerPayoutSettings(userId: string) {
  const { profile } = await ensurePitchOwnerProfile({ userId });

  return formatPayoutSettings(profile);
}

export async function hasVerifiedPitchOwnerPayout(userId: string) {
  const profile = await prisma.pitchOwnerProfile.findUnique({
    where: { userId },
    select: {
      chapaSubaccountId: true,
      payoutSetupVerifiedAt: true,
    },
  });

  return Boolean(profile?.chapaSubaccountId && profile.payoutSetupVerifiedAt);
}

export async function getPitchOwnerSplitProfile(userId: string) {
  return prisma.pitchOwnerProfile.findUnique({
    where: { userId },
    select: {
      userId: true,
      businessName: true,
      chapaSubaccountId: true,
      splitType: true,
      splitValue: true,
      payoutSetupVerifiedAt: true,
    },
  });
}

export async function updatePitchOwnerPayoutSettings(args: {
  userId: string;
  businessName?: string | null;
  accountName: string;
  accountNumber: string;
  bankCode: string;
}) {
  const { profile } = await ensurePitchOwnerProfile({
    userId: args.userId,
    businessName: args.businessName,
  });

  const businessName =
    args.businessName?.trim() || profile.businessName?.trim() || "Meda Pitch Owner";
  const splitType = "percentage";
  const splitValue = new Prisma.Decimal(PLATFORM_COMMISSION_PERCENT);

  await prisma.pitchOwnerProfile.update({
    where: { userId: args.userId },
    data: {
      businessName,
      accountNameEnc: encryptPayoutValue(args.accountName),
      accountNumberEnc: encryptPayoutValue(args.accountNumber),
      bankCodeEnc: encryptPayoutValue(args.bankCode),
      chapaSubaccountId: null,
      payoutSetupVerifiedAt: null,
      splitType,
      splitValue,
    },
  });

  let subaccountId: string | null = null;
  try {
    const response = await createChapaSubaccount({
      accountName: args.accountName,
      accountNumber: args.accountNumber,
      bankCode: args.bankCode,
      businessName,
      splitType,
      splitValue: PLATFORM_COMMISSION_PERCENT,
    });
    subaccountId = extractChapaSubaccountId(response);
    if (!subaccountId) {
      throw new Error("Chapa did not return a subaccount ID");
    }
  } catch (error) {
    logger.error("Pitch owner payout verification failed", error);
    if (axios.isAxiosError(error)) {
      const detail =
        typeof error.response?.data === "string"
          ? error.response.data
          : JSON.stringify(error.response?.data ?? error.message);
      throw new Error(`Unable to verify payout details with Chapa: ${detail}`);
    }
    throw error instanceof Error
      ? error
      : new Error("Unable to verify payout details with Chapa");
  }

  const updated = await prisma.pitchOwnerProfile.update({
    where: { userId: args.userId },
    data: {
      chapaSubaccountId: subaccountId,
      payoutSetupVerifiedAt: new Date(),
    },
  });

  return formatPayoutSettings(updated);
}
