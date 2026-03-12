/**
 * MyEventsPanel -- lists events where the user currently holds tickets.
 */

"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Card } from "@/app/components/ui/card";
import { AsyncPanelState } from "@/app/components/ui/async-panel-state";
import { EventListItemSkeleton } from "@/app/components/ui/skeleton";
import { cn } from "@/app/components/ui/cn";
import { browserApi } from "@/lib/browserApi";
import { getErrorMessage } from "@/lib/errorMessage";
import type { RegisteredEventItem } from "./types";

const tabs = [
  { key: "upcoming", label: "Upcoming" },
  { key: "past", label: "Past" },
  { key: "all", label: "All" },
] as const;

export default function MyEventsPanel() {
  const [status, setStatus] = useState<string>("upcoming");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<RegisteredEventItem[]>([]);
  const [copiedEventId, setCopiedEventId] = useState<string | null>(null);

  const handleShareLink = useCallback(async (eventId: string) => {
    try {
      const data = await browserApi.post<{ shareUrl?: string }>(
        "/api/tickets/share/create",
        { eventId },
      );
      const shareUrl = String(data?.shareUrl ?? "");
      if (!shareUrl) throw new Error("Share link was not returned");
      await navigator.clipboard.writeText(shareUrl);
      setCopiedEventId(eventId);
      window.setTimeout(() => setCopiedEventId(null), 1500);
      toast.success("Share link copied");
    } catch (loadError) {
      toast.error(getErrorMessage(loadError) || "Unable to create share link");
    }
  }, []);

  const loadEvents = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await browserApi.get<{ items?: RegisteredEventItem[] }>(
        `/api/profile/registered-events?status=${status}`,
        { cache: "no-store" },
      );
      setItems(data.items ?? []);
    } catch (loadError) {
      const message = getErrorMessage(loadError) || "Failed to load events";
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => {
    void loadEvents();
  }, [loadEvents]);

  return (
    <section className="space-y-4">
      <div>
        <p className="heading-kicker">Tickets</p>
        <h1 className="text-2xl font-bold text-white">My tickets</h1>
      </div>

      <div
        role="tablist"
        aria-label="Ticket status"
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

      <div id="my-events-tabpanel" role="tabpanel" aria-label={`${status} tickets`}>
        <AsyncPanelState
          loading={loading}
          error={error}
          isEmpty={items.length === 0}
          loadingFallback={
            <div className="grid gap-3">
              {Array.from({ length: 4 }).map((_, index) => (
                <EventListItemSkeleton key={index} />
              ))}
            </div>
          }
          emptyTitle="No tickets yet"
          emptyDescription="When you buy or claim tickets, your events appear here."
          emptyAction={{ label: "Browse events", href: "/events" }}
          onRetry={loadEvents}
        >
          <div className="grid gap-3">
            {items.map((event) => (
              <Card
                key={event.eventId}
                className="rounded-xl border border-(--color-border) bg-[#0a1927] p-4"
              >
                <div className="flex gap-3">
                  <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-lg bg-[radial-gradient(circle_at_30%_30%,rgba(0,229,255,0.2),transparent_50%),linear-gradient(135deg,#0f2b3f,#0b1d2d)]">
                    <span className="text-2xl font-bold text-white/30">
                      {event.eventName.charAt(0)}
                    </span>
                  </div>

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
        </AsyncPanelState>
      </div>
    </section>
  );
}
