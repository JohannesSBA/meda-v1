/**
 * EventDetailContent -- Hero, host, about, details, and location sections for event detail page.
 *
 * Server component. Renders the main content column; RegisterPanel is rendered by the page.
 */

import Link from "next/link";
import Image from "next/image";
import RegisterPanel from "@/app/components/RegisterPanel";
import StaticEventMapClient from "@/app/components/StaticEventMapClient";
import { PageShell } from "@/app/components/ui/page-shell";
import { Card } from "@/app/components/ui/card";
import { buttonVariants } from "@/app/components/ui/button";
import { cn } from "@/app/components/ui/cn";
import type { EventDetailResponse } from "./data";
import { buildDirectionsUrl } from "./data";

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  weekday: "short",
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

type EventDetailContentProps = {
  event: EventDetailResponse;
  isSoldOut: boolean;
  canScan: boolean;
  priceLabel: string;
  startDate: Date;
  endDate: Date;
  locationLabel: string;
};

export function EventDetailContent({
  event,
  isSoldOut,
  canScan,
  priceLabel,
  startDate,
  endDate,
  locationLabel,
}: EventDetailContentProps) {
  const directionsUrl = buildDirectionsUrl(event);

  return (
    <PageShell className="!mt-0 sm:!mt-[calc(4rem+env(safe-area-inset-top,0px))]">
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
          <svg
            className="h-5 w-5"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </Link>
      </div>

      <div className="relative mx-auto flex max-w-6xl flex-col gap-6 px-4 py-4 sm:gap-8 sm:px-0">
        {canScan ? (
          <Link
            href={`/events/${event.eventId}/scan`}
            className={cn(
              buttonVariants("primary", "lg"),
              "h-12 w-full justify-center gap-2 rounded-2xl text-base font-bold",
            )}
          >
            <svg
              className="h-5 w-5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="3" y="3" width="7" height="7" />
              <rect x="14" y="3" width="7" height="7" />
              <rect x="3" y="14" width="7" height="7" />
              <rect x="14" y="14" width="7" height="7" />
            </svg>
            Scan QR codes
          </Link>
        ) : null}

        <div className="sm:hidden">
          <div className="flex items-start justify-between gap-3">
            <h1 className="text-2xl font-bold leading-tight text-white">{event.eventName}</h1>
            <span className="shrink-0 rounded-xl bg-[var(--color-brand)]/15 px-3 py-1.5 text-sm font-bold text-[var(--color-brand)]">
              {priceLabel}
            </span>
          </div>
          <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
            {dateFormatter.format(startDate)}
          </p>
          <a
            href={directionsUrl}
            target="_blank"
            rel="noreferrer"
            className="mt-0.5 inline-flex items-center gap-1 text-sm text-[var(--color-text-muted)] active:opacity-70"
          >
            <svg
              className="h-3.5 w-3.5 shrink-0"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
              <circle cx="12" cy="10" r="3" />
            </svg>
            {locationLabel}
          </a>
        </div>

        <section className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
          <div className="space-y-6">
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

            <section className="space-y-3">
              <h2 className="text-lg font-semibold text-white">About</h2>
              <p className="whitespace-pre-line text-base leading-relaxed text-[var(--color-text-secondary)]">
                {event.description ?? "No description yet."}
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-lg font-semibold text-white">Details</h2>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-[var(--color-border)] bg-[#0f1f2d] px-4 py-3">
                  <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-brand)]">
                    Starts
                  </p>
                  <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
                    {startDate.toLocaleString()}
                  </p>
                </div>
                <div className="rounded-xl border border-[var(--color-border)] bg-[#0f1f2d] px-4 py-3">
                  <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-brand)]">
                    Ends
                  </p>
                  <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
                    {endDate.toLocaleString()}
                  </p>
                </div>
                <div className="rounded-xl border border-[var(--color-border)] bg-[#0f1f2d] px-4 py-3">
                  <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-brand)]">
                    Seats left
                  </p>
                  <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
                    {event.spotsLeft != null ? event.spotsLeft : "Unlimited"}
                  </p>
                </div>
                {event.capacityTotal != null ? (
                  <div className="rounded-xl border border-[var(--color-border)] bg-[#0f1f2d] px-4 py-3">
                    <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-brand)]">
                      Total capacity
                    </p>
                    <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
                      {event.capacityTotal}
                    </p>
                  </div>
                ) : null}
                <div className="rounded-xl border border-[var(--color-border)] bg-[#0f1f2d] px-4 py-3">
                  <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-brand)]">
                    Booked
                  </p>
                  <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
                    {event.attendeeCount ?? 0}
                  </p>
                </div>
              </div>
              {event.occurrences && event.occurrences.length > 1 ? (
                <div className="rounded-xl border border-[var(--color-border)] bg-[#0f1f2d] px-4 py-3 text-sm text-[var(--color-text-muted)]">
                  Recurring series with {event.occurrences.length} upcoming dates.
                </div>
              ) : null}
            </section>

            <section className="space-y-3">
              <h2 className="text-lg font-semibold text-white">Location</h2>
              <Card className="overflow-hidden rounded-2xl bg-[#0b1624]/90">
                {event.latitude != null && event.longitude != null ? (
                  <div className="h-[200px] w-full overflow-hidden">
                    <StaticEventMapClient
                      latitude={event.latitude}
                      longitude={event.longitude}
                    />
                  </div>
                ) : (
                  <div className="px-4 py-6 text-center text-sm text-[var(--color-text-secondary)]">
                    Location not available.
                  </div>
                )}
                <div className="relative z-10 space-y-2 p-3">
                  <p className="text-sm font-medium text-[var(--color-text-secondary)]">
                    {locationLabel}
                  </p>
                  <div className="flex flex-wrap items-center gap-2">
                    {canScan ? (
                      <Link
                        href={`/events/${event.eventId}/scan`}
                        className={cn(buttonVariants("primary", "md"), "h-11 rounded-full")}
                      >
                        Scan QR codes
                      </Link>
                    ) : null}
                    <a
                      className={cn(buttonVariants("secondary", "md"), "h-11 rounded-full")}
                      href={`/api/events/${event.eventId}/ics`}
                      download
                    >
                      Add to calendar
                    </a>
                    <a
                      className={cn(buttonVariants("secondary", "md"), "h-11 rounded-full")}
                      href={directionsUrl}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Get directions
                    </a>
                  </div>
                </div>
              </Card>
            </section>
          </div>

          <div className="hidden space-y-4 md:block">
            <RegisterPanel event={event} isSoldOut={isSoldOut} occurrences={event.occurrences} />
          </div>
        </section>

        <div className="md:hidden">
          <RegisterPanel event={event} isSoldOut={isSoldOut} occurrences={event.occurrences} />
        </div>
      </div>

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
