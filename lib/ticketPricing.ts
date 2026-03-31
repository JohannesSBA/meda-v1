import {
  PLATFORM_COMMISSION_PERCENT,
  TICKET_SURCHARGE_ETB,
} from "@/lib/constants";

export type TicketChargeBreakdown = {
  quantity: number;
  unitPriceEtb: number;
  ticketSubtotalEtb: number;
  surchargePerTicketEtb: number;
  surchargeTotalEtb: number;
  platformCommissionEtb: number;
  ownerRevenueEtb: number;
  platformRetainedEtb: number;
  totalAmountEtb: number;
  perTicketTotalEtb: number;
};

export function roundCurrency(value: number) {
  return Math.round(value * 100) / 100;
}

export function computeTicketChargeBreakdown(args: {
  unitPriceEtb: number;
  quantity: number;
  surchargePerTicketEtb?: number;
  commissionPercent?: number;
}) {
  const quantity = Math.max(0, Math.trunc(args.quantity));
  const unitPriceEtb = Math.max(0, roundCurrency(args.unitPriceEtb));
  const ticketSubtotalEtb = roundCurrency(unitPriceEtb * quantity);
  const surchargePerTicketEtb =
    ticketSubtotalEtb > 0
      ? Math.max(
          0,
          roundCurrency(args.surchargePerTicketEtb ?? TICKET_SURCHARGE_ETB),
        )
      : 0;
  const surchargeTotalEtb = roundCurrency(surchargePerTicketEtb * quantity);
  const platformCommissionEtb = roundCurrency(
    ticketSubtotalEtb * (args.commissionPercent ?? PLATFORM_COMMISSION_PERCENT),
  );
  const ownerRevenueEtb = Math.max(
    0,
    roundCurrency(ticketSubtotalEtb - platformCommissionEtb),
  );
  const totalAmountEtb = roundCurrency(ticketSubtotalEtb + surchargeTotalEtb);
  const platformRetainedEtb = roundCurrency(totalAmountEtb - ownerRevenueEtb);
  const perTicketTotalEtb =
    quantity > 0 ? roundCurrency(totalAmountEtb / quantity) : 0;

  return {
    quantity,
    unitPriceEtb,
    ticketSubtotalEtb,
    surchargePerTicketEtb,
    surchargeTotalEtb,
    platformCommissionEtb,
    ownerRevenueEtb,
    platformRetainedEtb,
    totalAmountEtb,
    perTicketTotalEtb,
  } satisfies TicketChargeBreakdown;
}

export function computePerTicketOwnerRevenue(args: {
  ownerRevenueEtb: number;
  quantity: number;
}) {
  return args.quantity > 0
    ? roundCurrency(args.ownerRevenueEtb / args.quantity)
    : 0;
}
