/**
 * SavedEventsTab -- List of events the user has saved for later.
 */

"use client";

import Link from "next/link";
import { AsyncPanelState } from "@/app/components/ui/async-panel-state";
import { Button } from "@/app/components/ui/button";
import { Card } from "@/app/components/ui/card";
import { EventListItemSkeleton } from "@/app/components/ui/skeleton";
import type { SavedEventItem } from "./types";

type SavedEventsTabProps = {
  savedEvents: SavedEventItem[];
  savedLoading: boolean;
  savedError?: string | null;
  onToggleSaved: (eventId: string, isSaved: boolean) => void;
  onRetry?: () => void;
};

export function SavedEventsTab({
  savedEvents,
  savedLoading,
  savedError,
  onToggleSaved,
  onRetry,
}: SavedEventsTabProps) {
  return (
    <section
      id="profile-tabpanel-saved"
      role="tabpanel"
      aria-label="Saved events"
      className="space-y-4"
    >
      <h2 className="text-lg font-semibold text-white">Saved events</h2>
      <AsyncPanelState
        loading={savedLoading}
        error={savedError}
        isEmpty={savedEvents.length === 0}
        loadingFallback={
          <div className="grid gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <EventListItemSkeleton key={i} />
            ))}
          </div>
        }
        emptyTitle="You haven't saved any events yet"
        emptyDescription="Save events you're interested in to find them here."
        emptyAction={{ label: "Browse events", href: "/events" }}
        onRetry={onRetry}
      >
        <div className="grid gap-3">
          {savedEvents.map((event) => (
            <Card
              key={event.eventId}
              className="rounded-xl border border-white/10 bg-[#0a1927] p-4"
            >
              <div className="flex gap-3">
                <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-lg bg-[linear-gradient(135deg,#0f2b3f,#0b1d2d)]">
                  <span className="text-2xl font-bold text-white/30">
                    {event.eventName.charAt(0)}
                  </span>
                </div>
                <div className="flex flex-1 flex-col justify-center gap-0.5">
                  <h3 className="line-clamp-1 text-base font-semibold text-white">
                    {event.eventName}
                  </h3>
                  <p className="text-sm text-[var(--color-text-secondary)]">
                    {new Date(event.eventDatetime).toLocaleString()}
                  </p>
                  <p className="text-sm text-[var(--color-text-muted)]">
                    {event.addressLabel ?? "Location pending"}
                  </p>
                </div>
              </div>
              <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                <Link
                  href={`/events/${event.eventId}`}
                  className="flex h-11 flex-1 items-center justify-center rounded-lg border border-white/15 text-sm font-medium text-white"
                >
                  View
                </Link>
                <Button
                  type="button"
                  onClick={() => void onToggleSaved(event.eventId, true)}
                  variant="danger"
                  className="h-11 flex-1 rounded-lg"
                >
                  Remove
                </Button>
              </div>
            </Card>
          ))}
        </div>
      </AsyncPanelState>
    </section>
  );
}
