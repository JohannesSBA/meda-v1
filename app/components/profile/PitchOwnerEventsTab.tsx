"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { AsyncPanelState } from "@/app/components/ui/async-panel-state";
import { Button, buttonVariants } from "@/app/components/ui/button";
import { Card } from "@/app/components/ui/card";
import { cn } from "@/app/components/ui/cn";
import { EventListItemSkeleton } from "@/app/components/ui/skeleton";
import { browserApi } from "@/lib/browserApi";
import { getErrorMessage } from "@/lib/errorMessage";
import type { AdminEventItem } from "./types";

type PitchOwnerEventItem = AdminEventItem & {
  attendeeCount?: number | null;
};

const statusTabs = [
  { key: "upcoming", label: "Upcoming" },
  { key: "past", label: "Past" },
  { key: "all", label: "All" },
] as const;

export function PitchOwnerEventsTab() {
  const [status, setStatus] =
    useState<(typeof statusTabs)[number]["key"]>("upcoming");
  const [items, setItems] = useState<PitchOwnerEventItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadEvents = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await browserApi.get<{ items?: PitchOwnerEventItem[] }>(
        `/api/profile/events?status=${status}`,
        { cache: "no-store" },
      );
      setItems(data.items ?? []);
    } catch (loadError) {
      setError(getErrorMessage(loadError) || "Failed to load your events");
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => {
    void loadEvents();
  }, [loadEvents]);

  return (
    <section className="space-y-4 rounded-2xl border border-white/10 bg-[#0c1d2e]/80 p-4 sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--color-brand)]">
            Pitch owner
          </p>
          <h2 className="text-lg font-semibold text-white">Your events</h2>
          <p className="text-sm text-[var(--color-text-secondary)]">
            Events you host on Meda.
          </p>
        </div>
        <Link
          href="/create-events"
          className={cn(buttonVariants("primary", "sm"), "rounded-full")}
        >
          Create event
        </Link>
      </div>

      <Card className="p-2">
        <div role="tablist" aria-label="Pitch owner event status" className="grid grid-cols-3 gap-2">
          {statusTabs.map((tab) => (
            <Button
              key={tab.key}
              type="button"
              role="tab"
              aria-selected={status === tab.key}
              onClick={() => setStatus(tab.key)}
              variant={status === tab.key ? "primary" : "secondary"}
              size="sm"
              className="justify-center rounded-[var(--radius-md)]"
            >
              {tab.label}
            </Button>
          ))}
        </div>
      </Card>

      <AsyncPanelState
        loading={loading}
        error={error}
        isEmpty={items.length === 0}
        loadingFallback={
          <div className="grid gap-4">
            {Array.from({ length: 3 }).map((_, index) => (
              <EventListItemSkeleton key={index} />
            ))}
          </div>
        }
        emptyTitle="No events yet"
        emptyDescription="Once you create events, they will appear here."
        emptyAction={{ label: "Create event", href: "/create-events" }}
        onRetry={loadEvents}
      >
        <div className="grid gap-4">
          {items.map((event) => (
            <Card key={event.eventId} className="p-5 sm:p-6">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="space-y-2">
                  <h3 className="text-xl font-semibold tracking-[-0.03em] text-[var(--color-text-primary)]">
                    {event.eventName}
                  </h3>
                  <p className="text-sm text-[var(--color-text-secondary)]">
                    {new Date(event.eventDatetime).toLocaleString()}
                  </p>
                  <p className="text-sm text-[var(--color-text-muted)]">
                    {event.addressLabel ?? "Location pending"}
                  </p>
                  <div className="flex flex-wrap gap-2 text-xs font-semibold">
                    <span className="rounded-full bg-[rgba(125,211,252,0.12)] px-3 py-1 text-[var(--color-brand)]">
                      ETB {event.priceField ?? 0}
                    </span>
                    <span className="rounded-full bg-[rgba(52,211,153,0.12)] px-3 py-1 text-[var(--color-brand-alt)]">
                      {Number(event.attendeeCount ?? 0)} attendees
                    </span>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Link
                    href={`/events/${event.eventId}`}
                    className={cn(buttonVariants("secondary", "sm"), "rounded-full")}
                  >
                    View event
                  </Link>
                  <Link
                    href={`/events/${event.eventId}/scan`}
                    className={cn(buttonVariants("secondary", "sm"), "rounded-full")}
                  >
                    Scan tickets
                  </Link>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </AsyncPanelState>
    </section>
  );
}
