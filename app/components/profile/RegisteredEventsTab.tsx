/**
 * RegisteredEventsTab -- List of events the user has registered for.
 */

"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Button, buttonVariants } from "@/app/components/ui/button";
import { Card } from "@/app/components/ui/card";
import { AsyncPanelState } from "@/app/components/ui/async-panel-state";
import { useConfirmDialog } from "@/app/components/ui/confirm-dialog";
import { Select } from "@/app/components/ui/select";
import { EventListItemSkeleton } from "@/app/components/ui/skeleton";
import { Cluster } from "@/app/components/ui/primitives";
import { cn } from "@/app/components/ui/cn";
import type { RegisteredEventItem } from "./types";

type RegisteredEventsTabProps = {
  registeredStatus: string;
  setRegisteredStatus: (v: string) => void;
  registeredEvents: RegisteredEventItem[];
  registeredLoading: boolean;
  registeredError?: string | null;
  savedIds: Set<string>;
  copiedEventId: string | null;
  refundingEventId: string | null;
  onShareLink: (eventId: string) => void;
  onToggleSaved: (eventId: string, isSaved: boolean) => void;
  onRefund: (eventId: string) => void;
  onRetry?: () => void;
};

export function RegisteredEventsTab({
  registeredStatus,
  setRegisteredStatus,
  registeredEvents,
  registeredLoading,
  registeredError,
  savedIds,
  copiedEventId,
  refundingEventId,
  onShareLink,
  onToggleSaved,
  onRefund,
  onRetry,
}: RegisteredEventsTabProps) {
  const [nowTimestamp] = useState(() => Date.now());
  const refundDialog = useConfirmDialog();

  return (
    <section id="profile-tabpanel-registered" role="tabpanel" aria-label="Registered events" className="space-y-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-2">
          <p className="heading-kicker">Ticket inventory</p>
          <h2 className="section-title">Your upcoming and past registrations</h2>
        </div>
        <label className="block min-w-[160px]">
          <span className="field-label">View</span>
          <Select value={registeredStatus} onChange={(e) => setRegisteredStatus(e.target.value)}>
            <option value="upcoming">Upcoming</option>
            <option value="past">Past</option>
            <option value="all">All</option>
          </Select>
        </label>
      </div>

      <AsyncPanelState
        loading={registeredLoading}
        error={registeredError}
        isEmpty={registeredEvents.length === 0}
        loadingFallback={
          <div className="grid gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <EventListItemSkeleton key={i} />
            ))}
          </div>
        }
        emptyTitle="No tickets yet"
        emptyDescription="Browse events and register for your first match."
        emptyAction={{ label: "Browse events", href: "/events" }}
        onRetry={onRetry}
      >
        <div className="grid gap-4">
          {registeredEvents.map((event) => {
            const hoursUntil = (new Date(event.eventDatetime).getTime() - nowTimestamp) / (1000 * 60 * 60);
            const canRefund = registeredStatus !== "past" && hoursUntil >= 24;

            return (
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
                      <h3 className="text-xl font-semibold tracking-[-0.03em] text-[var(--color-text-primary)]">{event.eventName}</h3>
                      <p className="text-sm text-[var(--color-text-secondary)]">{new Date(event.eventDatetime).toLocaleString()}</p>
                      <p className="text-sm text-[var(--color-text-muted)]">{event.addressLabel ?? "Location pending"}</p>
                      <Cluster gap="sm">
                        <span className="rounded-full bg-[rgba(125,211,252,0.12)] px-3 py-1 text-xs font-semibold text-[var(--color-brand)]">
                          {event.ticketCount} ticket{event.ticketCount === 1 ? "" : "s"}
                        </span>
                        <span className="rounded-full bg-[rgba(52,211,153,0.12)] px-3 py-1 text-xs font-semibold text-[var(--color-brand-alt)]">
                          ETB {event.priceField ?? 0}
                        </span>
                      </Cluster>
                    </div>
                  </div>

                  <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                    <Link href={`/events/${event.eventId}`} className={cn(buttonVariants("secondary", "sm"), "rounded-full")}>View event</Link>
                    {event.ticketCount > 1 ? (
                      <button
                        type="button"
                        onClick={() => void onShareLink(event.eventId)}
                        className={cn(buttonVariants("secondary", "sm"), "rounded-full")}
                      >
                        {copiedEventId === event.eventId ? "Copied" : "Share ticket"}
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => void onToggleSaved(event.eventId, savedIds.has(event.eventId))}
                      className={cn(buttonVariants("secondary", "sm"), "rounded-full")}
                    >
                      {savedIds.has(event.eventId) ? "Unsave" : "Save"}
                    </button>
                    {canRefund ? (
                      <Button
                        type="button"
                        variant="danger"
                        size="sm"
                        className="rounded-full"
                        disabled={refundingEventId === event.eventId}
                        onClick={async () => {
                          const confirmed = await refundDialog.confirm({
                            title: (event.priceField ?? 0) > 0 ? "Refund tickets?" : "Cancel tickets?",
                            description:
                              (event.priceField ?? 0) > 0
                                ? `Cancel all tickets and refund ETB ${(event.priceField ?? 0) * event.ticketCount} to your Meda balance?`
                                : `Cancel all ${event.ticketCount} ticket${event.ticketCount === 1 ? "" : "s"} for this event?`,
                            confirmLabel: (event.priceField ?? 0) > 0 ? "Refund tickets" : "Cancel tickets",
                            tone: "danger",
                          });
                          if (!confirmed) return;
                          void onRefund(event.eventId);
                        }}
                      >
                        {refundingEventId === event.eventId ? "Processing..." : (event.priceField ?? 0) > 0 ? "Refund" : "Cancel"}
                      </Button>
                    ) : null}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      </AsyncPanelState>
      {refundDialog.dialog}
    </section>
  );
}
