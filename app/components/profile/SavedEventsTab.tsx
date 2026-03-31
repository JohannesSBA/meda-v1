/**
 * SavedEventsTab -- List of events the user has saved for later.
 */

"use client";

import Link from "next/link";
import { AsyncPanelState } from "@/app/components/ui/async-panel-state";
import { Button, buttonVariants } from "@/app/components/ui/button";
import { Card } from "@/app/components/ui/card";
import { EventListItemSkeleton } from "@/app/components/ui/skeleton";
import { cn } from "@/app/components/ui/cn";
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
    <section id="profile-tabpanel-saved" role="tabpanel" aria-label="Saved events" className="space-y-5">
      <div className="space-y-2">
        <p className="heading-kicker">Saved</p>
        <h2 className="section-title">Events you want to come back to</h2>
      </div>

      <AsyncPanelState
        loading={savedLoading}
        error={savedError}
        isEmpty={savedEvents.length === 0}
        loadingFallback={
          <div className="grid gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <EventListItemSkeleton key={i} />
            ))}
          </div>
        }
        emptyTitle="You haven't saved any events yet"
        emptyDescription="Save events you're interested in so they stay easy to find."
        emptyAction={{ label: "Find a match", href: "/play?mode=events" }}
        onRetry={onRetry}
      >
        <div className="grid gap-4">
          {savedEvents.map((event) => (
            <Card key={event.eventId} className="p-5 sm:p-6">
              <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                <div className="flex gap-4">
                  <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-[22px] bg-[radial-gradient(circle_at_30%_30%,rgba(125,211,252,0.24),transparent_48%),linear-gradient(135deg,#102033,#0b1724)] text-2xl font-semibold text-white/40">
                    {event.eventName.charAt(0)}
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-xl font-semibold tracking-[-0.03em] text-[var(--color-text-primary)]">{event.eventName}</h3>
                    <p className="text-sm text-[var(--color-text-secondary)]">{new Date(event.eventDatetime).toLocaleString()}</p>
                    <p className="text-sm text-[var(--color-text-muted)]">{event.addressLabel ?? "Location pending"}</p>
                  </div>
                </div>

                <div className="grid gap-2 sm:grid-cols-2">
                  <Link href={`/events/${event.eventId}`} className={cn(buttonVariants("secondary", "sm"), "rounded-full")}>View event</Link>
                  <Button
                    type="button"
                    onClick={() => void onToggleSaved(event.eventId, true)}
                    variant="danger"
                    size="sm"
                    className="rounded-full"
                  >
                    Remove
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </AsyncPanelState>
    </section>
  );
}
