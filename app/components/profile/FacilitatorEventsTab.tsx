"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { AsyncPanelState } from "@/app/components/ui/async-panel-state";
import { buttonVariants } from "@/app/components/ui/button";
import { Card } from "@/app/components/ui/card";
import { cn } from "@/app/components/ui/cn";
import { browserApi } from "@/lib/browserApi";
import { getErrorMessage } from "@/lib/errorMessage";
import type { AdminEventItem } from "./types";

type FacilitatorEventItem = AdminEventItem & {
  attendeeCount?: number | null;
};

export function FacilitatorEventsTab() {
  const [items, setItems] = useState<FacilitatorEventItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadEvents = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await browserApi.get<{ items?: FacilitatorEventItem[] }>(
        "/api/facilitator/events",
        { cache: "no-store" },
      );
      setItems(data.items ?? []);
    } catch (loadError) {
      setError(getErrorMessage(loadError) || "Failed to load facilitator events");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadEvents();
  }, [loadEvents]);

  return (
    <section className="space-y-4 rounded-2xl border border-white/10 bg-[#0c1d2e]/80 p-4 sm:p-5">
      <div className="space-y-1">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--color-brand)]">
          Facilitator
        </p>
        <h2 className="text-lg font-semibold text-white">Assigned events</h2>
        <p className="text-sm text-[var(--color-text-secondary)]">
          Events you can scan for your pitch owner.
        </p>
      </div>

      <AsyncPanelState
        loading={loading}
        error={error}
        isEmpty={items.length === 0}
        loadingFallback={<Card className="p-5 text-sm text-[var(--color-text-secondary)]">Loading events...</Card>}
        emptyTitle="No assigned events"
        emptyDescription="You will see pitch-owner events here when they are assigned to your facilitator account."
        onRetry={loadEvents}
      >
        <div className="grid gap-3">
          {items.map((event) => (
            <Card key={event.eventId} className="p-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-1">
                  <p className="font-semibold text-[var(--color-text-primary)]">
                    {event.eventName}
                  </p>
                  <p className="text-sm text-[var(--color-text-secondary)]">
                    {new Date(event.eventDatetime).toLocaleString()}
                  </p>
                </div>
                <Link
                  href={`/events/${event.eventId}/scan`}
                  className={cn(buttonVariants("primary", "sm"), "rounded-full")}
                >
                  Scan tickets
                </Link>
              </div>
            </Card>
          ))}
        </div>
      </AsyncPanelState>
    </section>
  );
}
