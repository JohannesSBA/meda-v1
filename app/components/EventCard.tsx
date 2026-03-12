/**
 * EventCard -- card displaying event summary with image, title, date, location, and save action.
 */

import Link from "next/link";
import Image from "next/image";
import type { ComponentPropsWithoutRef } from "react";
import type { EventResponse } from "../types/eventTypes";
import { FaBookmark, FaLocationDot, FaRegBookmark } from "react-icons/fa6";

type EventCardProps = {
  event: EventResponse;
  href: string;
  isSaved?: boolean;
  onSaveToggle?: (eventId: string, isSaved: boolean) => void | Promise<void>;
} & ComponentPropsWithoutRef<"article">;

const shortDateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

function formatShortDate(event: EventResponse) {
  const start = new Date(event.eventDatetime);
  if (Number.isNaN(start.getTime())) return null;
  return shortDateFormatter.format(start);
}

function SaveButton({
  eventId,
  isSaved,
  onSaveToggle,
  className,
}: {
  eventId: string;
  isSaved: boolean;
  onSaveToggle: (eventId: string, isSaved: boolean) => void | Promise<void>;
  className: string;
}) {
  return (
    <button
      type="button"
      onClick={() => {
        void onSaveToggle(eventId, isSaved);
      }}
      className={className}
      aria-label={isSaved ? "Remove from saved" : "Save event"}
    >
      {isSaved ? (
        <FaBookmark className="h-4 w-4 text-[var(--color-brand)] sm:h-5 sm:w-5" />
      ) : (
        <FaRegBookmark className="h-4 w-4 sm:h-5 sm:w-5" />
      )}
    </button>
  );
}

export function EventCard({
  event,
  href,
  isSaved = false,
  onSaveToggle,
  className = "",
  ...rest
}: EventCardProps) {
  const dateLabel = formatShortDate(event);
  const locationLabel =
    event.addressLabel ?? event.eventLocation ?? "Location TBA";

  const priceLabel =
    event.priceField == null || event.priceField === 0
      ? "Free"
      : `ETB ${event.priceField}`;

  const categoryLabel =
    event.categoryName ??
    (event.categoryId ? "Featured" : "Community");

  const spotsLabel =
    event.spotsLeft ?? event.capacity ?? null;

  return (
    <article
      className={`group relative h-full overflow-hidden rounded-2xl border border-[var(--color-border)] bg-gradient-to-br from-[#0d1a27] via-[#0f2235] to-[#0b1624] shadow-lg shadow-black/30 transition will-change-transform active:scale-[0.98] sm:hover:-translate-y-1 focus-within:outline-none focus-within:ring-2 focus-within:ring-[var(--color-ring)] ${className}`}
      {...rest}
    >
      <Link
        href={href}
        aria-label={`View ${event.eventName}`}
        className="absolute inset-0 z-10 rounded-2xl"
      />

      <div className="relative z-0 flex items-stretch sm:hidden">
        <div className="relative h-28 w-28 shrink-0 overflow-hidden">
          {event.pictureUrl ? (
            <Image
              src={event.pictureUrl}
              alt={event.eventName}
              fill
              className="object-cover"
              sizes="112px"
            />
          ) : (
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(0,229,255,0.25),transparent_35%),radial-gradient(circle_at_80%_0%,rgba(34,255,136,0.22),transparent_38%),linear-gradient(135deg,#0f2b3f,#0b1d2d)]" />
          )}
          <span className="absolute left-1.5 top-1.5 rounded-full bg-black/60 px-2 py-0.5 text-[0.6875rem] font-semibold text-white backdrop-blur-sm">
            {categoryLabel}
          </span>
        </div>
        <div className="flex flex-1 flex-col justify-center gap-0.5 px-3 py-2.5">
          <h3 className="line-clamp-2 text-sm font-semibold leading-snug text-white">
            {event.eventName}
          </h3>
          {dateLabel ? (
            <p className="text-xs text-[var(--color-text-secondary)]">{dateLabel}</p>
          ) : null}
          <p className="flex items-center gap-1 text-xs text-[var(--color-text-muted)]">
            <FaLocationDot className="h-3 w-3 shrink-0 text-[var(--color-brand-alt)]" />
            <span className="line-clamp-1">{locationLabel}</span>
          </p>
          <div className="mt-auto flex items-center justify-between pt-1">
            <span className="text-sm font-bold text-white">{priceLabel}</span>
            {spotsLabel != null && spotsLabel > 0 ? (
              <span className="rounded-full bg-[var(--color-brand-alt)]/15 px-2 py-0.5 text-[0.6875rem] font-semibold text-[var(--color-brand-alt)]">
                {spotsLabel} left
              </span>
            ) : null}
          </div>
        </div>
      </div>

      <div className="relative z-0 hidden h-full flex-col sm:flex">
        <div className="relative aspect-video w-full overflow-hidden">
          {event.pictureUrl ? (
            <Image
              src={event.pictureUrl}
              alt={event.eventName}
              fill
              className="object-cover transition duration-500 group-hover:scale-105"
              sizes="(max-width: 1024px) 50vw, 33vw"
            />
          ) : (
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(0,229,255,0.25),transparent_35%),radial-gradient(circle_at_80%_0%,rgba(34,255,136,0.22),transparent_38%),linear-gradient(135deg,#0f2b3f,#0b1d2d)]" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-[#0d1a27] via-transparent to-transparent" />

          <span className="absolute left-3 top-3 rounded-full bg-black/60 px-2.5 py-1 text-xs font-semibold text-white backdrop-blur-sm">
            {categoryLabel}
          </span>
        </div>

        <div className="flex flex-1 flex-col gap-2 p-4">
          <h3 className="line-clamp-2 text-lg font-semibold leading-snug text-white">
            {event.eventName}
          </h3>

          {dateLabel ? (
            <p className="text-sm text-[var(--color-text-secondary)]">
              {dateLabel}
            </p>
          ) : null}

          <p className="flex items-center gap-1.5 text-sm text-[var(--color-text-muted)]">
            <FaLocationDot className="h-3.5 w-3.5 shrink-0 text-[var(--color-brand-alt)]" />
            <span className="line-clamp-1">{locationLabel}</span>
          </p>

          <div className="mt-auto flex items-center justify-between pt-2">
            <span className="text-base font-bold text-white">
              {priceLabel}
            </span>
            {spotsLabel != null && spotsLabel > 0 ? (
              <span className="rounded-full bg-[var(--color-brand-alt)]/15 px-2.5 py-1 text-xs font-semibold text-[var(--color-brand-alt)]">
                {spotsLabel} left
              </span>
            ) : null}
          </div>
        </div>
      </div>

      {onSaveToggle ? (
        <>
          <SaveButton
            eventId={event.eventId}
            isSaved={isSaved}
            onSaveToggle={onSaveToggle}
            className="absolute bottom-0 right-0 z-20 flex h-full w-11 items-center justify-center border-l border-[var(--color-border)] text-white transition active:scale-90 sm:hidden"
          />
          <SaveButton
            eventId={event.eventId}
            isSaved={isSaved}
            onSaveToggle={onSaveToggle}
            className="absolute right-3 top-3 z-20 hidden h-11 w-11 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur-sm transition active:scale-90 sm:flex sm:hover:bg-black/70 sm:hover:text-[var(--color-brand-alt)]"
          />
        </>
      ) : null}
    </article>
  );
}
