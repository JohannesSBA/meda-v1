/**
 * RegisteredEventsTab -- List of events the user has registered for.
 *
 * Shows status filter (upcoming/past/all), view/share/save/refund actions.
 */

"use client";

import Link from "next/link";
import { Button } from "@/app/components/ui/button";
import { Card } from "@/app/components/ui/card";
import { Select } from "@/app/components/ui/select";
import { EmptyState } from "@/app/components/ui/empty-state";
import { EventListItemSkeleton } from "@/app/components/ui/skeleton";
import type { RegisteredEventItem } from "./types";

type RegisteredEventsTabProps = {
  registeredStatus: string;
  setRegisteredStatus: (v: string) => void;
  registeredEvents: RegisteredEventItem[];
  registeredLoading: boolean;
  savedIds: Set<string>;
  copiedEventId: string | null;
  refundingEventId: string | null;
  onShareLink: (eventId: string) => void;
  onToggleSaved: (eventId: string, isSaved: boolean) => void;
  onRefund: (eventId: string) => void;
};

export function RegisteredEventsTab({
  registeredStatus,
  setRegisteredStatus,
  registeredEvents,
  registeredLoading,
  savedIds,
  copiedEventId,
  refundingEventId,
  onShareLink,
  onToggleSaved,
  onRefund,
}: RegisteredEventsTabProps) {
  return (
    <section
      id="profile-tabpanel-registered"
      role="tabpanel"
      aria-label="Registered events"
      className="space-y-4"
    >
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-white">Registered events</h2>
        <Select
          value={registeredStatus}
          onChange={(e) => setRegisteredStatus(e.target.value)}
          className="max-w-[140px] bg-[#0a1927]"
        >
          <option value="upcoming">Upcoming</option>
          <option value="past">Past</option>
          <option value="all">All</option>
        </Select>
      </div>
      {registeredLoading ? (
        <div className="grid gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <EventListItemSkeleton key={i} />
          ))}
        </div>
      ) : registeredEvents.length === 0 ? (
        <EmptyState
          title="No registered events"
          description="Browse events and register for your first match."
          action={{ label: "Browse events", href: "/events" }}
        />
      ) : (
        <div className="grid gap-3">
          {registeredEvents.map((event) => {
            const hoursUntil =
              (new Date(event.eventDatetime).getTime() - Date.now()) /
              (1000 * 60 * 60);
            const canRefund =
              registeredStatus !== "past" && hoursUntil >= 24;

            return (
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
                    <div className="mt-1 flex items-center gap-2">
                      <span className="rounded-full bg-[var(--color-brand)]/15 px-2 py-0.5 text-xs font-semibold text-[var(--color-brand)]">
                        {event.ticketCount} ticket
                        {event.ticketCount === 1 ? "" : "s"}
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
                    className="flex h-11 flex-1 items-center justify-center rounded-lg border border-white/15 text-sm font-medium text-white"
                  >
                    View
                  </Link>
                  {event.ticketCount > 1 ? (
                    <button
                      type="button"
                      onClick={() => void onShareLink(event.eventId)}
                      className="flex h-11 flex-1 items-center justify-center rounded-lg border border-white/15 text-sm font-medium text-white"
                    >
                      {copiedEventId === event.eventId ? "Copied!" : "Share ticket"}
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={() =>
                      void onToggleSaved(event.eventId, savedIds.has(event.eventId))
                    }
                    className="flex h-11 flex-1 items-center justify-center rounded-lg border border-white/15 text-sm font-medium text-white"
                  >
                    {savedIds.has(event.eventId) ? "Unsave" : "Save"}
                  </button>
                  {canRefund ? (
                    <Button
                      type="button"
                      variant="danger"
                      className="h-11 flex-1 rounded-lg"
                      disabled={refundingEventId === event.eventId}
                      onClick={() => {
                        if (
                          !confirm(
                            (event.priceField ?? 0) > 0
                              ? `Cancel all tickets and refund ETB ${(event.priceField ?? 0) * event.ticketCount} to your Meda balance?`
                              : `Cancel all ${event.ticketCount} ticket${event.ticketCount === 1 ? "" : "s"}?`,
                          )
                        )
                          return;
                        void onRefund(event.eventId);
                      }}
                    >
                      {refundingEventId === event.eventId
                        ? "Processing…"
                        : (event.priceField ?? 0) > 0
                          ? "Refund"
                          : "Cancel"}
                    </Button>
                  ) : null}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </section>
  );
}
