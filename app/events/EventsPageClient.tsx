/**
 * EventsPage -- Browse and search events with filters, map, and pagination.
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
import { Cluster, Section, Stack } from "../components/ui/primitives";
import { useEventSearch } from "./useEventSearch";
import { EventFilterBar } from "./EventFilterBar";

const EventsMap = dynamic(() => import("../components/EventsMap"), {
  ssr: false,
});

export default function EventsPage() {
  const data = useEventSearch();

  return (
    <PageShell>
      <Stack gap="xl" className="mx-auto max-w-7xl pb-6">
        <Section size="md" className="pb-0">
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
        </Section>

        <Section size="sm" className="pt-0">
          <Card className="overflow-hidden rounded-[var(--radius-xl)] p-2 sm:p-3">
            <EventsMap
              events={data.mapItems}
              radiusKm={data.radiusKm}
              onRadiusChange={data.handleRadiusChange}
              onSearchHere={data.handleSearchHere}
            />
          </Card>
        </Section>

        <Section size="sm" className="pt-0">
          <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div className="space-y-2">
              <p className="heading-kicker">Results</p>
              <h2 className="section-title">{data.loading ? "Loading events" : `${data.total} events in view`}</h2>
              <p className="text-sm text-[var(--color-text-secondary)]">Browse the current results, then open the match that fits your time, price, and location.</p>
            </div>
            <Cluster gap="sm" className="text-sm text-[var(--color-text-muted)]">
              <span className="rounded-full border border-[var(--color-border-strong)] bg-white/[0.05] px-3 py-1.5">Page {data.page}</span>
              <span className="rounded-full border border-[var(--color-border-strong)] bg-white/[0.05] px-3 py-1.5">{data.totalPages} total pages</span>
            </Cluster>
          </div>

          {data.loading ? (
            <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <EventCardSkeleton key={i} />
              ))}
            </div>
          ) : data.error ? (
            <ErrorState message={data.error} onRetry={data.retry} />
          ) : data.events.length === 0 ? (
            <EmptyState
              title="No events match these filters"
              description="Try widening the radius, clearing one of the filters, or searching a different city."
              action={{ label: "Clear filters", href: "/events" }}
            />
          ) : (
            <Stack gap="xl">
              <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
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

              <Card className="flex flex-col gap-4 rounded-[var(--radius-xl)] p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="text-sm leading-6 text-[var(--color-text-secondary)]">
                  Page {data.page} of {data.totalPages} · Showing {data.events.length} of {data.total} events
                </div>
                <Cluster gap="sm">
                  <Button
                    variant="secondary"
                    size="sm"
                    className="rounded-full"
                    onClick={() => data.handlePageChange(data.page - 1)}
                    disabled={data.page <= 1}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    className="rounded-full"
                    onClick={() => data.handlePageChange(data.page + 1)}
                    disabled={data.page >= data.totalPages}
                  >
                    Next page
                  </Button>
                </Cluster>
              </Card>
            </Stack>
          )}
        </Section>
      </Stack>
    </PageShell>
  );
}
