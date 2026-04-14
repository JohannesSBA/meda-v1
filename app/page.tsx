/**
 * Home page -- server-rendered landing with featured pitch slots, matches, categories, and cities.
 *
 * Fetches events and public slots, groups slots into offers, and passes to HeroSection.
 */

import HeroSection, {
  type LandingCategory,
  type LandingCity,
  type LandingMatch,
  type LandingSlotOffer,
} from "./components/landing/LandingHome";
import { PageShell } from "./components/ui/page-shell";
import {
  computeSpotsLeft,
  getActiveReservationCountMap,
} from "@/lib/events/availability";
import { Prisma, SlotStatus } from "@/generated/prisma/client";
import { logger } from "@/lib/logger";
import { resolveEventLocation } from "@/lib/location";
import { buildOfferCards, type SlotOfferGroupingSlot } from "@/lib/slots/offerGrouping";
import { prisma } from "@/lib/prisma";
import { listPublicSlots } from "@/services/slots";

function extractCityLabel(addressLabel: string | null): string | null {
  if (!addressLabel) return null;
  const segments = addressLabel
    .split(",")
    .map((segment) => segment.trim())
    .filter(Boolean);
  if (segments.length === 0) return null;
  return segments[segments.length - 1] ?? null;
}

const landingEventInclude = {
  category: { select: { categoryName: true } },
  _count: { select: { attendees: true } },
} satisfies Prisma.EventInclude;

type LandingEventRow = Prisma.EventGetPayload<{ include: typeof landingEventInclude }>;

function formatMatchTime(isoDate: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    hour: "numeric",
    minute: "2-digit",
  }).format(isoDate);
}

/** Avoid prerendering against an empty build DB and stale empty `unstable_cache` snapshots. */
export const dynamic = "force-dynamic";

async function loadLandingData() {
  const now = new Date();

  let upcomingEvents: LandingEventRow[] = [];
  try {
    upcomingEvents = await prisma.event.findMany({
      where: { eventEndtime: { gte: now } },
      orderBy: { eventDatetime: "asc" },
      take: 48,
      include: landingEventInclude,
    });
  } catch (error) {
    logger.error("Landing: failed to load events", error);
  }

  let slotListRows: Awaited<ReturnType<typeof listPublicSlots>> = [];
  try {
    slotListRows = await listPublicSlots({ take: 96 });
  } catch (error) {
    logger.error("Landing: failed to load public slots", error);
  }

  let openSlotCount = 0;
  try {
    openSlotCount = await prisma.bookableSlot.count({
      where: {
        startsAt: { gte: now },
        status: { in: [SlotStatus.OPEN, SlotStatus.RESERVED] },
        pitch: { isActive: true },
      },
    });
  } catch (error) {
    logger.error("Landing: failed to count open slots", error);
  }

  let reservationCounts = new Map<string, number>();
  try {
    reservationCounts = await getActiveReservationCountMap(
      upcomingEvents.map((event) => event.eventId),
    );
  } catch (error) {
    logger.error("Landing: failed to load reservation counts", error);
  }

  const totalUpcoming = upcomingEvents.length;

  const slotOffers = buildOfferCards(slotListRows as SlotOfferGroupingSlot[]);
  const featuredSlotOffers: LandingSlotOffer[] = slotOffers.slice(0, 9).map((offer) => ({
    key: offer.key,
    pitchId: offer.pitchId,
    pitchName: offer.pitchName,
    pitchImageUrl: offer.pitchImageUrl,
    addressLabel: offer.addressLabel,
    categoryName: offer.categoryName,
    productType: offer.productType,
    capacity: offer.capacity,
    price: offer.price,
    currency: offer.currency,
    requiresParty: offer.requiresParty,
    slots: offer.slots.map((slot) => ({
      id: slot.id,
      startsAt: slot.startsAt,
      endsAt: slot.endsAt,
      remainingCapacity: slot.remainingCapacity,
    })),
  }));

  const featuredMatches: LandingMatch[] = upcomingEvents.slice(0, 8).map((event) => {
    const location = resolveEventLocation(event);
    const spotsLeft = computeSpotsLeft(
      event.capacity,
      event._count.attendees,
      reservationCounts.get(event.eventId) ?? 0,
    );

    return {
      eventId: event.eventId,
      title: event.eventName,
      when: formatMatchTime(event.eventDatetime),
      locationLabel: location.addressLabel ?? event.eventLocation ?? "Location TBA",
      priceLabel:
        event.priceField == null || event.priceField === 0 ? "Free" : `ETB ${event.priceField}`,
      spotsLeft,
      attendeeCount: event._count.attendees,
      pictureUrl: event.pictureUrl ?? null,
    };
  });

  const categoryCounts = new Map<string, { label: string; count: number }>();
  for (const event of upcomingEvents) {
    const label = event.category.categoryName;
    const current = categoryCounts.get(event.categoryId);
    if (!current) {
      categoryCounts.set(event.categoryId, { label, count: 1 });
    } else {
      current.count += 1;
    }
  }
  const topCategories: LandingCategory[] = Array.from(categoryCounts.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, 6)
    .map((entry) => ({ name: entry.label, upcomingCount: entry.count }));

  const cityCounts = new Map<string, number>();
  for (const event of upcomingEvents) {
    const location = resolveEventLocation(event);
    const city = extractCityLabel(location.addressLabel);
    if (!city) continue;
    cityCounts.set(city, (cityCounts.get(city) ?? 0) + 1);
  }
  const topCities: LandingCity[] = Array.from(cityCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, upcomingCount]) => ({ name, upcomingCount }));

  return {
    totalUpcoming,
    openSlotCount,
    featuredSlotOffers,
    featuredMatches,
    topCategories,
    topCities,
  };
}

export default async function Home() {
  const data = await loadLandingData();

  return (
    <PageShell containerClassName="max-w-[1240px]">
      <HeroSection {...data} />
    </PageShell>
  );
}
