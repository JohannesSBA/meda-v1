import { EventCard } from "../components/EventCard";
import { EventResponse } from "../types/eventTypes";

async function getEvents(): Promise<EventResponse[]> {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "";
  try {
    const res = await fetch(`${baseUrl}/api/events/list`, {
      cache: "no-store",
    });
    if (!res.ok) throw new Error("Failed to fetch events");
    const data = await res.json();
    return data.items ?? [];
  } catch (err) {
    console.error(err);
    return [];
  }
}

export default async function EventsPage() {
  const events = await getEvents();

  return (
    <main className="max-w-3xl mx-auto py-8 px-6">
      <h1 className="text-3xl font-bold text-white mb-8">Find an Event</h1>
      {events.length === 0 ? (
        <div className="text-[#d6faff] text-lg">No events found.</div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2">
          {events.map((event) => (
            <EventCard
              key={event.event_id}
              event={event}
              href={`/events/${event.event_id}`}
            />
          ))}
        </div>
      )}
    </main>
  );
}