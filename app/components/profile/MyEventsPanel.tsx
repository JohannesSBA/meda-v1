/**
 * MyEventsPanel -- lists events where the user currently holds tickets.
 */

"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { toast } from "sonner";
import { Card } from "@/app/components/ui/card";
import { AsyncPanelState } from "@/app/components/ui/async-panel-state";
import { EventListItemSkeleton } from "@/app/components/ui/skeleton";
import { buttonVariants } from "@/app/components/ui/button";
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
      const data = await browserApi.post<{ shareUrl?: string }>("/api/tickets/share/create", { eventId });
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
      const data = await browserApi.get<{ items?: RegisteredEventItem[] }>(`/api/profile/registered-events?status=${status}`, {
        cache: "no-store",
      });
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
    <section className="space-y-6">
      <div className="space-y-2">
        <p className="heading-kicker">Tickets</p>
        <h1 className="text-[var(--text-h1)] font-semibold tracking-[-0.05em] text-[var(--color-text-primary)]">My tickets</h1>
        <p className="text-sm leading-7 text-[var(--color-text-secondary)] sm:text-base">
          A cleaner overview of the events where you currently hold access.
        </p>
      </div>

      <Card className="p-2">
        <div role="tablist" aria-label="Ticket status" className="grid grid-cols-3 gap-2">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              role="tab"
              aria-selected={status === tab.key}
              aria-controls="my-events-tabpanel"
              onClick={() => setStatus(tab.key)}
              className={cn(
                "rounded-[var(--radius-md)] px-4 py-3 text-sm font-semibold transition",
                status === tab.key
                  ? "bg-[rgba(125,211,252,0.12)] text-[var(--color-text-primary)]"
                  : "text-[var(--color-text-secondary)] hover:bg-white/[0.04] hover:text-[var(--color-text-primary)]",
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </Card>

      <div id="my-events-tabpanel" role="tabpanel" aria-label={`${status} tickets`}>
        <AsyncPanelState
          loading={loading}
          error={error}
          isEmpty={items.length === 0}
          loadingFallback={
            <div className="grid gap-4">
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
          <div className="grid gap-4">
            {items.map((event) => (
              <Card key={event.eventId} className="p-5 sm:p-6">
                <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                  <div className="flex gap-4">
                    <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-[22px]">
                      {event.pictureUrl ? (
                        <Image src={event.pictureUrl} alt="" fill className="object-cover" sizes="80px" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center bg-[radial-gradient(circle_at_30%_30%,rgba(125,211,252,0.24),transparent_48%),linear-gradient(135deg,#102033,#0b1724)] text-2xl font-semibold text-white/40">
                          {event.eventName.charAt(0)}
                        </div>
                      )}
                    </div>
                    <div className="space-y-2">
                      <h2 className="text-xl font-semibold tracking-[-0.03em] text-[var(--color-text-primary)]">{event.eventName}</h2>
                      <p className="text-sm text-[var(--color-text-secondary)]">{new Date(event.eventDatetime).toLocaleString()}</p>
                      <p className="text-sm text-[var(--color-text-muted)]">{event.addressLabel ?? "Location pending"}</p>
                      <div className="flex items-center gap-2">
                        <span className="rounded-full bg-[rgba(125,211,252,0.12)] px-3 py-1 text-xs font-semibold text-[var(--color-brand)]">
                          {event.ticketCount} ticket{event.ticketCount === 1 ? "" : "s"}
                        </span>
                        <span className="rounded-full bg-[rgba(52,211,153,0.12)] px-3 py-1 text-xs font-semibold text-[var(--color-brand-alt)]">
                          ETB {event.priceField ?? 0}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-2 sm:grid-cols-2">
                    <Link href={`/events/${event.eventId}`} className={cn(buttonVariants("secondary", "sm"), "rounded-full")}>View event</Link>
                    {event.ticketCount > 1 ? (
                      <button
                        type="button"
                        onClick={() => void handleShareLink(event.eventId)}
                        className={cn(buttonVariants("secondary", "sm"), "rounded-full")}
                      >
                        {copiedEventId === event.eventId ? "Copied" : "Share ticket"}
                      </button>
                    ) : null}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </AsyncPanelState>
      </div>
    </section>
  );
}
