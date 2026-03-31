import { Prisma } from "@/generated/prisma/client";
import { getAuthUserEmails } from "@/lib/auth/userLookup";
import { prisma } from "@/lib/prisma";

type PromoCodeClient = Pick<typeof prisma, "promoCode">;

export type EventCreationPromo = {
  id: string;
  code: string;
  discountType: string;
  discountValue: number;
  pitchOwnerUserId: string | null;
  maxUses: number | null;
  usedCount: number;
  expiresAt: Date;
  isActive: boolean;
};

function toNumber(value: Prisma.Decimal | number | string | null | undefined) {
  if (value == null) return 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function normalizePromoCode(code: string | null | undefined) {
  return code?.trim().toUpperCase() ?? "";
}

export async function findActivePromoCode(
  db: PromoCodeClient,
  args: {
    code: string | null | undefined;
    pitchOwnerUserId: string;
    now?: Date;
  },
): Promise<EventCreationPromo | null> {
  const code = normalizePromoCode(args.code);
  if (!code) return null;

  const now = args.now ?? new Date();
  const promos = await db.promoCode.findMany({
    where: {
      code,
      isActive: true,
      expiresAt: { gt: now },
      OR: [
        { pitchOwnerUserId: null },
        { pitchOwnerUserId: args.pitchOwnerUserId },
      ],
    },
    orderBy: [{ createdAt: "desc" }],
  });

  const eligiblePromos = promos.filter((item) => {
    if (item.maxUses == null) return true;
    return item.usedCount < item.maxUses;
  });
  const promo =
    eligiblePromos.find(
      (item) => item.pitchOwnerUserId === args.pitchOwnerUserId,
    ) ??
    eligiblePromos.find((item) => item.pitchOwnerUserId == null);

  if (!promo) return null;

  return {
    id: promo.id,
    code: promo.code,
    discountType: promo.discountType,
    discountValue: toNumber(promo.discountValue),
    pitchOwnerUserId: promo.pitchOwnerUserId,
    maxUses: promo.maxUses,
    usedCount: promo.usedCount,
    expiresAt: promo.expiresAt,
    isActive: promo.isActive,
  };
}

export function computePromoDiscount(amountEtb: number, promo: EventCreationPromo | null) {
  if (!promo || amountEtb <= 0) return 0;

  if (promo.discountType === "full") {
    return amountEtb;
  }

  if (promo.discountType !== "partial") {
    return 0;
  }

  if (promo.discountValue > 0 && promo.discountValue <= 1) {
    return amountEtb * promo.discountValue;
  }

  return Math.min(amountEtb, promo.discountValue);
}

export async function consumePromoCode(
  tx: Pick<typeof prisma, "promoCode">,
  promoCodeId: string,
) {
  const promo = await tx.promoCode.findUnique({
    where: { id: promoCodeId },
  });

  if (!promo || !promo.isActive || promo.expiresAt <= new Date()) {
    throw new Error("Promo code is no longer valid");
  }

  if (promo.maxUses != null && promo.usedCount >= promo.maxUses) {
    throw new Error("Promo code usage limit reached");
  }

  await tx.promoCode.update({
    where: { id: promoCodeId },
    data: {
      usedCount: { increment: 1 },
    },
  });
}

export async function listPromoCodes() {
  const promos = await prisma.promoCode.findMany({
    orderBy: { createdAt: "desc" },
  });
  const authUsers = await getAuthUserEmails(
    promos
      .map((promo) => promo.pitchOwnerUserId)
      .filter((value): value is string => Boolean(value)),
  );

  return promos.map((promo) => {
    const owner = promo.pitchOwnerUserId
      ? authUsers.get(promo.pitchOwnerUserId) ?? null
      : null;

    return {
      id: promo.id,
      code: promo.code,
      discountType: promo.discountType,
      discountValue: toNumber(promo.discountValue),
      pitchOwnerUserId: promo.pitchOwnerUserId,
      pitchOwnerName: owner?.name ?? null,
      pitchOwnerEmail: owner?.email ?? null,
      maxUses: promo.maxUses,
      usedCount: promo.usedCount,
      expiresAt: promo.expiresAt.toISOString(),
      isActive: promo.isActive,
      createdAt: promo.createdAt.toISOString(),
    };
  });
}

export async function createPromoCode(args: {
  code: string;
  discountType: "full" | "partial";
  discountValue: number;
  pitchOwnerUserId?: string | null;
  maxUses?: number | null;
  expiresAt: string;
}) {
  const code = normalizePromoCode(args.code);
  if (!code) {
    throw new Error("Promo code is required");
  }

  const expiresAt = new Date(args.expiresAt);
  if (Number.isNaN(expiresAt.getTime()) || expiresAt <= new Date()) {
    throw new Error("Promo code expiry must be in the future");
  }

  const promo = await prisma.promoCode.create({
    data: {
      code,
      discountType: args.discountType,
      discountValue: new Prisma.Decimal(
        (args.discountType === "full" ? 100 : args.discountValue).toFixed(4),
      ),
      pitchOwnerUserId: args.pitchOwnerUserId ?? null,
      maxUses: args.maxUses ?? null,
      expiresAt,
      isActive: true,
    },
  });

  return {
    id: promo.id,
    code: promo.code,
    discountType: promo.discountType,
    discountValue: toNumber(promo.discountValue),
    pitchOwnerUserId: promo.pitchOwnerUserId,
    maxUses: promo.maxUses,
    usedCount: promo.usedCount,
    expiresAt: promo.expiresAt.toISOString(),
    isActive: promo.isActive,
    createdAt: promo.createdAt.toISOString(),
  };
}

export async function updatePromoCode(args: {
  id: string;
  isActive?: boolean;
  maxUses?: number | null;
  expiresAt?: string;
}) {
  const data: {
    isActive?: boolean;
    maxUses?: number | null;
    expiresAt?: Date;
  } = {};

  if (typeof args.isActive === "boolean") {
    data.isActive = args.isActive;
  }
  if (args.maxUses !== undefined) {
    data.maxUses = args.maxUses ?? null;
  }
  if (args.expiresAt) {
    const expiresAt = new Date(args.expiresAt);
    if (Number.isNaN(expiresAt.getTime())) {
      throw new Error("Invalid promo expiry date");
    }
    data.expiresAt = expiresAt;
  }

  const promo = await prisma.promoCode.update({
    where: { id: args.id },
    data,
  });

  return {
    id: promo.id,
    code: promo.code,
    discountType: promo.discountType,
    discountValue: toNumber(promo.discountValue),
    pitchOwnerUserId: promo.pitchOwnerUserId,
    maxUses: promo.maxUses,
    usedCount: promo.usedCount,
    expiresAt: promo.expiresAt.toISOString(),
    isActive: promo.isActive,
    createdAt: promo.createdAt.toISOString(),
  };
}
