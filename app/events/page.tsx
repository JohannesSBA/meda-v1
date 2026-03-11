/**
 * EventsPage -- Browse and search events with filters, map, and pagination.
 *
 * Client-rendered page. Uses useEventSearch for data and EventFilterBar for controls.
 */

"use client";

import dynamic from "next/dynamic";
import { EventCard } from "../components/EventCard";
import { PageShell } from "../components/ui/page-shell";
import { Card } from "../components/ui/card";
import { EmptyState } from "../components/ui/empty-state";
import { ErrorState } from "../components/ui/error-state";
import { EventCardSkeleton } from "../components/ui/skeleton";
import { Button } from "../components/ui/button";
import { useEventSearch } from "./useEventSearch";
import { EventFilterBar } from "./EventFilterBar";

const EventsMap = dynamic(() => import("../components/EventsMap"), {
  ssr: false,
});

export default function EventsPage() {
  const data = useEventSearch();

  return (
    <PageShell>
      <div className="relative mx-auto flex max-w-6xl flex-col gap-8">
        <EventFilterBar
            search={data.search}
            datePreset={data.datePreset}
            categoryId={data.categoryId}
            sortOrder={`${data.sort}:${data.order}`}
            total={data.total}
            radiusKm={data.radiusKm}
            categories={data.categories}
            onSearchChange={data.handleSearchChange}
            onDateRangeChange={data.handleDateRangeChange}
            onCategoryChange={data.handleCategoryChange}
            onSortChange={data.handleSortChange}
          />

        <Card className="rounded-3xl bg-[#0b1624]/90">
          <EventsMap
            events={data.mapItems}
            radiusKm={data.radiusKm}
            onRadiusChange={data.handleRadiusChange}
            onSearchHere={data.handleSearchHere}
          />
        </Card>

        {data.loading ? (
          <div className="grid gap-6 md:grid-cols-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <EventCardSkeleton key={i} />
            ))}
          </div>
        ) : data.error ? (
          <ErrorState message={data.error} onRetry={data.retry} />
        ) : data.events.length === 0 ? (
          <EmptyState
            title="No events found"
            description="Try adjusting your search or radius."
            action={{ label: "Clear filters", href: "/events" }}
          />
        ) : (
          <>
            <div className="grid gap-6 md:grid-cols-2">
              {data.events.map((event) => (
                <EventCard
                  key={event.eventId}
                  event={event}
                  href={`/events/${event.eventId}`}
                  isSaved={data.savedEventIds.has(event.eventId)}
                  onSaveToggle={data.handleSaveToggle}
                />
              ))}
            </div>

            <Card className="flex flex-col gap-3 rounded-2xl bg-[var(--color-surface)] px-4 py-3 text-sm text-[var(--color-text-secondary)] shadow-inner shadow-black/15 md:flex-row md:items-center md:justify-between">
              <div>
                Page {data.page} of {data.totalPages} · Showing{" "}
                {data.events.length} of {data.total} events
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  className="rounded-full"
                  onClick={() => data.handlePageChange(data.page - 1)}
                  disabled={data.page <= 1}
                >
                  Prev
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  className="rounded-full"
                  onClick={() => data.handlePageChange(data.page + 1)}
                  disabled={data.page >= data.totalPages}
                >
                  Next
                </Button>
              </div>
            </Card>
          </>
        )}
      </div>
    </PageShell>
  );
}
