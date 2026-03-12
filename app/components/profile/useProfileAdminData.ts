import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useConfirmDialog } from "@/app/components/ui/confirm-dialog";
import { browserApi } from "@/lib/browserApi";
import { getErrorMessage } from "@/lib/errorMessage";
import type {
  AdminEventItem,
  AdminTab,
  AdminUserRow,
  CategoryItem,
} from "./types";
import { readUser } from "./types";

export function useProfileAdminData(isAdmin: boolean, adminTab: AdminTab) {
  const router = useRouter();
  const [adminUsers, setAdminUsers] = useState<AdminUserRow[]>([]);
  const [adminUsersLoading, setAdminUsersLoading] = useState(false);
  const [adminUsersError, setAdminUsersError] = useState<string | null>(null);
  const [userSearch, setUserSearch] = useState("");

  const [adminEvents, setAdminEvents] = useState<AdminEventItem[]>([]);
  const [adminEventsLoading, setAdminEventsLoading] = useState(false);
  const [adminEventsError, setAdminEventsError] = useState<string | null>(null);
  const [eventSearch, setEventSearch] = useState("");

  const [stats, setStats] = useState<Record<string, unknown> | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [statsError, setStatsError] = useState<string | null>(null);

  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [editingEvent, setEditingEvent] = useState<AdminEventItem | null>(null);
  const [applyToSeries, setApplyToSeries] = useState(false);
  const [seriesCount, setSeriesCount] = useState<number>(1);
  const [savingEvent, setSavingEvent] = useState(false);

  const deleteEventDialog = useConfirmDialog();
  const applyToSeriesDialog = useConfirmDialog();

  const adminUserNameById = useMemo(
    () => new Map(adminUsers.map((entry) => [entry.id, entry.name])),
    [adminUsers],
  );

  const loadAdminUsers = useCallback(async () => {
    if (!isAdmin) return;
    setAdminUsersLoading(true);
    setAdminUsersError(null);
    try {
      const query = userSearch ? `?search=${encodeURIComponent(userSearch)}` : "";
      const data = await browserApi.get<{ users?: unknown[] }>(
        `/api/admin/users${query}`,
        { cache: "no-store" },
      );
      setAdminUsers((data.users ?? []).map(readUser));
    } catch (error) {
      const message = getErrorMessage(error) || "Failed to load users";
      setAdminUsersError(message);
      toast.error(message);
    } finally {
      setAdminUsersLoading(false);
    }
  }, [isAdmin, userSearch]);

  const loadAdminEvents = useCallback(async () => {
    if (!isAdmin) return;
    setAdminEventsLoading(true);
    setAdminEventsError(null);
    try {
      const query = eventSearch ? `?search=${encodeURIComponent(eventSearch)}` : "";
      const data = await browserApi.get<{ items?: AdminEventItem[] }>(
        `/api/admin/events${query}`,
        { cache: "no-store" },
      );
      setAdminEvents(data.items ?? []);
    } catch (error) {
      const message = getErrorMessage(error) || "Failed to load events";
      setAdminEventsError(message);
      toast.error(message);
    } finally {
      setAdminEventsLoading(false);
    }
  }, [eventSearch, isAdmin]);

  const loadStats = useCallback(async () => {
    if (!isAdmin) return;
    setStatsLoading(true);
    setStatsError(null);
    try {
      const data = await browserApi.get<Record<string, unknown>>(
        "/api/admin/stats",
        { cache: "no-store" },
      );
      setStats(data);
    } catch (error) {
      const message = getErrorMessage(error) || "Failed to load statistics";
      setStatsError(message);
      toast.error(message);
    } finally {
      setStatsLoading(false);
    }
  }, [isAdmin]);

  const loadCategories = useCallback(async () => {
    if (!isAdmin) return;
    try {
      const data = await browserApi.get<{ categories?: CategoryItem[] }>(
        "/api/categories/get",
      );
      setCategories(data.categories ?? []);
    } catch (error) {
      toast.error(getErrorMessage(error) || "Failed to load categories");
    }
  }, [isAdmin]);

  const handleSetRole = useCallback(
    async (targetUserId: string, role: "admin" | "user") => {
      try {
        await browserApi.patch(`/api/admin/users/${targetUserId}/role`, { role });
        toast.success(`Role updated to ${role}`);
        await loadAdminUsers();
      } catch (error) {
        toast.error(getErrorMessage(error) || "Role update failed");
      }
    },
    [loadAdminUsers],
  );

  const handleBanToggle = useCallback(
    async (targetUserId: string, banned: boolean) => {
      try {
        await browserApi.patch(`/api/admin/users/${targetUserId}/ban`, {
          banned,
          banReason: banned ? "Moderation action from admin panel" : undefined,
        });
        toast.success(banned ? "User banned" : "User unbanned");
        await loadAdminUsers();
      } catch (error) {
        toast.error(getErrorMessage(error) || "Ban update failed");
      }
    },
    [loadAdminUsers],
  );

  const handleDeleteEvent = useCallback(
    async (eventId: string) => {
      const confirmed = await deleteEventDialog.confirm({
        title: "Delete event?",
        description:
          "This permanently removes the event and its related data. This action cannot be undone.",
        confirmLabel: "Delete event",
        tone: "danger",
      });
      if (!confirmed) return;

      try {
        await browserApi.delete(`/api/admin/events/${eventId}`);
        toast.success("Event deleted");
        await loadAdminEvents();
      } catch (error) {
        toast.error(getErrorMessage(error) || "Delete failed");
      }
    },
    [deleteEventDialog, loadAdminEvents],
  );

  const startEditEvent = useCallback(
    (eventId: string) => {
      router.push(`/admin/events/${eventId}/edit`);
    },
    [router],
  );

  const handleSaveEventChanges = useCallback(async () => {
    if (!editingEvent) return;
    if (applyToSeries && seriesCount > 1) {
      const confirmed = await applyToSeriesDialog.confirm({
        title: "Update recurring series?",
        description: `This will update ${seriesCount} occurrences in this recurring series. Continue only if every upcoming occurrence should change.`,
        confirmLabel: "Update series",
      });
      if (!confirmed) return;
    }

    setSavingEvent(true);
    try {
      const data = await browserApi.patch<{
        bulkUpdated?: boolean;
        updatedCount?: number;
      }>(`/api/admin/events/${editingEvent.eventId}`, {
        eventName: editingEvent.eventName,
        description: editingEvent.description ?? null,
        pictureUrl: editingEvent.pictureUrl ?? null,
        eventDatetime: editingEvent.eventDatetime,
        eventEndtime: editingEvent.eventEndtime,
        eventLocation: editingEvent.eventLocation ?? null,
        capacity: editingEvent.capacity ?? null,
        priceField: editingEvent.priceField ?? null,
        categoryId: editingEvent.categoryId,
        applyToSeries,
      });

      if (data?.bulkUpdated) {
        const count = Number(data.updatedCount) || seriesCount;
        toast.success(`Updated ${count} occurrences successfully`);
      } else {
        toast.success("Event updated");
      }

      setEditingEvent(null);
      setApplyToSeries(false);
      setSeriesCount(1);
      await loadAdminEvents();
    } catch (error) {
      toast.error(getErrorMessage(error) || "Failed to update event");
    } finally {
      setSavingEvent(false);
    }
  }, [
    editingEvent,
    applyToSeries,
    seriesCount,
    applyToSeriesDialog,
    loadAdminEvents,
  ]);

  useEffect(() => {
    if (!isAdmin) return;
    if (adminTab === "users") {
      void loadAdminUsers();
      return;
    }
    if (adminTab === "events") {
      void Promise.all([loadAdminEvents(), loadCategories(), loadAdminUsers()]);
      return;
    }
    if (adminTab === "stats") {
      void loadStats();
    }
  }, [
    adminTab,
    isAdmin,
    loadAdminEvents,
    loadAdminUsers,
    loadCategories,
    loadStats,
  ]);

  return {
    adminUsers,
    adminUsersLoading,
    adminUsersError,
    userSearch,
    setUserSearch,
    loadAdminUsers,
    adminEvents,
    adminEventsLoading,
    adminEventsError,
    eventSearch,
    setEventSearch,
    loadAdminEvents,
    stats,
    statsLoading,
    statsError,
    loadStats,
    categories,
    editingEvent,
    setEditingEvent,
    applyToSeries,
    setApplyToSeries,
    seriesCount,
    setSeriesCount,
    savingEvent,
    adminUserNameById,
    handleSetRole,
    handleBanToggle,
    handleDeleteEvent,
    startEditEvent,
    handleSaveEventChanges,
    deleteEventDialog: deleteEventDialog.dialog,
    applyToSeriesDialog: applyToSeriesDialog.dialog,
  };
}
