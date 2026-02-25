"use client";

import { useEffect, useMemo, useState } from "react";
import { EventCard } from "../components/EventCard";
import type { EventListResponse, EventResponse } from "../types/eventTypes";
import { useSearchParams, useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { authClient } from "@/lib/auth/client";
import { PageShell } from "../components/ui/page-shell";
import { Card } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Select } from "../components/ui/select";
import { Button } from "../components/ui/button";

const EventsMap = dynamic(() => import("../components/EventsMap"), {
  ssr: false,
});

const PAGE_SIZE = 8;
const DEFAULT_CENTER = { lat: 9.0301, lng: 38.7578 };

export default function EventsPage() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [events, setEvents] = useState<EventResponse[]>([]);
  const [mapItems, setMapItems] = useState<EventResponse[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [radiusKm, setRadiusKm] = useState(50);
  const [savedEventIds, setSavedEventIds] = useState<Set<string>>(new Set());

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
    let cancelled = false;
    const loadSaved = async () => {
      try {
        const session = await authClient.getSession();
        if (!session.data?.user?.id) {
          if (!cancelled) setSavedEventIds(new Set());
          return;
        }
        const res = await fetch("/api/profile/saved-events", { cache: "no-store" });
        if (!res.ok) {
          if (!cancelled) setSavedEventIds(new Set());
          return;
        }
        const data = await res.json();
        const items = Array.isArray(data?.items) ? data.items : [];
        if (!cancelled) {
          setSavedEventIds(new Set(items.map((item: { eventId?: string }) => item.eventId).filter(Boolean)));
        }
      } catch {
        if (!cancelled) setSavedEventIds(new Set());
      }
    };
    void loadSaved();
    return () => {
      cancelled = true;
    };
  }, []);

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
        } else {
          params.set("nearLat", String(DEFAULT_CENTER.lat));
          params.set("nearLng", String(DEFAULT_CENTER.lng));
        }
        const res = await fetch(`/api/events/list?${params.toString()}`, {
          signal: controller.signal,
        });
        if (!res.ok) throw new Error("Failed to fetch events");
        const data: EventListResponse = await res.json();
        setEvents(data.items);
        setMapItems(data.mapItems ?? data.items);
        setTotal(data.total);
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") return;
        const message =
          err instanceof Error ? err.message : "Failed to load events";
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

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(total / PAGE_SIZE)),
    [total],
  );

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
    <PageShell>
      <div className="relative mx-auto flex max-w-6xl flex-col gap-8">
        <Card className="flex flex-col gap-6 rounded-3xl bg-gradient-to-br from-[#0f2235]/80 via-[#0c1c2d]/70 to-[#0a1523]/80 p-6 backdrop-blur-lg">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="heading-kicker">
                Discover • Play • Connect
              </p>
              <h1 className="text-4xl font-bold leading-tight text-white md:text-5xl">
                Find your next event
              </h1>
              <p className="muted-copy mt-2 text-sm">
                Search, sort, and explore experiences happening around you.
              </p>
            </div>
            <div className="flex gap-3">
              <div className="rounded-2xl bg-[var(--color-surface-2)] px-4 py-3 text-left shadow-inner shadow-black/20">
                <p className="text-xs uppercase tracking-[0.14em] text-[var(--color-brand)]">
                  Live events
                </p>
                <p className="text-2xl font-bold text-white">{total}</p>
              </div>
              <div className="rounded-2xl bg-[var(--color-surface-2)] px-4 py-3 text-left shadow-inner shadow-black/20">
                <p className="text-xs uppercase tracking-[0.14em] text-[var(--color-brand-alt)]">
                  Radius
                </p>
                <p className="text-2xl font-bold text-white">{radiusKm} km</p>
              </div>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-[2fr_1fr] md:items-center">
            <div className="rounded-2xl bg-[var(--color-surface-2)] px-4 py-3 shadow-inner shadow-black/20">
              <Input
                type="search"
                placeholder="Search events by name, vibe, or location..."
                defaultValue={search}
                onChange={(e) => handleSearchChange(e.target.value)}
                className="bg-[#0a1927]"
              />
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Select
                defaultValue={`${sort}:${order}`}
                onChange={(e) => handleSortChange(e.target.value)}
                className="min-w-[180px] bg-[#0a1927]"
              >
                <option value="date:asc">Soonest first</option>
                <option value="date:desc">Latest first</option>
                <option value="price:asc">Lowest price</option>
                <option value="price:desc">Highest price</option>
              </Select>
            </div>
          </div>
        </Card>

        <Card className="rounded-3xl bg-[#0b1624]/90">
          <EventsMap
            events={mapItems}
            radiusKm={radiusKm}
            onRadiusChange={handleRadiusChange}
            onSearchHere={handleSearchHere}
          />
        </Card>

        {loading ? (
          <Card className="flex items-center justify-center rounded-2xl bg-[var(--color-surface)] px-6 py-10 text-[var(--color-text-secondary)] shadow-inner shadow-black/20">
            Loading events…
          </Card>
        ) : error ? (
          <Card className="rounded-2xl border-red-500/40 bg-red-900/30 px-6 py-4 text-red-200">
            {error}
          </Card>
        ) : events.length === 0 ? (
          <Card className="rounded-2xl bg-[var(--color-surface)] px-6 py-10 text-center text-lg text-[var(--color-text-secondary)] shadow-inner shadow-black/20">
            No events found. Try adjusting your search or radius.
          </Card>
        ) : (
          <>
            <div className="grid gap-6 md:grid-cols-2">
              {events.map((event) => (
                <EventCard
                  key={event.eventId}
                  event={event}
                  href={`/events/${event.eventId}`}
                  isSaved={savedEventIds.has(event.eventId)}
                />
              ))}
            </div>

            <Card className="flex flex-col gap-3 rounded-2xl bg-[var(--color-surface)] px-4 py-3 text-sm text-[var(--color-text-secondary)] shadow-inner shadow-black/15 md:flex-row md:items-center md:justify-between">
              <div>
                Page {page} of {totalPages} · Showing {events.length} of {total}{" "}
                events
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  className="rounded-full"
                  onClick={() => handlePageChange(page - 1)}
                  disabled={page <= 1}
                >
                  Prev
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  className="rounded-full"
                  onClick={() => handlePageChange(page + 1)}
                  disabled={page >= totalPages}
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
