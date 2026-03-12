import type { MetadataRoute } from "next";
import { prisma } from "@/lib/prisma";

import { getAppBaseUrl } from "@/lib/env";

const BASE_URL = getAppBaseUrl();

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticPages: MetadataRoute.Sitemap = [
    { url: BASE_URL, lastModified: new Date(), changeFrequency: "daily", priority: 1 },
    { url: `${BASE_URL}/events`, lastModified: new Date(), changeFrequency: "hourly", priority: 0.9 },
    { url: `${BASE_URL}/about`, changeFrequency: "monthly", priority: 0.5 },
    { url: `${BASE_URL}/help`, changeFrequency: "monthly", priority: 0.4 },
    { url: `${BASE_URL}/terms`, changeFrequency: "yearly", priority: 0.3 },
    { url: `${BASE_URL}/privacy`, changeFrequency: "yearly", priority: 0.3 },
    { url: `${BASE_URL}/cookie-policy`, changeFrequency: "yearly", priority: 0.2 },
  ];

  let eventPages: MetadataRoute.Sitemap = [];
  try {
    const events = await prisma.event.findMany({
      where: { eventEndtime: { gte: new Date() } },
      select: { eventId: true, updatedAt: true },
      orderBy: { eventDatetime: "asc" },
      take: 1000,
    });

    eventPages = events.map((e) => ({
      url: `${BASE_URL}/events/${e.eventId}`,
      lastModified: e.updatedAt,
      changeFrequency: "daily" as const,
      priority: 0.7,
    }));
  } catch {
    // DB unavailable — return static pages only
  }

  return [...staticPages, ...eventPages];
}
