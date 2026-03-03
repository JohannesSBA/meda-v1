import Link from "next/link";
import type { ComponentPropsWithoutRef } from "react";
import type { EventResponse } from "../types/eventTypes";
import { FaArrowRight, FaLocationDot } from "react-icons/fa6";
import { Badge } from "./ui/badge";

type EventCardProps = {
  event: EventResponse;
  href: string;
  isSaved?: boolean;
} & ComponentPropsWithoutRef<"a">;

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium",
  timeStyle: "short",
});

function formatDateRange(event: EventResponse) {
  const start = new Date(event.eventDatetime);
  const end = event.eventEndtime ? new Date(event.eventEndtime) : null;

  if (Number.isNaN(start.getTime())) {
    return null;
  }

  const startLabel = dateFormatter.format(start);

  if (!end || Number.isNaN(end.getTime())) {
    return startLabel;
  }

  const sameDay =
    start.getFullYear() === end.getFullYear() &&
    start.getMonth() === end.getMonth() &&
    start.getDate() === end.getDate();

  const endLabel = sameDay
    ? new Intl.DateTimeFormat("en-US", { timeStyle: "short" }).format(end)
    : dateFormatter.format(end);

  return `${startLabel} – ${endLabel}`;
}

export function EventCard({
  event,
  href,
  isSaved = false,
  className = "",
  ...rest
}: EventCardProps) {
  const dateLabel = formatDateRange(event);
  const locationLabel =
    event.addressLabel ?? event.eventLocation ?? "Location to be announced";

  const priceLabel =
    event.priceField == null || event.priceField === 0
      ? "Free"
      : `ETB ${event.priceField}`;

  // capacity in the Event model is remaining seats (decremented on registration)
  const slotsLeft = event.capacity != null ? Math.max(0, event.capacity) : null;

  return (
    <Link
      href={href}
      className={`group block h-full overflow-hidden rounded-3xl bg-gradient-to-br from-[var(--color-surface)] via-[var(--color-surface-2)] to-[var(--color-surface)] shadow-xl shadow-black/10 backdrop-blur-sm transition hover:-translate-y-2 hover:border-[var(--color-brand-alt)]/70 hover:shadow-[#22ff8833] focus-visible:-translate-y-2 focus-visible:border-[var(--color-brand)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#00E5FF33] border border-[var(--color-border)] ${className}`}
      {...rest}
    >
      <article className="flex h-full flex-col">
        <div className="relative h-36 overflow-hidden">
          <div
            className="absolute inset-0 transition duration-700 group-hover:scale-105 group-hover:brightness-110"
            style={{
              backgroundImage: event.pictureUrl
                ? `linear-gradient(180deg,rgba(255,255,255,0.3),rgba(248,250,252,0.85)), url(${event.pictureUrl})`
                : "radial-gradient(circle at 20% 20%, rgba(0,229,255,0.2), transparent 35%), radial-gradient(circle at 80% 0%, rgba(34,255,136,0.18), transparent 38%), linear-gradient(135deg, #e0f2fe 0%, #f0fdf4 100%)",
              backgroundSize: "cover",
              backgroundPosition: "center",
            }}
          />
          <div className="absolute left-4 right-4 top-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Badge className="bg-white/90 px-3 py-1 text-[11px] uppercase tracking-wide text-[var(--color-text-primary)] shadow-lg shadow-black/10 backdrop-blur-sm border border-[var(--color-border)]">
                {dateLabel ?? "Date TBA"}
              </Badge>
              {isSaved ? (
                <Badge
                  variant="accent"
                  className="px-3 py-1 text-[11px] font-bold text-[#001021] shadow-lg shadow-[#00e5ff1f]"
                >
                  Saved
                </Badge>
              ) : null}
            </div>
            {slotsLeft != null ? (
              <Badge
                variant="success"
                className="px-3 py-1 text-[11px] font-bold text-[#001021] shadow-lg shadow-[#22ff881f]"
              >
                {slotsLeft} seats left
              </Badge>
            ) : null}
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-[var(--color-surface)] via-[var(--color-surface)]/60 to-transparent" />
        </div>

        <div className="flex flex-1 flex-col gap-4 p-6">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1">
              <h3 className="text-xl font-semibold text-[var(--color-text-primary)] transition group-hover:text-[#22FF88]">
                {event.eventName}
              </h3>
              <p className="text-[11px] uppercase tracking-[0.12em] text-[var(--color-brand)]">
                {event.categoryId ? "Featured event" : "Community pick"}
              </p>
            </div>
            <span className="rounded-xl bg-[#00e5ff]/15 px-3 py-1 text-xs font-semibold text-[#00E5FF] shadow-inner">
              {priceLabel}
            </span>
          </div>

          <p className="line-clamp-3 text-sm leading-relaxed text-[var(--color-text-secondary)]">
            {event.description ?? "No additional details yet. Check back soon!"}
          </p>

          <div className="mt-auto flex items-center justify-between text-sm text-[var(--color-text-secondary)]">
            <span className="flex items-center gap-2 text-[var(--color-text-primary)]">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#22ff88]/20 text-[#22FF88] shadow-inner">
                <FaLocationDot className="size-3.5" />
              </span>
              <span className="line-clamp-1 text-sm">{locationLabel}</span>
            </span>
            <span className="flex items-center gap-2 rounded-full bg-[#22ff88]/15 px-3 py-2 text-[12px] font-semibold text-[#22FF88] transition group-hover:bg-[#00e5ff]/20 group-hover:text-[#00E5FF]">
              View details <FaArrowRight className="size-4" />
            </span>
          </div>
        </div>
      </article>
    </Link>
  );
}
