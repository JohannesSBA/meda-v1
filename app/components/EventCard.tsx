/**
 * EventCard -- card displaying event summary with image, title, date, location, and save action.
 */

import Link from "next/link";
import Image from "next/image";
import type { ComponentPropsWithoutRef } from "react";
import type { EventResponse } from "../types/eventTypes";
import { Card } from "./ui/card";
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
}: {
  eventId: string;
  isSaved: boolean;
  onSaveToggle: (eventId: string, isSaved: boolean) => void | Promise<void>;
}) {
  return (
    <button
      type="button"
      onClick={() => {
        void onSaveToggle(eventId, isSaved);
      }}
      className="absolute right-3 top-3 z-20 flex h-10 w-10 items-center justify-center rounded-full border border-[var(--color-border-strong)] bg-[rgba(7,17,26,0.92)] text-[var(--color-text-primary)] backdrop-blur transition hover:border-[rgba(125,211,252,0.28)] hover:text-[var(--color-brand)]"
      aria-label={isSaved ? "Remove from saved" : "Save event"}
    >
      {isSaved ? <FaBookmark className="h-4 w-4 text-[var(--color-brand)]" /> : <FaRegBookmark className="h-4 w-4" />}
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
  const locationLabel = event.addressLabel ?? event.eventLocation ?? "Location TBA";
  const priceLabel = event.priceField == null || event.priceField === 0 ? "Free" : `ETB ${event.priceField}`;
  const categoryLabel = event.categoryName ?? (event.categoryId ? "Featured" : "Community");
  const spotsLabel = event.spotsLeft ?? event.capacity ?? null;
  const hostSummaryLabel =
    event.hostReviewCount && event.hostReviewCount > 0 && event.hostAverageRating
      ? `${event.hostAverageRating.toFixed(1)}★ (${event.hostReviewCount})`
      : "New host";
  const fitLine = [dateLabel, locationLabel, priceLabel, spotsLabel != null ? `${spotsLabel} spots left` : null]
    .filter(Boolean)
    .join(" · ");

  return (
    <Card as="article" className={`group relative h-full overflow-hidden ${className}`} {...rest}>
      {onSaveToggle ? (
        <SaveButton eventId={event.eventId} isSaved={isSaved} onSaveToggle={onSaveToggle} />
      ) : null}

      <Link href={href} className="flex h-full flex-col" aria-label={`View ${event.eventName}`}>
        <div className="relative aspect-[16/10] overflow-hidden">
          {event.pictureUrl ? (
            <Image
              src={event.pictureUrl}
              alt={event.eventName}
              fill
              className="object-cover transition duration-500 group-hover:scale-105"
              sizes="(max-width: 768px) 100vw, (max-width: 1280px) 50vw, 33vw"
            />
          ) : (
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_18%,rgba(125,211,252,0.22),transparent_28%),radial-gradient(circle_at_100%_0%,rgba(52,211,153,0.18),transparent_24%),linear-gradient(135deg,#102033,#0b1724)]" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-[rgba(6,17,27,0.84)] via-[rgba(6,17,27,0.22)] to-transparent" />
          <div className="absolute inset-x-3 bottom-3 flex items-center justify-between gap-3">
            <span className="rounded-full border border-[var(--color-border-strong)] bg-[rgba(7,17,26,0.78)] px-2.5 py-1 text-[0.72rem] font-semibold uppercase tracking-[0.16em] text-[var(--color-text-primary)] backdrop-blur">
              {categoryLabel}
            </span>
            <span className="rounded-full border border-[rgba(125,211,252,0.22)] bg-[rgba(125,211,252,0.16)] px-3 py-1 text-xs font-semibold text-[var(--color-text-primary)] backdrop-blur">
              {priceLabel}
            </span>
          </div>
        </div>

        <div className="flex flex-1 flex-col gap-2.5 p-4">
          <div className="space-y-1.5">
            <h3 className="line-clamp-2 text-lg font-semibold tracking-[-0.03em] text-[var(--color-text-primary)] sm:text-xl">
              {event.eventName}
            </h3>
            {dateLabel ? <p className="text-sm text-[var(--color-text-secondary)]">{dateLabel}</p> : null}
            <p className="flex items-center gap-2 text-sm text-[var(--color-text-muted)]">
              <FaLocationDot className="h-3.5 w-3.5 shrink-0 text-[var(--color-brand-alt)]" />
              <span className="line-clamp-1">{locationLabel}</span>
            </p>
            <p className="text-sm text-[var(--color-text-secondary)] line-clamp-2">
              Good fit if you want: {fitLine}
            </p>
          </div>

          <div className="mt-auto flex items-center justify-between gap-3 pt-1 text-sm">
            <div className="flex flex-col gap-1">
              <span className="font-medium text-[#c9ffea]">
                {spotsLabel != null && spotsLabel > 0
                  ? `${spotsLabel} spots left`
                  : `${event.attendeeCount ?? 0} attending`}
              </span>
              <span className="text-xs text-[var(--color-text-muted)]">{hostSummaryLabel}</span>
            </div>
            <span className="rounded-full border border-[var(--color-border)] px-2 py-0.5 text-[10px] font-semibold tracking-wide text-[var(--color-text-secondary)]">
              {(event.hostTrustBadge ?? "NEW_HOST").replaceAll("_", " ")}
            </span>
            <span className="font-medium text-[var(--color-text-secondary)] transition group-hover:text-[var(--color-text-primary)]">
              View details
            </span>
          </div>
        </div>
      </Link>
    </Card>
  );
}
