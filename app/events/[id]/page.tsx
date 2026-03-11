/**
 * EventDetailPage -- Server component for individual event detail.
 *
 * Fetches event data, generates metadata, and renders EventDetailContent.
 */

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { auth } from "@/lib/auth/server";
import { getEvent } from "./data";
import { EventDetailContent } from "./EventDetailContent";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const event = await getEvent(id);
  if (!event) return { title: "Event not found" };

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? "https://meda.app";
  const eventUrl = `${baseUrl}/events/${id}`;
  const description =
    event.description?.slice(0, 160)?.trim() ||
    `${event.eventName} - ${new Date(event.eventDatetime).toLocaleDateString()} at ${event.addressLabel ?? event.eventLocation ?? "TBA"}`;
  const image = event.pictureUrl
    ? event.pictureUrl.startsWith("http")
      ? event.pictureUrl
      : `${baseUrl}${event.pictureUrl}`
    : `${baseUrl}/logo.png`;

  return {
    title: `${event.eventName} | Meda`,
    description,
    openGraph: {
      title: event.eventName,
      description,
      url: eventUrl,
      images: [{ url: image, alt: event.eventName }],
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: event.eventName,
      description,
      images: [image],
    },
  };
}

export default async function EventDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [event, session] = await Promise.all([
    getEvent(id),
    auth.getSession().catch(() => ({ data: null })),
  ]);
  if (!event) return notFound();

  const isSoldOut = event.capacity != null && event.capacity <= 0;
  const isAdmin =
    (session?.data?.user as { role?: string } | undefined)?.role === "admin";

  const priceLabel =
    event.priceField == null || event.priceField === 0
      ? "Free"
      : `ETB ${event.priceField}`;
  const startDate = new Date(event.eventDatetime);
  const endDate = new Date(event.eventEndtime);
  const locationLabel =
    event.addressLabel ?? event.eventLocation ?? "Location TBA";

  return (
    <EventDetailContent
      event={event}
      isSoldOut={isSoldOut}
      isAdmin={isAdmin}
      priceLabel={priceLabel}
      startDate={startDate}
      endDate={endDate}
      locationLabel={locationLabel}
    />
  );
}
