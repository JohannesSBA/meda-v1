
import { notFound } from "next/navigation";
import { EventCard } from "@/app/components/EventCard";
import RegisterPanel from "@/app/components/RegisterPanel";
import StaticEventMap from "@/app/components/StaticEventMap";
import type { EventResponse } from "@/app/types/eventTypes";

async function getEvent(id: string): Promise<EventResponse | null> {
  const base = process.env.NEXT_PUBLIC_BASE_URL ?? "";
  const res = await fetch(`${base}/api/events/${id}`, { cache: "no-store" });
  if (!res.ok) return null;
  const data = await res.json();
  return data.event as EventResponse;
}

export default async function EventDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const event = await getEvent(id);
  if (!event) return notFound();

  const isSoldOut = event.capacity != null && (event.attendeeCount ?? 0) >= event.capacity;

  return (
    <main className="min-h-screen bg-[#061224 ] text-white -z-10 fixed bottom-0 left-0 right-0">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(0,229,255,0.08),transparent_35%),radial-gradient(circle_at_80%_0%,rgba(34,255,136,0.08),transparent_32%),linear-gradient(140deg,#0b1725_10%,#0c1b2f_40%,#0a1321_100%)]" />
      <div className="relative mx-auto flex max-w-6xl flex-col gap-8 px-6 py-10">
        <section className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
          <div className="space-y-6 rounded-3xl border border-white/6 bg-[#0d1a27]/80 p-6 shadow-2xl shadow-[#00e5ff12] backdrop-blur">
            <div className="rounded-2xl border border-white/8 bg-[#0f2235]/60 p-4">
              <EventCard event={event} href="#" />
            </div>
            <article className="space-y-4 text-[#c5d7ec]">
              <h2 className="text-xl font-semibold text-white">About</h2>
              <p className="leading-relaxed whitespace-pre-line">{event.description ?? "No description yet."}</p>
              <div className="grid gap-3 text-sm text-[#9fc4e4] sm:grid-cols-2">
                <div className="rounded-xl border border-white/10 bg-[#0f1f2d] px-4 py-3">Starts: {new Date(event.eventDatetime).toLocaleString()}</div>
                <div className="rounded-xl border border-white/10 bg-[#0f1f2d] px-4 py-3">Ends: {new Date(event.eventEndtime).toLocaleString()}</div>
                <div className="rounded-xl border border-white/10 bg-[#0f1f2d] px-4 py-3">Capacity: {event.capacity ?? "Unlimited"}</div>
                <div className="rounded-xl border border-white/10 bg-[#0f1f2d] px-4 py-3">Booked: {event.attendeeCount ?? 0}</div>
              </div>
            </article>
          </div>

          <div className="space-y-4">
            <div className="space-y-2 rounded-3xl border border-white/6 bg-[#0b1624]/90 p-4 shadow-xl shadow-[#00e5ff12]">
              {event.latitude != null && event.longitude != null ? (
                <StaticEventMap latitude={event.latitude} longitude={event.longitude} />
              ) : (
                <div className="rounded-2xl border border-white/10 bg-[#0f1f2d] p-4 text-sm text-[#c5d7ec]">
                  Location not available.
                </div>
              )}
              <div className="flex items-center justify-end">
                <a
                  className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/10 px-4 py-2 text-sm font-semibold text-white transition hover:border-[#22FF88] hover:text-[#22FF88]"
                  href={buildDirectionsUrl(event)}
                  target="_blank"
                  rel="noreferrer"
                >
                  Get directions
                </a>
              </div>
            </div>
            <RegisterPanel event={event} isSoldOut={isSoldOut} />
          </div>
        </section>
      </div>
    </main>
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
