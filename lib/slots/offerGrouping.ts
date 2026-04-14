/**
 * Group public slot rows into "offers" (same pitch + product + price + party rules).
 * Shared by SlotMarketplace (client) and landing page (server).
 */

import { computeTicketChargeBreakdown } from "@/lib/ticketPricing";

export type SlotOfferGroupingSlot = {
  id: string;
  pitchId: string;
  pitchName: string;
  pitchImageUrl?: string | null;
  addressLabel: string | null;
  latitude: number | null;
  longitude: number | null;
  categoryName: string;
  startsAt: string;
  endsAt: string;
  capacity: number;
  price: number;
  currency: string;
  productType: "DAILY" | "MONTHLY";
  status: "OPEN" | "RESERVED" | "BOOKED" | "BLOCKED" | "CANCELLED";
  requiresParty: boolean;
  notes: string | null;
  bookingCount: number;
  soldQuantity: number;
  remainingCapacity: number;
  hostAverageRating: number;
  hostReviewCount: number;
  hostTrustBadge: string;
};

export type SlotOffer = {
  key: string;
  pitchId: string;
  pitchName: string;
  pitchImageUrl: string | null;
  addressLabel: string | null;
  latitude: number | null;
  longitude: number | null;
  categoryName: string;
  productType: "DAILY" | "MONTHLY";
  capacity: number;
  price: number;
  currency: string;
  requiresParty: boolean;
  notes: string | null;
  slots: SlotOfferGroupingSlot[];
  bookingCount: number;
  dayOptions: Array<{
    dateKey: string;
    startsAt: string;
    label: string;
    count: number;
  }>;
};

function formatCurrency(value: number, currency = "ETB") {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(value);
}

export function getSlotDisplayPrice(slot: Pick<SlotOfferGroupingSlot, "productType" | "price" | "capacity">) {
  return slot.productType === "MONTHLY" ? slot.price * slot.capacity : slot.price;
}

export function getSlotChargeBreakdown(
  slot: Pick<SlotOfferGroupingSlot, "price" | "capacity" | "productType">,
  quantity?: number,
) {
  const effectiveQuantity = quantity ?? (slot.productType === "MONTHLY" ? slot.capacity : 1);
  return computeTicketChargeBreakdown({
    unitPriceEtb: slot.price,
    quantity: effectiveQuantity,
  });
}

export function getSlotOfferKey(slot: SlotOfferGroupingSlot) {
  return [
    slot.pitchId,
    slot.productType,
    slot.categoryName,
    String(slot.capacity),
    String(slot.price),
    slot.currency,
    slot.requiresParty ? "group" : "solo",
    slot.notes?.trim().toLowerCase() ?? "",
  ].join("::");
}

export function getSlotDayKey(startsAt: string) {
  const date = new Date(startsAt);
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

export function formatSlotDayLabel(startsAt: string, short = false) {
  return new Date(startsAt).toLocaleDateString(undefined, {
    weekday: short ? "short" : "long",
    month: short ? "short" : "long",
    day: "numeric",
  });
}

export function formatSlotTimeRange(slot: Pick<SlotOfferGroupingSlot, "startsAt" | "endsAt">) {
  return `${new Date(slot.startsAt).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  })} - ${new Date(slot.endsAt).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  })}`;
}

export function buildOfferCards(slots: SlotOfferGroupingSlot[]): SlotOffer[] {
  const sortedSlots = [...slots].sort(
    (left, right) => new Date(left.startsAt).getTime() - new Date(right.startsAt).getTime(),
  );
  const grouped = new Map<string, SlotOffer>();

  for (const slot of sortedSlots) {
    const key = getSlotOfferKey(slot);
    const existing = grouped.get(key);
    if (existing) {
      existing.slots.push(slot);
      existing.bookingCount += slot.bookingCount;
      if (!existing.pitchImageUrl && slot.pitchImageUrl) {
        existing.pitchImageUrl = slot.pitchImageUrl;
      }
      continue;
    }

    grouped.set(key, {
      key,
      pitchId: slot.pitchId,
      pitchName: slot.pitchName,
      pitchImageUrl: slot.pitchImageUrl ?? null,
      addressLabel: slot.addressLabel,
      latitude: slot.latitude,
      longitude: slot.longitude,
      categoryName: slot.categoryName,
      productType: slot.productType,
      capacity: slot.capacity,
      price: slot.price,
      currency: slot.currency,
      requiresParty: slot.requiresParty,
      notes: slot.notes,
      slots: [slot],
      bookingCount: slot.bookingCount,
      dayOptions: [],
    });
  }

  const offers = Array.from(grouped.values());
  for (const offer of offers) {
    const dayMap = new Map<
      string,
      { dateKey: string; startsAt: string; label: string; count: number }
    >();
    for (const slot of offer.slots) {
      const dateKey = getSlotDayKey(slot.startsAt);
      const dayExisting = dayMap.get(dateKey);
      if (dayExisting) {
        dayExisting.count += 1;
      } else {
        dayMap.set(dateKey, {
          dateKey,
          startsAt: slot.startsAt,
          label: formatSlotDayLabel(slot.startsAt, true),
          count: 1,
        });
      }
    }

    offer.dayOptions = Array.from(dayMap.values()).sort(
      (left, right) => new Date(left.startsAt).getTime() - new Date(right.startsAt).getTime(),
    );
  }

  return offers;
}

export function getOfferPriceLabel(
  offer: Pick<SlotOffer, "productType" | "price" | "capacity" | "currency">,
) {
  if (offer.productType === "MONTHLY") {
    const pricing = getSlotChargeBreakdown(offer);
    return `${formatCurrency(pricing.totalAmountEtb, offer.currency)} full pitch`;
  }
  const pricing = getSlotChargeBreakdown(offer, 1);
  return `${formatCurrency(pricing.totalAmountEtb, offer.currency)} per spot`;
}

/** Full-window charge (all spots): monthly = whole pitch; daily = quantity = capacity. */
function getOfferFullWindowPricing(
  offer: Pick<SlotOffer, "productType" | "price" | "capacity">,
) {
  return offer.productType === "MONTHLY"
    ? getSlotChargeBreakdown(offer)
    : getSlotChargeBreakdown(offer, offer.capacity);
}

/**
 * Average per person if the full window is split across `capacity` players (includes surcharges).
 * Omit for daily single-spot offers — same as the main “per spot” line.
 */
export function getOfferPerPersonPriceLabel(
  offer: Pick<SlotOffer, "productType" | "price" | "capacity" | "currency">,
): string | null {
  if (offer.capacity <= 0) return null;
  if (offer.productType === "DAILY" && offer.capacity <= 1) return null;

  const pricing = getOfferFullWindowPricing(offer);
  const perPerson = pricing.perTicketTotalEtb;
  if (!Number.isFinite(perPerson) || perPerson <= 0) return null;
  return `${formatCurrency(perPerson, offer.currency)} / person`;
}

export function getOfferNextAvailableLabel(offer: {
  slots: Array<Pick<SlotOfferGroupingSlot, "startsAt" | "endsAt">>;
}) {
  const nextSlot = [...offer.slots].sort(
    (left, right) => new Date(left.startsAt).getTime() - new Date(right.startsAt).getTime(),
  )[0];
  if (!nextSlot) return null;
  return `${formatSlotDayLabel(nextSlot.startsAt)} · ${formatSlotTimeRange(nextSlot)}`;
}

/** Earliest slot in the offer (for deep links). */
export function getOfferLeadSlotId(offer: {
  slots: Array<Pick<SlotOfferGroupingSlot, "id" | "startsAt">>;
}): string | null {
  const nextSlot = [...offer.slots].sort(
    (left, right) => new Date(left.startsAt).getTime() - new Date(right.startsAt).getTime(),
  )[0];
  return nextSlot?.id ?? null;
}
