/**
 * useEventSearch -- Custom hook for events listing page.
 *
 * Manages URL params, events/categories/saved data fetching, filter handlers,
 * pagination, and save toggle. Debounces search; supports date presets.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { authClient } from "@/lib/auth/client";
import { browserApi } from "@/lib/browserApi";
import { getErrorMessage } from "@/lib/errorMessage";
import type { EventListResponse, EventResponse } from "@/app/types/eventTypes";

const PAGE_SIZE = 8;

type UseEventSearchOptions = {
  basePath?: string;
  fixedParams?: Record<string, string>;
};

export function useEventSearch(options: UseEventSearchOptions = {}) {
  const { basePath = "/events", fixedParams = {} } = options;
  const searchParams = useSearchParams();
  const router = useRouter();

  const [events, setEvents] = useState<EventResponse[]>([]);
  const [mapItems, setMapItems] = useState<EventResponse[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [radiusKm, setRadiusKm] = useState(100);
  const [savedEventIds, setSavedEventIds] = useState<Set<string>>(new Set());
  const [categories, setCategories] = useState<Array<{ categoryId: string; categoryName: string }>>(
    [],
  );

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
        const data = await browserApi.get<{
          categories?: Array<{ categoryId: string; categoryName: string }>;
        }>("/api/categories/get");
        if (cancelled) return;
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
        const data = await browserApi.get<{ items?: Array<{ eventId?: string }> }>(
          "/api/profile/saved-events",
          {
            cache: "no-store",
          },
        );
        const items = Array.isArray(data?.items) ? data.items : [];
        if (!cancelled) {
          setSavedEventIds(
            new Set(
              items
                .map((item: { eventId?: string }) => item.eventId)
                .filter((eventId): eventId is string => Boolean(eventId)),
            ),
          );
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
            const day = today.getDay();
            let from: Date;
            let to: Date;
            if (day === 0) {
              from = new Date(today);
              from.setDate(from.getDate() - 1);
              to = new Date(today);
            } else if (day === 6) {
              from = new Date(today);
              to = new Date(today);
              to.setDate(to.getDate() + 1);
            } else {
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
        }
        const data = await browserApi.get<EventListResponse>(
          `/api/events/list?${params.toString()}`,
          {
            signal: controller.signal,
          },
        );
        setEvents(data.items);
        setMapItems(data.mapItems ?? data.items);
        setTotal(data.total);
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") return;
        const message = getErrorMessage(err) || "Failed to load events";
        setError(message);
      } finally {
        setLoading(false);
      }
    }, 250);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [page, search, sort, order, categoryId, datePreset, nearLat, nearLng, radiusKm, retryCount]);

  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / PAGE_SIZE)), [total]);

  const updateParams = useCallback(
    (next: Record<string, string | number | undefined>) => {
      const params = new URLSearchParams(searchParams.toString());
      Object.entries(next).forEach(([key, value]) => {
        if (value === undefined || value === "") params.delete(key);
        else params.set(key, String(value));
      });

      Object.entries(fixedParams).forEach(([key, value]) => {
        if (value) params.set(key, value);
      });

      const query = params.toString();
      router.push(query ? `${basePath}?${query}` : basePath);
    },
    [basePath, fixedParams, router, searchParams],
  );

  const handleSearchChange = useCallback(
    (value: string) => {
      updateParams({ search: value, page: 1 });
    },
    [updateParams],
  );

  const handleSortChange = useCallback(
    (value: string) => {
      const [field, direction] = value.split(":");
      updateParams({ sort: field, order: direction as "asc" | "desc", page: 1 });
    },
    [updateParams],
  );

  const handleCategoryChange = useCallback(
    (value: string) => {
      updateParams({ categoryId: value, page: 1 });
    },
    [updateParams],
  );

  const handleDateRangeChange = useCallback(
    (value: string) => {
      updateParams({ datePreset: value === "all" ? "" : value, page: 1 });
    },
    [updateParams],
  );

  const handleSearchHere = useCallback(
    (center: { lat: number; lng: number }) => {
      updateParams({ nearLat: center.lat, nearLng: center.lng, page: 1 });
    },
    [updateParams],
  );

  const handleRadiusChange = useCallback(
    (radius: number) => {
      setRadiusKm(radius);
      updateParams({ radiusKm: radius, page: 1 });
    },
    [updateParams],
  );

  const handlePageChange = useCallback(
    (nextPage: number) => {
      updateParams({
        page: Math.min(Math.max(nextPage, 1), totalPages),
      });
    },
    [updateParams, totalPages],
  );

  const handleSaveToggle = useCallback(
    async (eventId: string, isSaved: boolean) => {
      const session = await authClient.getSession();
      const redirectParams = new URLSearchParams(searchParams.toString());
      Object.entries(fixedParams).forEach(([key, value]) => {
        if (value) redirectParams.set(key, value);
      });
      const redirectTarget = `${basePath}${redirectParams.toString() ? `?${redirectParams.toString()}` : ""}`;

      if (!session.data?.user?.id) {
        router.push(`/auth/sign-in?redirect=${encodeURIComponent(redirectTarget)}`);
        return;
      }
      try {
        await (isSaved
          ? browserApi.delete("/api/profile/saved-events", { eventId })
          : browserApi.post("/api/profile/saved-events", { eventId }));
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
        const message = getErrorMessage(err) || "Save action failed";
        if (message === "Unauthenticated") {
          router.push(`/auth/sign-in?redirect=${encodeURIComponent(redirectTarget)}`);
          return;
        }
        toast.error(message);
      }
    },
    [basePath, fixedParams, router, searchParams],
  );

  const retry = useCallback(() => {
    setError(null);
    setRetryCount((c) => c + 1);
  }, []);

  return {
    events,
    mapItems,
    total,
    loading,
    error,
    radiusKm,
    savedEventIds,
    categories,
    page,
    search,
    sort,
    order,
    categoryId,
    datePreset,
    totalPages,
    handleSearchChange,
    handleSortChange,
    handleCategoryChange,
    handleDateRangeChange,
    handleSearchHere,
    handleRadiusChange,
    handlePageChange,
    handleSaveToggle,
    retry,
  };
}
