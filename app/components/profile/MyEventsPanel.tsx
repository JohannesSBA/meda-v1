"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Card } from "@/app/components/ui/card";
import { Select } from "@/app/components/ui/select";
import { EmptyState } from "@/app/components/ui/empty-state";
import { EventListItemSkeleton } from "@/app/components/ui/skeleton";

type RegisteredEventItem = {
  eventId: string;
  eventName: string;
  eventDatetime: string;
  ticketCount: number;
  priceField?: number | null;
  addressLabel?: string | null;
};

export default function MyEventsPanel() {
  const [status, setStatus] = useState("upcoming");
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<RegisteredEventItem[]>([]);
  const [copiedEventId, setCopiedEventId] = useState<string | null>(null);

  const handleShareLink = async (eventId: string) => {
    try {
      const res = await fetch("/api/tickets/share/create", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ eventId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Unable to create share link");
      const shareUrl = String(data?.shareUrl ?? "");
      if (!shareUrl) throw new Error("Share link was not returned");
      await navigator.clipboard.writeText(shareUrl);
      setCopiedEventId(eventId);
      window.setTimeout(() => setCopiedEventId(null), 1500);
      toast.success("Share link copied");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Unable to create share link",
      );
    }
  };

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/profile/registered-events?status=${status}`, {
          cache: "no-store",
        });
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data?.error || "Failed to load events");
        }
        setItems(data.items ?? []);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Failed to load events");
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [status]);

  return (
    <section className="space-y-4 rounded-2xl bg-[#0c1d2e]/80 p-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="heading-kicker">Tickets</p>
          <h1 className="text-2xl font-semibold text-white">My events</h1>
        </div>
        <Select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="max-w-[140px] bg-[#0a1927]"
        >
          <option value="upcoming">Upcoming</option>
          <option value="past">Past</option>
          <option value="all">All</option>
        </Select>
      </div>
      {loading ? (
        <div className="grid gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <EventListItemSkeleton key={i} />
          ))}
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          title="No registered events"
          description="When you buy or claim tickets, your events appear here."
          action={{ label: "Browse events", href: "/events" }}
        />
      ) : (
        <div className="grid gap-3">
          {items.map((event) => (
            <Card key={event.eventId} className="rounded-xl bg-[#0a1927] p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="font-semibold text-white">{event.eventName}</h2>
                  <p className="text-xs text-[#9ec0df]">
                    {new Date(event.eventDatetime).toLocaleString()} •{" "}
                    {event.addressLabel ?? "Location pending"}
                  </p>
                  <p className="mt-1 text-xs text-[#9ec0df]">
                    Tickets: {event.ticketCount} • Price: ETB {event.priceField ?? 0}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Link
                    href={`/events/${event.eventId}`}
                    className="rounded-lg border border-white/15 px-3 py-1 text-sm text-[#d5e7fb] hover:border-[#22FF88]"
                  >
                    View
                  </Link>
                  {event.ticketCount > 1 ? (
                    <>
                      <button
                        type="button"
                        onClick={() => void handleShareLink(event.eventId)}
                        className="rounded-lg border border-white/15 px-3 py-1 text-sm text-[#d5e7fb] hover:border-[#22FF88]"
                      >
                        Share link
                      </button>
                      {copiedEventId === event.eventId ? (
                        <span className="self-center text-xs text-[#22FF88]">
                          Copied
                        </span>
                      ) : null}
                    </>
                  ) : null}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </section>
  );
}
