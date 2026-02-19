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
    <main className="relative min-h-screen bg-[#08111c] text-white">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_15%_20%,rgba(0,229,255,0.08),transparent_35%),radial-gradient(circle_at_80%_0%,rgba(34,255,136,0.08),transparent_32%),linear-gradient(140deg,#0b1725_10%,#0c1b2f_40%,#0a1321_100%)]" />
      <div className="relative mx-auto flex max-w-6xl flex-col gap-8 px-6 py-10">
        <header className="flex flex-col gap-6 rounded-3xl  bg-linear-to-br from-[#0f2235]/80 via-[#0c1c2d]/70 to-[#0a1523]/80 p-6 shadow-2xl shadow-[#00e5ff12] backdrop-blur-lg">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.25em] text-[#5cc5ff]">Discover • Play • Connect</p>
              <h1 className="text-4xl font-bold leading-tight text-white md:text-5xl">Find your next event</h1>
              <p className="mt-2 text-sm text-[#a7c5de]">Search, sort, and explore experiences happening around you.</p>
            </div>
            <div className="flex gap-3">
              <div className="rounded-2xl   bg-[#0c1d2e]/80 px-4 py-3 text-left shadow-inner shadow-[#00e5ff12]">
                <p className="text-xs uppercase tracking-[0.14em] text-[#6ac9ff]">Live events</p>
                <p className="text-2xl font-bold text-white">{total}</p>
              </div>
              <div className="rounded-2xl   bg-[#0c1d2e]/80 px-4 py-3 text-left shadow-inner shadow-[#22ff8812]">
                <p className="text-xs uppercase tracking-[0.14em] text-[#7bffb8]">Radius</p>
                <p className="text-2xl font-bold text-white">{radiusKm} km</p>
              </div>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-[2fr_1fr] md:items-center">
            <div className="flex items-center gap-3 rounded-2xl   bg-[#0c1d2e]/80 px-4 py-3 shadow-inner shadow-black/20">
              <input
                type="search"
                placeholder="Search events by name, vibe, or location..."
                defaultValue={search}
                onChange={(e) => handleSearchChange(e.target.value)}
                className="h-11 w-full rounded-xl border border-[#16324a] bg-[#0a1927] px-4 text-sm text-white placeholder:text-[#6c8eb1] focus:outline-none focus:ring-2 focus:ring-[#00E5FF]"
              />
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <select
                defaultValue={`${sort}:${order}`}
                onChange={(e) => handleSortChange(e.target.value)}
                className="h-11 min-w-[180px] rounded-xl   bg-[#0a1927] px-4 text-sm text-white shadow-inner shadow-black/30 focus:outline-none focus:ring-2 focus:ring-[#22FF88]"
              >
                <option value="date:asc">Soonest first</option>
                <option value="date:desc">Latest first</option>
                <option value="price:asc">Lowest price</option>
                <option value="price:desc">Highest price</option>
              </select>
            </div>
          </div>
        </header>

        <section className="rounded-3xl   bg-[#0b1624]/90 shadow-xl shadow-[#00e5ff12]">
          <EventsMap
            events={events}
            radiusKm={radiusKm}
            onRadiusChange={handleRadiusChange}
            onSearchHere={handleSearchHere}
          />
        </section>

        {loading ? (
          <div className="flex items-center justify-center rounded-2xl   bg-[#0c1d2e]/70 px-6 py-10 text-[#d6faff] shadow-inner shadow-black/20">
            Loading events…
          </div>
        ) : error ? (
          <div className="rounded-2xl border border-red-500/30 bg-red-900/20 px-6 py-4 text-red-200">
            {error}
          </div>
        ) : events.length === 0 ? (
          <div className="rounded-2xl   bg-[#0c1d2e]/70 px-6 py-10 text-center text-lg text-[#d6faff] shadow-inner shadow-black/20">
            No events found. Try adjusting your search or radius.
          </div>
        ) : (
          <>
            <div className="grid gap-6 md:grid-cols-2">
              {events.map((event) => (
                <EventCard key={event.eventId} event={event} href={`/events/${event.eventId}`} />
              ))}
            </div>

            <div className="flex flex-col gap-3 rounded-2xl   bg-[#0c1d2e]/80 px-4 py-3 text-sm text-[#c0d5ec] shadow-inner shadow-black/15 md:flex-row md:items-center md:justify-between">
              <div>
                Page {page} of {totalPages} · Showing {events.length} of {total} events
              </div>
              <div className="flex items-center gap-2">
                <button
                  className="rounded-full border border-white/10 px-4 py-2 text-white transition hover:border-[#22FF88] hover:text-[#22FF88] disabled:opacity-40"
                  onClick={() => handlePageChange(page - 1)}
                  disabled={page <= 1}
                >
                  Prev
                </button>
                <button
                  className="rounded-full border border-white/10 px-4 py-2 text-white transition hover:border-[#22FF88] hover:text-[#22FF88] disabled:opacity-40"
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
