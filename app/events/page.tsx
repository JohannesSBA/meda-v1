"use client";

import { useEffect, useMemo, useState } from "react";
import { EventCard } from "../components/EventCard";
import type { EventListResponse, EventResponse } from "../types/eventTypes";
import { useSearchParams, useRouter } from "next/navigation";
import dynamic from "next/dynamic";

const EventsMap = dynamic(() => import("../components/EventsMap"), { ssr: false });

const PAGE_SIZE = 8;

export default function EventsPage() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [events, setEvents] = useState<EventResponse[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [radiusKm, setRadiusKm] = useState(50);

  const page = Number(searchParams.get("page")) || 1;
  const search = searchParams.get("search") || "";
  const sort = searchParams.get("sort") || "date";
  const order = searchParams.get("order") || "asc";
  const nearLat = searchParams.get("nearLat");
  const nearLng = searchParams.get("nearLng");
  const radiusParam = searchParams.get("radiusKm");

  useEffect(() => {
    if (radiusParam) setRadiusKm(Number(radiusParam));
  }, [radiusParam]);

  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({
          page: String(page),
          limit: String(PAGE_SIZE),
          search,
          sort,
          order,
          radiusKm: String(radiusKm),
        });
        if (nearLat && nearLng) {
          params.set("nearLat", nearLat);
          params.set("nearLng", nearLng);
        }
        const res = await fetch(`/api/events/list?${params.toString()}`, {
          signal: controller.signal,
        });
        if (!res.ok) throw new Error("Failed to fetch events");
        const data: EventListResponse = await res.json();
        setEvents(data.items);
        setTotal(data.total);
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") return;
        const message = err instanceof Error ? err.message : "Failed to load events";
        setError(message);
      } finally {
        setLoading(false);
      }
    }, 250); // debounce search

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [page, search, sort, order, nearLat, nearLng, radiusKm]);

  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / PAGE_SIZE)), [total]);

  const updateParams = (next: Record<string, string | number | undefined>) => {
    const params = new URLSearchParams(searchParams.toString());
    Object.entries(next).forEach(([key, value]) => {
      if (value === undefined || value === "") params.delete(key);
      else params.set(key, String(value));
    });
    router.push(`/events?${params.toString()}`);
  };

  const handleSearchChange = (value: string) => {
    updateParams({ search: value, page: 1 });
  };

  const handleSortChange = (value: string) => {
    const [field, direction] = value.split(":");
    updateParams({ sort: field, order: direction as "asc" | "desc", page: 1 });
  };

  const handleSearchHere = (center: { lat: number; lng: number }) => {
    updateParams({ nearLat: center.lat, nearLng: center.lng, page: 1 });
  };

  const handleRadiusChange = (radius: number) => {
    setRadiusKm(radius);
    updateParams({ radiusKm: radius, page: 1 });
  };

  const handlePageChange = (nextPage: number) => {
    updateParams({ page: Math.min(Math.max(nextPage, 1), totalPages) });
  };

  return (
    <main className="mx-auto flex min-h-screen min-w-screen flex-col gap-6 px-6 py-8 bg-[#0f1f2d]">
      <div className="w-full flex flex-col gap-6 px-6 py-8 mx-auto">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Find an Event</h1>
          <p className="text-sm text-[#9fb6ce]">Search, sort, and explore near you.</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
          <input
            type="search"
            placeholder="Search events"
            defaultValue={search}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="w-full rounded-lg border border-[#1f3850] bg-[#0f1f2d] px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#00E5FF] sm:w-64"
          />
          <select
            defaultValue={`${sort}:${order}`}
            onChange={(e) => handleSortChange(e.target.value)}
            className="rounded-lg border border-[#1f3850] bg-[#0f1f2d] px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#00E5FF]"
          >
            <option value="date:asc">Date ↑ (soonest)</option>
            <option value="date:desc">Date ↓ (latest)</option>
            <option value="price:asc">Price ↑ (lowest)</option>
            <option value="price:desc">Price ↓ (highest)</option>
          </select>
        </div>
      </div>

      <section className="overflow-hidden rounded-2xl border border-[#1f3850] bg-[#0b1624]">
        <EventsMap
          events={events}
          radiusKm={radiusKm}
          onRadiusChange={handleRadiusChange}
          onSearchHere={handleSearchHere}
        />
      </section>

      {loading ? (
        <div className="text-[#d6faff]">Loading events…</div>
      ) : error ? (
        <div className="text-red-300">{error}</div>
      ) : events.length === 0 ? (
        <div className="text-[#d6faff] text-lg">No events found.</div>
      ) : (
        <>
          <div className="grid gap-6 md:grid-cols-2">
            {events.map((event) => (
              <EventCard key={event.eventId} event={event} href={`/events/${event.eventId}`} />
            ))}
          </div>

          <div className="flex items-center justify-between rounded-xl border border-[#1f3850] bg-[#0f1f2d] px-4 py-3 text-sm text-[#c0d5ec]">
            <div>
              Page {page} of {totalPages} · Showing {events.length} of {total} events
            </div>
            <div className="flex items-center gap-2">
              <button
                className="rounded-md border border-[#1f3850] px-3 py-1 text-white disabled:opacity-40"
                onClick={() => handlePageChange(page - 1)}
                disabled={page <= 1}
              >
                Prev
              </button>
              <button
                className="rounded-md border border-[#1f3850] px-3 py-1 text-white disabled:opacity-40"
                onClick={() => handlePageChange(page + 1)}
                disabled={page >= totalPages}
              >
                Next
              </button>
            </div>
          </div>
        </>
      )}
      </div>
    </main>
  );
}
