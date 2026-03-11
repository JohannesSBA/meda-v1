/**
 * useProfileData -- Custom hook for profile dashboard state and data fetching.
 *
 * Manages registered/saved events, admin users/events/stats, balance, and all action handlers.
 */

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type {
  ProfileUser,
  RegisteredEventItem,
  SavedEventItem,
  AdminEventItem,
  CategoryItem,
  AdminUserRow,
  UserTab,
  AdminTab,
} from "./types";
import { readUser } from "./types";

export function useProfileData(user: ProfileUser) {
  const router = useRouter();
  const isAdmin = user.role === "admin";

  const [registeredStatus, setRegisteredStatus] = useState("upcoming");
  const [registeredEvents, setRegisteredEvents] = useState<RegisteredEventItem[]>([]);
  const [registeredLoading, setRegisteredLoading] = useState(false);

  const [savedEvents, setSavedEvents] = useState<SavedEventItem[]>([]);
  const [savedLoading, setSavedLoading] = useState(false);

  const [adminUsers, setAdminUsers] = useState<AdminUserRow[]>([]);
  const [adminUsersLoading, setAdminUsersLoading] = useState(false);
  const [userSearch, setUserSearch] = useState("");

  const [adminEvents, setAdminEvents] = useState<AdminEventItem[]>([]);
  const [adminEventsLoading, setAdminEventsLoading] = useState(false);
  const [eventSearch, setEventSearch] = useState("");

  const [stats, setStats] = useState<Record<string, unknown> | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);

  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [editingEvent, setEditingEvent] = useState<AdminEventItem | null>(null);
  const [applyToSeries, setApplyToSeries] = useState(false);
  const [seriesCount, setSeriesCount] = useState<number>(1);
  const [savingEvent, setSavingEvent] = useState(false);
  const [copiedEventId, setCopiedEventId] = useState<string | null>(null);
  const [balance, setBalance] = useState<number>(0);
  const [refundingEventId, setRefundingEventId] = useState<string | null>(null);

  const [userTab, setUserTab] = useState<UserTab>("registered");
  const [adminTab, setAdminTab] = useState<AdminTab>("events");

  const savedIds = useMemo(
    () => new Set(savedEvents.map((event) => event.eventId)),
    [savedEvents],
  );
  const adminUserNameById = useMemo(
    () => new Map(adminUsers.map((entry) => [entry.id, entry.name])),
    [adminUsers],
  );

  const loadRegisteredEvents = async () => {
    setRegisteredLoading(true);
    try {
      const res = await fetch(`/api/profile/registered-events?status=${registeredStatus}`, { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to load registered events");
      setRegisteredEvents(data.items ?? []);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load registered events");
    } finally {
      setRegisteredLoading(false);
    }
  };

  const loadSavedEvents = async () => {
    setSavedLoading(true);
    try {
      const res = await fetch("/api/profile/saved-events", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to load saved events");
      setSavedEvents(data.items ?? []);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load saved events");
    } finally {
      setSavedLoading(false);
    }
  };

  const loadAdminUsers = async () => {
    if (!isAdmin) return;
    setAdminUsersLoading(true);
    try {
      const q = userSearch ? `?search=${encodeURIComponent(userSearch)}` : "";
      const res = await fetch(`/api/admin/users${q}`, { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to load users");
      setAdminUsers((data.users ?? []).map(readUser));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load users");
    } finally {
      setAdminUsersLoading(false);
    }
  };

  const loadAdminEvents = async () => {
    if (!isAdmin) return;
    setAdminEventsLoading(true);
    try {
      const q = eventSearch ? `?search=${encodeURIComponent(eventSearch)}` : "";
      const res = await fetch(`/api/admin/events${q}`, { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to load events");
      setAdminEvents(data.items ?? []);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load admin events");
    } finally {
      setAdminEventsLoading(false);
    }
  };

  const loadStats = async () => {
    if (!isAdmin) return;
    setStatsLoading(true);
    try {
      const res = await fetch("/api/admin/stats", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to load stats");
      setStats(data);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load statistics");
    } finally {
      setStatsLoading(false);
    }
  };

  const loadCategories = async () => {
    if (!isAdmin) return;
    try {
      const res = await fetch("/api/categories/get", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to load categories");
      setCategories(data.categories ?? []);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load categories");
    }
  };

  const loadBalance = async () => {
    try {
      const res = await fetch("/api/profile/balance", { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      setBalance(Number(data.balanceEtb) || 0);
    } catch {
      // silently ignore
    }
  };

  const handleRefundFromProfile = async (eventId: string) => {
    setRefundingEventId(eventId);
    try {
      const res = await fetch(`/api/events/${eventId}/refund`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Refund failed");
      const amount = Number(data.amountEtb) || 0;
      const count = Number(data.ticketCount) || 0;
      toast.success(
        amount > 0
          ? `Refund processed. ETB ${amount} credited to your balance.`
          : `${count} ticket${count === 1 ? "" : "s"} cancelled.`,
      );
      void loadRegisteredEvents();
      void loadBalance();
      setTimeout(() => router.refresh(), 5000);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Refund failed");
    } finally {
      setRefundingEventId(null);
    }
  };

  useEffect(() => {
    if (isAdmin) return;
    let cancelled = false;
    loadBalance().finally(() => { if (cancelled) { /* no-op */ } });
    return () => { cancelled = true; };
  }, [isAdmin]);

  useEffect(() => {
    if (!isAdmin) {
      if (userTab === "registered") void loadRegisteredEvents();
      if (userTab === "saved") void loadSavedEvents();
      return;
    }
    if (adminTab === "users") void loadAdminUsers();
    if (adminTab === "events") {
      void loadAdminEvents();
      void loadCategories();
      void loadAdminUsers();
    }
    if (adminTab === "stats") void loadStats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin, userTab, adminTab, registeredStatus]);

  const toggleSavedEvent = async (eventId: string, isSaved: boolean) => {
    try {
      const res = await fetch("/api/profile/saved-events", {
        method: isSaved ? "DELETE" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ eventId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Save action failed");
      toast.success(isSaved ? "Event removed from saved list" : "Event saved", { id: `save-${eventId}` });
      await loadSavedEvents();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Save action failed");
    }
  };

  const handleShareLink = async (eventId: string) => {
    try {
      const res = await fetch("/api/tickets/share/create", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ eventId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Unable to create share link");
      const shareUrl = String(data?.shareUrl ?? "");
      if (!shareUrl) throw new Error("Share link was not returned");
      await navigator.clipboard.writeText(shareUrl);
      setCopiedEventId(eventId);
      window.setTimeout(() => setCopiedEventId(null), 1500);
      toast.success("Share link copied");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to create share link");
    }
  };

  const handleSetRole = async (targetUserId: string, role: "admin" | "user") => {
    try {
      const res = await fetch(`/api/admin/users/${targetUserId}/role`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ role }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Role update failed");
      toast.success(`Role updated to ${role}`);
      void loadAdminUsers();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Role update failed");
    }
  };

  const handleBanToggle = async (targetUserId: string, banned: boolean) => {
    try {
      const res = await fetch(`/api/admin/users/${targetUserId}/ban`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ banned, banReason: banned ? "Moderation action from admin panel" : undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Ban update failed");
      toast.success(banned ? "User banned" : "User unbanned");
      void loadAdminUsers();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Ban update failed");
    }
  };

  const handleDeleteEvent = async (eventId: string) => {
    if (!confirm("Delete this event permanently?")) return;
    try {
      const res = await fetch(`/api/admin/events/${eventId}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Delete failed");
      toast.success("Event deleted");
      void loadAdminEvents();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Delete failed");
    }
  };

  const startEditEvent = (eventId: string) => {
    router.push(`/admin/events/${eventId}/edit`);
  };

  const handleSaveEventChanges = async () => {
    if (!editingEvent) return;
    if (applyToSeries && seriesCount > 1) {
      const confirmed = window.confirm(
        `This will update ${seriesCount} occurrences in this recurring series. Continue?`,
      );
      if (!confirmed) return;
    }
    setSavingEvent(true);
    try {
      const res = await fetch(`/api/admin/events/${editingEvent.eventId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
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
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to update event");
      if (data?.bulkUpdated) {
        const count = Number(data?.updatedCount) || seriesCount;
        toast.success(`Updated ${count} occurrences successfully`);
      } else {
        toast.success("Event updated");
      }
      setEditingEvent(null);
      setApplyToSeries(false);
      setSeriesCount(1);
      await loadAdminEvents();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update event");
    } finally {
      setSavingEvent(false);
    }
  };

  return {
    isAdmin,
    userTab,
    setUserTab,
    adminTab,
    setAdminTab,
    registeredStatus,
    setRegisteredStatus,
    registeredEvents,
    registeredLoading,
    loadRegisteredEvents,
    savedEvents,
    savedLoading,
    loadSavedEvents,
    adminUsers,
    adminUsersLoading,
    userSearch,
    setUserSearch,
    loadAdminUsers,
    adminEvents,
    adminEventsLoading,
    eventSearch,
    setEventSearch,
    loadAdminEvents,
    stats,
    statsLoading,
    categories,
    loadCategories,
    editingEvent,
    setEditingEvent,
    applyToSeries,
    setApplyToSeries,
    seriesCount,
    setSeriesCount,
    savingEvent,
    copiedEventId,
    balance,
    refundingEventId,
    savedIds,
    adminUserNameById,
    toggleSavedEvent,
    handleShareLink,
    handleRefundFromProfile,
    handleSetRole,
    handleBanToggle,
    handleDeleteEvent,
    startEditEvent,
    handleSaveEventChanges,
  };
}
