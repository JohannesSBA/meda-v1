"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { EventCard } from "../components/EventCard";
import type { EventListResponse, EventResponse } from "../types/eventTypes";
import { useSearchParams, useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { toast } from "sonner";
import { authClient } from "@/lib/auth/client";
import { PageShell } from "../components/ui/page-shell";
import { Card } from "../components/ui/card";
import { EmptyState } from "../components/ui/empty-state";
import { ErrorState } from "../components/ui/error-state";
import { EventCardSkeleton } from "../components/ui/skeleton";
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
  const [retryCount, setRetryCount] = useState(0);
  const [radiusKm, setRadiusKm] = useState(50);
  const [savedEventIds, setSavedEventIds] = useState<Set<string>>(new Set());
  const [categories, setCategories] = useState<Array<{ categoryId: string; categoryName: string }>>([]);

  const page = Number(searchParams.get("page")) || 1;
  const search = searchParams.get("search") || "";
  const sort = searchParams.get("sort") || "date";
  const order = searchParams.get("order") || "asc";
  const categoryId = searchParams.get("categoryId") || "";
  const datePreset = searchParams.get("datePreset") || "all";
  const nearLat = searchParams.get("nearLat");
  const nearLng = searchParams.get("nearLng");
  const radiusParam = searchParams.get("radiusKm");

  useEffect(() => {
    if (radiusParam) setRadiusKm(Number(radiusParam));
  }, [radiusParam]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch("/api/categories/get", { cache: "no-store" });
        if (!res.ok || cancelled) return;
        const data = await res.json();
        setCategories(data.categories ?? []);
      } catch {
        if (!cancelled) setCategories([]);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

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
        if (categoryId) params.set("categoryId", categoryId);
        if (datePreset && datePreset !== "all") {
          const now = new Date();
          const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          if (datePreset === "week") {
            const end = new Date(today);
            end.setDate(end.getDate() + 7);
            params.set("from", today.toISOString().slice(0, 10));
            params.set("to", end.toISOString().slice(0, 10));
          } else if (datePreset === "weekend") {
            const day = today.getDay(); // 0=Sun, 6=Sat
            let from: Date;
            let to: Date;
            if (day === 0) {
              // Sunday: this weekend = yesterday (Sat) to today
              from = new Date(today);
              from.setDate(from.getDate() - 1);
              to = new Date(today);
            } else if (day === 6) {
              // Saturday: today to tomorrow
              from = new Date(today);
              to = new Date(today);
              to.setDate(to.getDate() + 1);
            } else {
              // Mon–Fri: upcoming Saturday–Sunday
              const saturday = new Date(today);
              saturday.setDate(today.getDate() + (6 - day));
              const sunday = new Date(saturday);
              sunday.setDate(saturday.getDate() + 1);
              from = saturday;
              to = sunday;
            }
            params.set("from", from.toISOString().slice(0, 10));
            params.set("to", to.toISOString().slice(0, 10));
          } else if (datePreset === "month") {
            const end = new Date(today);
            end.setMonth(end.getMonth() + 1);
            params.set("from", today.toISOString().slice(0, 10));
            params.set("to", end.toISOString().slice(0, 10));
          }
        }
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
  }, [page, search, sort, order, categoryId, datePreset, nearLat, nearLng, radiusKm, retryCount]);

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

  const handleCategoryChange = (value: string) => {
    updateParams({ categoryId: value, page: 1 });
  };

  const handleDateRangeChange = (value: string) => {
    updateParams({ datePreset: value === "all" ? "" : value, page: 1 });
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

  const handleSaveToggle = useCallback(
    async (eventId: string, isSaved: boolean) => {
      const session = await authClient.getSession();
      if (!session.data?.user?.id) {
        router.push(`/auth/sign-in?redirect=${encodeURIComponent("/events" + (searchParams.toString() ? `?${searchParams.toString()}` : ""))}`);
        return;
      }
      try {
        const res = await fetch("/api/profile/saved-events", {
          method: isSaved ? "DELETE" : "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ eventId }),
        });
        const data = await res.json();
        if (!res.ok) {
          if (res.status === 401) {
            router.push(`/auth/sign-in?redirect=${encodeURIComponent("/events" + (searchParams.toString() ? `?${searchParams.toString()}` : ""))}`);
            return;
          }
          throw new Error(data?.error || "Save action failed");
        }
        setSavedEventIds((prev) => {
          const next = new Set(prev);
          if (isSaved) next.delete(eventId);
          else next.add(eventId);
          return next;
        });
        toast.success(isSaved ? "Event removed from saved list" : "Event saved", {
          id: `save-${eventId}`,
        });
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Save action failed");
      }
    },
    [router, searchParams],
  );

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
                value={datePreset || "all"}
                onChange={(e) => handleDateRangeChange(e.target.value)}
                className="min-w-[140px] bg-[#0a1927]"
              >
                <option value="all">Any date</option>
                <option value="week">This week</option>
                <option value="weekend">This weekend</option>
                <option value="month">This month</option>
              </Select>
              <Select
                value={categoryId || "all"}
                onChange={(e) => handleCategoryChange(e.target.value === "all" ? "" : e.target.value)}
                className="min-w-[160px] bg-[#0a1927]"
              >
                <option value="all">All categories</option>
                {categories.map((c) => (
                  <option key={c.categoryId} value={c.categoryId}>
                    {c.categoryName}
                  </option>
                ))}
              </Select>
              <Select
                value={`${sort}:${order}`}
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
          <div className="grid gap-6 md:grid-cols-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <EventCardSkeleton key={i} />
            ))}
          </div>
        ) : error ? (
          <ErrorState
            message={error}
            onRetry={() => {
              setError(null);
              setRetryCount((c) => c + 1);
            }}
          />
        ) : events.length === 0 ? (
          <EmptyState
            title="No events found"
            description="Try adjusting your search or radius."
            action={{ label: "Clear filters", href: "/events" }}
          />
        ) : (
          <>
            <div className="grid gap-6 md:grid-cols-2">
              {events.map((event) => (
                <EventCard
                  key={event.eventId}
                  event={event}
                  href={`/events/${event.eventId}`}
                  isSaved={savedEventIds.has(event.eventId)}
                  onSaveToggle={handleSaveToggle}
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
