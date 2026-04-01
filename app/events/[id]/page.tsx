/**
 * EventDetailPage -- Server component for individual event detail.
 *
 * Fetches event data, generates metadata, and renders EventDetailContent.
 */

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { canScanEvent } from "@/lib/auth/roles";
import { getAppBaseUrl } from "@/lib/env";
import { auth } from "@/lib/auth/server";
import { getEvent } from "./data";
import { EventDetailContent } from "./EventDetailContent";
import { getEventReviewStateForUser } from "@/services/hostReviews";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const event = await getEvent(id);
  if (!event) return { title: "Event not found" };

  const baseUrl = getAppBaseUrl();
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

  const sessionUser = (session?.data?.user as {
    id?: string;
    role?: string;
    parentPitchOwnerUserId?: string | null;
  } | undefined) ?? null;
  const isSoldOut = event.spotsLeft != null && event.spotsLeft <= 0;
  const canScan = canScanEvent(sessionUser, event.userId);
  const reviewState = sessionUser?.id
    ? await getEventReviewStateForUser({ eventId: event.eventId, reviewerId: sessionUser.id })
    : null;

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
      canScan={canScan}
      priceLabel={priceLabel}
      startDate={startDate}
      endDate={endDate}
      locationLabel={locationLabel}
      reviewState={reviewState}
    />
  );
}
