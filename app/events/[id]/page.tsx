import { notFound } from "next/navigation";
import { EventCard } from "@/app/components/EventCard";
import RegisterPanel from "@/app/components/RegisterPanel";
import StaticEventMap from "@/app/components/StaticEventMap";
import type { EventOccurrence, EventResponse } from "@/app/types/eventTypes";
import { PageShell } from "@/app/components/ui/page-shell";
import { Card } from "@/app/components/ui/card";
import { buttonVariants } from "@/app/components/ui/button";
import { cn } from "@/app/components/ui/cn";

type EventDetailResponse = EventResponse & { occurrences?: EventOccurrence[] };

async function getEvent(id: string): Promise<EventDetailResponse | null> {
  const base = process.env.NEXT_PUBLIC_BASE_URL ?? "";
  const res = await fetch(`${base}/api/events/${id}`, { cache: "no-store" });
  if (!res.ok) return null;
  const data = await res.json();
  return data.event as EventDetailResponse;
}

export default async function EventDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const event = await getEvent(id);
  if (!event) return notFound();

  const isSoldOut =
    event.capacity != null && (event.attendeeCount ?? 0) >= event.capacity;

  return (
    <PageShell>
      <div className="relative mx-auto flex max-w-6xl flex-col gap-8">
        <section className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
          <Card className="space-y-6 rounded-3xl bg-[#0d1a27]/80 p-6 backdrop-blur">
            <div className="rounded-2xl border border-[var(--color-border)] bg-[#0f2235]/60 p-4">
              <EventCard event={event} href="#" />
            </div>
            <article className="space-y-4 text-[var(--color-text-secondary)]">
              <h2 className="text-xl font-semibold text-white">About</h2>
              <p className="leading-relaxed whitespace-pre-line">
                {event.description ?? "No description yet."}
              </p>
              <div className="grid gap-3 text-sm text-[var(--color-text-muted)] sm:grid-cols-2">
                <div className="rounded-xl border border-[var(--color-border)] bg-[#0f1f2d] px-4 py-3">
                  Starts: {new Date(event.eventDatetime).toLocaleString()}
                </div>
                <div className="rounded-xl border border-[var(--color-border)] bg-[#0f1f2d] px-4 py-3">
                  Ends: {new Date(event.eventEndtime).toLocaleString()}
                </div>
                <div className="rounded-xl border border-[var(--color-border)] bg-[#0f1f2d] px-4 py-3">
                  Capacity: {event.capacity ?? "Unlimited"}
                </div>
                <div className="rounded-xl border border-[var(--color-border)] bg-[#0f1f2d] px-4 py-3">
                  Booked: {event.attendeeCount ?? 0}
                </div>
              </div>
              {event.occurrences && event.occurrences.length > 1 ? (
                <div className="rounded-xl border border-[var(--color-border)] bg-[#0f1f2d] px-4 py-3 text-sm text-[var(--color-text-muted)]">
                  Recurring series with {event.occurrences.length} upcoming
                  dates.
                </div>
              ) : null}
            </article>
          </Card>

          <div className="space-y-4">
            <Card className="space-y-2 rounded-3xl bg-[#0b1624]/90 p-4">
              {event.latitude != null && event.longitude != null ? (
                <StaticEventMap
                  latitude={event.latitude}
                  longitude={event.longitude}
                />
              ) : (
                <div className="rounded-2xl border border-[var(--color-border)] bg-[#0f1f2d] p-4 text-sm text-[var(--color-text-secondary)]">
                  Location not available.
                </div>
              )}
              <div className="flex items-center justify-end">
                <a
                  className={cn(
                    buttonVariants("secondary", "sm"),
                    "rounded-full border-[var(--color-border)]",
                  )}
                  href={buildDirectionsUrl(event)}
                  target="_blank"
                  rel="noreferrer"
                >
                  Get directions
                </a>
              </div>
            </Card>
            <RegisterPanel
              event={event}
              isSoldOut={isSoldOut}
              occurrences={event.occurrences}
            />
          </div>
        </section>
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
