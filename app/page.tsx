/**
 * Home page -- server-rendered landing with featured events, categories, and city matches.
 *
 * Fetches events from Prisma, decodes location data, and passes to HeroSection.
 */

import HeroSection, {
  type LandingCategory,
  type LandingCity,
  type LandingMatch,
} from "./components/landing/page";
import { unstable_cache } from "next/cache";
import { PageShell } from "./components/ui/page-shell";
import {
  computeSpotsLeft,
  getActiveReservationCountMap,
} from "@/lib/events/availability";
import { cacheTags } from "@/lib/cacheTags";
import { logger } from "@/lib/logger";
import { resolveEventLocation } from "@/lib/location";
import { prisma } from "@/lib/prisma";

function extractCityLabel(addressLabel: string | null): string | null {
  if (!addressLabel) return null;
  const segments = addressLabel
    .split(",")
    .map((segment) => segment.trim())
    .filter(Boolean);
  if (segments.length === 0) return null;
  return segments[segments.length - 1] ?? null;
}

function formatMatchTime(isoDate: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    hour: "numeric",
    minute: "2-digit",
  }).format(isoDate);
}

const getLandingData = unstable_cache(async () => {
  try {
    const now = new Date();

    const upcomingEvents = await prisma.event.findMany({
      where: { eventEndtime: { gte: now } },
      orderBy: { eventDatetime: "asc" },
      take: 48,
      include: {
        category: { select: { categoryName: true } },
        _count: { select: { attendees: true } },
      },
    });
    const reservationCounts = await getActiveReservationCountMap(
      upcomingEvents.map((event) => event.eventId),
    );

    const totalUpcoming = upcomingEvents.length;

    const featuredMatches: LandingMatch[] = upcomingEvents
      .slice(0, 8)
      .map((event) => {
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
          locationLabel:
            location.addressLabel ?? event.eventLocation ?? "Location TBA",
          priceLabel:
            event.priceField == null || event.priceField === 0
              ? "Free"
              : `ETB ${event.priceField}`,
          spotsLeft,
          attendeeCount: event._count.attendees,
        };
      });

    const onlineMatches: LandingMatch[] = upcomingEvents
      .filter((event) =>
        (event.eventLocation ?? "").toLowerCase().includes("online"),
      )
      .slice(0, 6)
      .map((event) => ({
        eventId: event.eventId,
        title: event.eventName,
        when: formatMatchTime(event.eventDatetime),
        locationLabel: "Online",
        priceLabel:
          event.priceField == null || event.priceField === 0
            ? "Free"
            : `ETB ${event.priceField}`,
        spotsLeft: computeSpotsLeft(
          event.capacity,
          event._count.attendees,
          reservationCounts.get(event.eventId) ?? 0,
        ),
        attendeeCount: event._count.attendees,
      }));

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
      featuredMatches,
      onlineMatches,
      topCategories,
      topCities,
    };
  } catch (error) {
    logger.error("Failed to load landing data", error);
    return {
      totalUpcoming: 0,
      featuredMatches: [],
      onlineMatches: [],
      topCategories: [],
      topCities: [],
    };
  }
}, ["landing-data"], {
  revalidate: 60,
  tags: [cacheTags.landing, cacheTags.events],
});

export default async function Home() {
  const data = await getLandingData();

  return (
    <PageShell containerClassName="max-w-[1240px] px-4 py-4">
      <HeroSection {...data} />
    </PageShell>
  );
}
