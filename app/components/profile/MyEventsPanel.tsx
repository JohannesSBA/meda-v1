"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Card } from "@/app/components/ui/card";
import { EmptyState } from "@/app/components/ui/empty-state";
import { EventListItemSkeleton } from "@/app/components/ui/skeleton";
import { cn } from "@/app/components/ui/cn";

type RegisteredEventItem = {
  eventId: string;
  eventName: string;
  eventDatetime: string;
  ticketCount: number;
  priceField?: number | null;
  addressLabel?: string | null;
};

const tabs = [
  { key: "upcoming", label: "Upcoming" },
  { key: "past", label: "Past" },
  { key: "all", label: "All" },
] as const;

export default function MyEventsPanel() {
  const [status, setStatus] = useState<string>("upcoming");
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
      toast.error(error instanceof Error ? error.message : "Unable to create share link");
    }
  };

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/profile/registered-events?status=${status}`, {
          cache: "no-store",
        });
        const data = await res.json();
        if (cancelled) return;
        if (!res.ok) {
          throw new Error(data?.error || "Failed to load events");
        }
        setItems(data.items ?? []);
      } catch (error) {
        if (!cancelled) {
          toast.error(error instanceof Error ? error.message : "Failed to load events");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [status]);

  return (
    <section className="space-y-4">
      <div>
        <p className="heading-kicker">Tickets</p>
        <h1 className="text-2xl font-bold text-white">My events</h1>
      </div>

      {/* Tab bar */}
      <div
        role="tablist"
        aria-label="Event status"
        className="flex rounded-xl border border-(--color-border) bg-[#0c1d2e]/75 p-1"
      >
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            role="tab"
            aria-selected={status === tab.key}
            aria-controls="my-events-tabpanel"
            onClick={() => setStatus(tab.key)}
            className={cn(
              "flex-1 rounded-lg py-3 text-sm font-semibold transition",
              status === tab.key
                ? "bg-(--color-brand) text-(--color-brand-text)"
                : "text-(--color-text-secondary) active:bg-white/5",
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div id="my-events-tabpanel" role="tabpanel" aria-label={`${status} events`}>
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
              <Card
                key={event.eventId}
                className="rounded-xl border border-(--color-border) bg-[#0a1927] p-4"
              >
                <div className="flex gap-3">
                  {/* Thumbnail placeholder */}
                  <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-lg bg-[radial-gradient(circle_at_30%_30%,rgba(0,229,255,0.2),transparent_50%),linear-gradient(135deg,#0f2b3f,#0b1d2d)]">
                    <span className="text-2xl font-bold text-white/30">
                      {event.eventName.charAt(0)}
                    </span>
                  </div>

                  {/* Details */}
                  <div className="flex flex-1 flex-col justify-center gap-0.5">
                    <h2 className="line-clamp-1 text-base font-semibold text-white">
                      {event.eventName}
                    </h2>
                    <p className="text-sm text-(--color-text-secondary)">
                      {new Date(event.eventDatetime).toLocaleString()}
                    </p>
                    <p className="text-sm text-(--color-text-muted)">
                      {event.addressLabel ?? "Location pending"}
                    </p>
                    <div className="mt-1 flex items-center gap-2">
                      <span className="rounded-full bg-(--color-brand)/15 px-2.5 py-0.5 text-xs font-semibold text-(--color-brand)">
                        {event.ticketCount} ticket{event.ticketCount === 1 ? "" : "s"}
                      </span>
                      <span className="text-sm font-medium text-white">
                        ETB {event.priceField ?? 0}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Action buttons - full width on mobile */}
                <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                  <Link
                    href={`/events/${event.eventId}`}
                    className="flex h-11 flex-1 items-center justify-center rounded-lg border border-(--color-border-strong) text-sm font-medium text-white transition active:scale-[0.98]"
                  >
                    View event
                  </Link>
                  {event.ticketCount > 1 ? (
                    <button
                      type="button"
                      onClick={() => void handleShareLink(event.eventId)}
                      className="flex h-11 flex-1 items-center justify-center rounded-lg border border-(--color-border-strong) text-sm font-medium text-white transition active:scale-[0.98]"
                    >
                      {copiedEventId === event.eventId ? "Copied!" : "Share ticket"}
                    </button>
                  ) : null}
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
