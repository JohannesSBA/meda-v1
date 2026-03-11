import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { auth } from "@/lib/auth/server";
import { prisma } from "@/lib/prisma";
import { decodeEventLocation } from "@/app/helpers/locationCodec";
import RegisterPanel from "@/app/components/RegisterPanel";
import StaticEventMap from "@/app/components/StaticEventMap";
import type { EventOccurrence, EventResponse } from "@/app/types/eventTypes";
import { PageShell } from "@/app/components/ui/page-shell";
import { Card } from "@/app/components/ui/card";
import { buttonVariants } from "@/app/components/ui/button";
import { cn } from "@/app/components/ui/cn";

type EventDetailResponse = EventResponse & { occurrences?: EventOccurrence[] };

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  weekday: "short",
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

async function getEvent(id: string): Promise<EventDetailResponse | null> {
  const event = await prisma.event.findUnique({
    where: { eventId: id },
    include: {
      category: true,
      _count: { select: { attendees: true } },
    },
  });

  if (!event) return null;

  const decoded = decodeEventLocation(event.eventLocation);

  let occurrences: EventOccurrence[] | undefined;
  if (event.seriesId) {
    const seriesEvents = await prisma.event.findMany({
      where: {
        seriesId: event.seriesId,
        eventEndtime: { gte: new Date() },
      },
      include: { _count: { select: { attendees: true } } },
      orderBy: { eventDatetime: "asc" },
      take: 120,
    });

    occurrences = seriesEvents.map((entry) => ({
      eventId: entry.eventId,
      eventDatetime: entry.eventDatetime.toISOString(),
      eventEndtime: entry.eventEndtime.toISOString(),
      attendeeCount: entry._count.attendees,
      capacity: entry.capacity,
      myTickets: 0,
      occurrenceIndex: entry.occurrenceIndex,
    }));
  }

  return {
    eventId: event.eventId,
    eventName: event.eventName,
    eventDatetime: event.eventDatetime.toISOString(),
    eventEndtime: event.eventEndtime.toISOString(),
    eventLocation: event.eventLocation,
    description: event.description,
    pictureUrl: event.pictureUrl,
    capacity: event.capacity,
    priceField: event.priceField,
    userId: event.userId,
    categoryId: event.categoryId,
    categoryName: event.category?.categoryName ?? null,
    seriesId: event.seriesId,
    occurrenceIndex: event.occurrenceIndex,
    attendeeCount: event._count.attendees,
    addressLabel: decoded.addressLabel,
    latitude: decoded.latitude,
    longitude: decoded.longitude,
    myTickets: null,
    occurrences,
  };
}

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
    ? (event.pictureUrl.startsWith("http") ? event.pictureUrl : `${baseUrl}${event.pictureUrl}`)
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
  const isAdmin = (session?.data?.user as { role?: string } | undefined)?.role === "admin";

  const priceLabel =
    event.priceField == null || event.priceField === 0
      ? "Free"
      : `ETB ${event.priceField}`;
  const startDate = new Date(event.eventDatetime);
  const endDate = new Date(event.eventEndtime);
  const locationLabel = event.addressLabel ?? event.eventLocation ?? "Location TBA";

  return (
    <PageShell className="!mt-0 sm:!mt-[calc(4rem+env(safe-area-inset-top,0px))]">
      {/* Mobile hero image */}
      <div className="relative aspect-video w-full sm:hidden">
        {event.pictureUrl ? (
          <Image
            src={event.pictureUrl}
            alt={event.eventName}
            fill
            priority
            className="object-cover"
            sizes="100vw"
          />
        ) : (
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(0,229,255,0.25),transparent_35%),radial-gradient(circle_at_80%_0%,rgba(34,255,136,0.22),transparent_38%),linear-gradient(135deg,#0f2b3f,#0b1d2d)]" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-[#050d17] via-[#050d17]/40 to-transparent" />
        <Link
          href="/events"
          className="absolute left-4 top-[calc(env(safe-area-inset-top,0px)+0.75rem)] flex h-10 w-10 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur-sm"
          aria-label="Back to events"
        >
          <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </Link>
      </div>

      <div className="relative mx-auto flex max-w-6xl flex-col gap-6 px-4 py-4 sm:gap-8 sm:px-0">
        {/* Admin scan QR bar */}
        {isAdmin ? (
          <Link
            href={`/events/${event.eventId}/scan`}
            className={cn(
              buttonVariants("primary", "lg"),
              "h-12 w-full justify-center gap-2 rounded-2xl text-base font-bold",
            )}
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="7" height="7" />
              <rect x="14" y="3" width="7" height="7" />
              <rect x="3" y="14" width="7" height="7" />
              <rect x="14" y="14" width="7" height="7" />
            </svg>
            Scan QR codes
          </Link>
        ) : null}

        {/* Title + price row - visible on mobile below hero */}
        <div className="sm:hidden">
          <div className="flex items-start justify-between gap-3">
            <h1 className="text-2xl font-bold leading-tight text-white">
              {event.eventName}
            </h1>
            <span className="shrink-0 rounded-xl bg-[var(--color-brand)]/15 px-3 py-1.5 text-sm font-bold text-[var(--color-brand)]">
              {priceLabel}
            </span>
          </div>
          <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
            {dateFormatter.format(startDate)}
          </p>
          <p className="mt-0.5 text-sm text-[var(--color-text-muted)]">
            {locationLabel}
          </p>
        </div>

        <section className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
          {/* Main content column */}
          <div className="space-y-6">
            {/* Desktop hero card */}
            <Card className="hidden space-y-4 overflow-hidden rounded-2xl bg-[#0d1a27]/80 sm:block">
              <div className="relative aspect-video w-full overflow-hidden">
                {event.pictureUrl ? (
                  <Image
                    src={event.pictureUrl}
                    alt={event.eventName}
                    fill
                    priority
                    className="object-cover"
                    sizes="(max-width: 1024px) 100vw, 60vw"
                  />
                ) : (
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(0,229,255,0.25),transparent_35%),radial-gradient(circle_at_80%_0%,rgba(34,255,136,0.22),transparent_38%),linear-gradient(135deg,#0f2b3f,#0b1d2d)]" />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-[#0d1a27] via-transparent to-transparent" />
              </div>
              <div className="px-6 pb-6">
                <div className="flex items-start justify-between gap-4">
                  <h1 className="text-3xl font-bold text-white">{event.eventName}</h1>
                  <span className="shrink-0 rounded-xl bg-[var(--color-brand)]/15 px-4 py-2 text-lg font-bold text-[var(--color-brand)]">
                    {priceLabel}
                  </span>
                </div>
              </div>
            </Card>

            {/* Host */}
            {event.userId ? (
              <section className="space-y-3">
                <h2 className="text-lg font-semibold text-white">Host</h2>
                <div className="flex items-center gap-3 rounded-xl border border-[var(--color-border)] bg-[#0f1f2d] px-4 py-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--color-brand)]/20 text-sm font-bold text-[var(--color-brand)]">
                    H
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-white">Event Organizer</p>
                  </div>
                  <Link
                    href={`/hosts/${event.userId}`}
                    className="text-sm font-medium text-[var(--color-brand)] active:opacity-70"
                  >
                    View profile
                  </Link>
                </div>
              </section>
            ) : null}

            {/* About */}
            <section className="space-y-3">
              <h2 className="text-lg font-semibold text-white">About</h2>
              <p className="whitespace-pre-line text-base leading-relaxed text-[var(--color-text-secondary)]">
                {event.description ?? "No description yet."}
              </p>
            </section>

            {/* Details grid */}
            <section className="space-y-3">
              <h2 className="text-lg font-semibold text-white">Details</h2>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-[var(--color-border)] bg-[#0f1f2d] px-4 py-3">
                  <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-brand)]">Starts</p>
                  <p className="mt-1 text-sm text-[var(--color-text-secondary)]">{startDate.toLocaleString()}</p>
                </div>
                <div className="rounded-xl border border-[var(--color-border)] bg-[#0f1f2d] px-4 py-3">
                  <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-brand)]">Ends</p>
                  <p className="mt-1 text-sm text-[var(--color-text-secondary)]">{endDate.toLocaleString()}</p>
                </div>
                <div className="rounded-xl border border-[var(--color-border)] bg-[#0f1f2d] px-4 py-3">
                  <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-brand)]">Seats left</p>
                  <p className="mt-1 text-sm text-[var(--color-text-secondary)]">{event.capacity != null ? event.capacity : "Unlimited"}</p>
                </div>
                <div className="rounded-xl border border-[var(--color-border)] bg-[#0f1f2d] px-4 py-3">
                  <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-brand)]">Booked</p>
                  <p className="mt-1 text-sm text-[var(--color-text-secondary)]">{event.attendeeCount ?? 0}</p>
                </div>
              </div>
              {event.occurrences && event.occurrences.length > 1 ? (
                <div className="rounded-xl border border-[var(--color-border)] bg-[#0f1f2d] px-4 py-3 text-sm text-[var(--color-text-muted)]">
                  Recurring series with {event.occurrences.length} upcoming dates.
                </div>
              ) : null}
            </section>

            {/* Location */}
            <section className="space-y-3">
              <h2 className="text-lg font-semibold text-white">Location</h2>
              <Card className="overflow-hidden rounded-2xl bg-[#0b1624]/90">
                {event.latitude != null && event.longitude != null ? (
                  <div className="h-[200px] w-full">
                    <StaticEventMap
                      latitude={event.latitude}
                      longitude={event.longitude}
                    />
                  </div>
                ) : (
                  <div className="px-4 py-6 text-center text-sm text-[var(--color-text-secondary)]">
                    Location not available.
                  </div>
                )}
                <div className="flex flex-wrap items-center gap-2 p-3">
                  {isAdmin ? (
                    <Link
                      href={`/events/${event.eventId}/scan`}
                      className={cn(
                        buttonVariants("primary", "md"),
                        "h-11 rounded-full",
                      )}
                    >
                      Scan QR codes
                    </Link>
                  ) : null}
                  <a
                    className={cn(
                      buttonVariants("secondary", "md"),
                      "h-11 rounded-full",
                    )}
                    href={`/api/events/${event.eventId}/ics`}
                    download
                  >
                    Add to calendar
                  </a>
                  <a
                    className={cn(
                      buttonVariants("secondary", "md"),
                      "h-11 rounded-full",
                    )}
                    href={buildDirectionsUrl(event)}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Get directions
                  </a>
                </div>
              </Card>
            </section>
          </div>

          {/* Sidebar - RegisterPanel (hidden on mobile, shown via sticky CTA) */}
          <div className="hidden space-y-4 md:block">
            <RegisterPanel
              event={event}
              isSoldOut={isSoldOut}
              occurrences={event.occurrences}
            />
          </div>
        </section>

        {/* Mobile-only inline RegisterPanel (below content) */}
        <div className="md:hidden">
          <RegisterPanel
            event={event}
            isSoldOut={isSoldOut}
            occurrences={event.occurrences}
          />
        </div>
      </div>

      {/* Mobile sticky bottom CTA */}
      <div className="bottom-action-bar">
        <div className="mx-auto max-w-6xl px-4">
          <a
            href="#register-panel"
            className={cn(
              buttonVariants("primary", "lg"),
              "h-[52px] w-full justify-center rounded-2xl text-base font-bold",
            )}
          >
            {isSoldOut
              ? "Sold out"
              : (event.priceField ?? 0) > 0
                ? `Get tickets · ${priceLabel}`
                : "Get tickets · Free"}
          </a>
        </div>
      </div>
    </PageShell>
  );
}

function buildDirectionsUrl(event: EventResponse) {
  if (event.latitude != null && event.longitude != null) {
    return `https://www.google.com/maps/dir/?api=1&destination=${event.latitude},${event.longitude}`;
  }
  if (event.addressLabel) {
    return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(event.addressLabel)}`;
  }
  return "https://www.google.com/maps";
}
