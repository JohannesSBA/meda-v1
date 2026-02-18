

import Link from "next/link";
import type { ComponentPropsWithoutRef } from "react";
import type { EventResponse } from "../types/eventTypes";
// import { decodeEventLocation } from "@/helpers/locationCodec";
import { FaArrowRight, FaLocationDot } from "react-icons/fa6";

type EventCardProps = {
  event: EventResponse;
  href: string;
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
  className = "",
  ...rest
}: EventCardProps) {
  const dateLabel = formatDateRange(event);
//   const decodedLocation = decodeEventLocation(event.event_location);
//   const locationLabel =
//     decodedLocation?.address ??
//     event.event_location ??
//     "Location to be announced";

  return (
    <Link
      href={href}
      className={`group block h-full rounded-3xl border border-[#18344b] bg-[#0f2235]/90 shadow-lg shadow-[#00e5ff1a] transition hover:-translate-y-1 hover:border-[#22FF88] hover:shadow-[#00e5ff33] focus-visible:-translate-y-1 focus-visible:border-[#00E5FF] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#00E5FF33] ${className}`}
      {...rest}
    >
      <article className="flex h-full flex-col gap-5 p-6">
        <div className="flex items-start justify-between gap-4">
          <h3 className="text-xl font-semibold text-white transition group-hover:text-[#22FF88]">
            {event.eventName}
          </h3>
          {event.capacity ? (
            <span className="rounded-full border border-[#1f3850] bg-[#0b1c2d] px-3 py-1 text-xs font-medium text-[#89e7ff]">
              {event.capacity - (event.attendeeCount ?? 0)} player slots left
            </span>
          ) : null}
        </div>

        {dateLabel ? (
          <p className="text-sm font-medium text-[#c0d5ec]">
            {dateLabel}
          </p>
        ) : null}

        <p className="line-clamp-3 text-sm text-[#9fb6ce]">
          {event.description ?? "No additional details yet. Check back soon!"}
        </p>

        <div className="mt-auto flex items-center justify-between text-sm text-[#9fb6ce]">
          <span className="flex items-center gap-2">
            <FaLocationDot className="size-4" />
            {/* {locationLabel} */}
          </span>
          <span className="font-medium items-center gap-2 flex text-[#22FF88] transition group-hover:text-[#00E5FF]">
            View details <FaArrowRight className="size-4" />
          </span>
        </div>
      </article>
    </Link>
  );
}