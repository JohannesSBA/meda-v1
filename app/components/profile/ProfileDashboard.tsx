"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button, buttonVariants } from "@/app/components/ui/button";
import { Card } from "@/app/components/ui/card";
import { Input } from "@/app/components/ui/input";
import { Select } from "@/app/components/ui/select";
import { Table } from "@/app/components/ui/table";
import { Badge } from "@/app/components/ui/badge";
import { EmptyState } from "@/app/components/ui/empty-state";
import {
  EventListItemSkeleton,
  TableSkeleton,
  StatsCardsSkeleton,
} from "@/app/components/ui/skeleton";
import { cn } from "@/app/components/ui/cn";

type ProfileUser = {
  id: string;
  name: string;
  email: string;
  role: string;
  image?: string | null;
};

type RegisteredEventItem = {
  eventId: string;
  eventName: string;
  eventDatetime: string;
  ticketCount: number;
  priceField?: number | null;
  addressLabel?: string | null;
};

type SavedEventItem = {
  eventId: string;
  eventName: string;
  eventDatetime: string;
  addressLabel?: string | null;
};

type AdminEventItem = {
  eventId: string;
  eventName: string;
  eventDatetime: string;
  eventEndtime: string;
  userId: string;
  isRecurring?: boolean;
  seriesId?: string | null;
  priceField?: number | null;
  capacity?: number | null;
  categoryId?: string;
  eventLocation?: string | null;
  pictureUrl?: string | null;
  description?: string | null;
};

type CategoryItem = { categoryId: string; categoryName: string };

type UserTab = "registered" | "saved";
type AdminTab = "users" | "events" | "stats";

function readUser(user: unknown) {
  const row = user as Record<string, unknown>;
  return {
    id: String(row.id ?? row.userId ?? ""),
    name: String(row.name ?? row.displayName ?? "Unknown"),
    email: String(row.email ?? ""),
    role: String(row.role ?? "user"),
    banned: Boolean(row.banned ?? row.isBanned ?? false),
  };
}

export default function ProfileDashboard({ user }: { user: ProfileUser }) {
  const router = useRouter();
  const isAdmin = user.role === "admin";
  const avatarUrl =
    user.image ||
    `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name || user.email || "User")}&background=0F2235&color=22FF88&size=160`;

  const [userTab, setUserTab] = useState<UserTab>("registered");
  const [adminTab, setAdminTab] = useState<AdminTab>("events");

  const [registeredStatus, setRegisteredStatus] = useState("upcoming");
  const [registeredEvents, setRegisteredEvents] = useState<RegisteredEventItem[]>([]);
  const [registeredLoading, setRegisteredLoading] = useState(false);

  const [savedEvents, setSavedEvents] = useState<SavedEventItem[]>([]);
  const [savedLoading, setSavedLoading] = useState(false);

  const [adminUsers, setAdminUsers] = useState<Array<ReturnType<typeof readUser>>>([]);
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

  const startEditEvent = async (eventId: string) => {
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

  return (
    <section className="space-y-6">
      {/* Profile header card - mobile-centered layout */}
      <Card className="rounded-2xl bg-gradient-to-br from-[#0f2235]/80 via-[#0c1c2d]/70 to-[#0a1523]/80 p-6 sm:rounded-3xl">
        <div className="flex flex-col items-center gap-4 text-center sm:flex-row sm:text-left">
          <Image
            src={avatarUrl}
            alt={`${user.name} profile`}
            width={96}
            height={96}
            className="h-24 w-24 rounded-full border-2 border-white/15 object-cover"
          />
          <div className="flex-1">
            <p className="text-sm uppercase tracking-widest text-[var(--color-brand)]">
              {isAdmin ? "Admin profile" : "My profile"}
            </p>
            <h1 className="mt-1 text-2xl font-bold text-white sm:text-3xl">
              {user.name}
            </h1>
            <p className="mt-0.5 text-sm text-[var(--color-text-secondary)]">{user.email}</p>
          </div>
          {isAdmin ? (
            <Badge className="rounded-full border border-white/15 bg-white/5 px-4 py-2 text-sm font-semibold text-[var(--color-text-secondary)]">
              Admin
            </Badge>
          ) : (
            <Link
              href="/events"
              className={cn(
                buttonVariants("secondary", "sm"),
                "rounded-full",
              )}
            >
              Browse events
            </Link>
          )}
        </div>
      </Card>

      {!isAdmin ? (
        <>
          {/* User tab bar */}
          <div className="flex rounded-xl border border-white/10 bg-[#0c1d2e]/75 p-1">
            {(["registered", "saved"] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setUserTab(tab)}
                className={cn(
                  "flex-1 rounded-lg py-3 text-sm font-semibold transition",
                  userTab === tab
                    ? "bg-[var(--color-brand)] text-[var(--color-brand-text)]"
                    : "text-[var(--color-text-secondary)] active:bg-white/5",
                )}
              >
                {tab === "registered" ? "My Tickets" : "Saved Events"}
              </button>
            ))}
          </div>

          {userTab === "registered" ? (
            <section className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-white">Registered events</h2>
                <Select
                  value={registeredStatus}
                  onChange={(e) => setRegisteredStatus(e.target.value)}
                  className="max-w-[140px] bg-[#0a1927]"
                >
                  <option value="upcoming">Upcoming</option>
                  <option value="past">Past</option>
                  <option value="all">All</option>
                </Select>
              </div>
              {registeredLoading ? (
                <div className="grid gap-3">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <EventListItemSkeleton key={i} />
                  ))}
                </div>
              ) : registeredEvents.length === 0 ? (
                <EmptyState
                  title="No registered events"
                  description="Browse events and register for your first match."
                  action={{ label: "Browse events", href: "/events" }}
                />
              ) : (
                <div className="grid gap-3">
                  {registeredEvents.map((event) => (
                    <Card key={event.eventId} className="rounded-xl border border-white/10 bg-[#0a1927] p-4">
                      <div className="flex gap-3">
                        <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-lg bg-[linear-gradient(135deg,#0f2b3f,#0b1d2d)]">
                          <span className="text-2xl font-bold text-white/30">{event.eventName.charAt(0)}</span>
                        </div>
                        <div className="flex flex-1 flex-col justify-center gap-0.5">
                          <h3 className="line-clamp-1 text-base font-semibold text-white">{event.eventName}</h3>
                          <p className="text-sm text-[var(--color-text-secondary)]">
                            {new Date(event.eventDatetime).toLocaleString()}
                          </p>
                          <p className="text-sm text-[var(--color-text-muted)]">
                            {event.addressLabel ?? "Location pending"}
                          </p>
                          <div className="mt-1 flex items-center gap-2">
                            <span className="rounded-full bg-[var(--color-brand)]/15 px-2 py-0.5 text-xs font-semibold text-[var(--color-brand)]">
                              {event.ticketCount} ticket{event.ticketCount === 1 ? "" : "s"}
                            </span>
                            <span className="text-sm font-medium text-white">ETB {event.priceField ?? 0}</span>
                          </div>
                        </div>
                      </div>
                      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                        <Link
                          href={`/events/${event.eventId}`}
                          className="flex h-11 flex-1 items-center justify-center rounded-lg border border-white/15 text-sm font-medium text-white"
                        >
                          View
                        </Link>
                        {event.ticketCount > 1 ? (
                          <button
                            type="button"
                            onClick={() => void handleShareLink(event.eventId)}
                            className="flex h-11 flex-1 items-center justify-center rounded-lg border border-white/15 text-sm font-medium text-white"
                          >
                            {copiedEventId === event.eventId ? "Copied!" : "Share ticket"}
                          </button>
                        ) : null}
                        <button
                          type="button"
                          onClick={() => void toggleSavedEvent(event.eventId, savedIds.has(event.eventId))}
                          className="flex h-11 flex-1 items-center justify-center rounded-lg border border-white/15 text-sm font-medium text-white"
                        >
                          {savedIds.has(event.eventId) ? "Unsave" : "Save"}
                        </button>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </section>
          ) : (
            <section className="space-y-4">
              <h2 className="text-lg font-semibold text-white">Saved events</h2>
              {savedLoading ? (
                <div className="grid gap-3">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <EventListItemSkeleton key={i} />
                  ))}
                </div>
              ) : savedEvents.length === 0 ? (
                <EmptyState
                  title="You haven't saved any events yet"
                  description="Save events you're interested in to find them here."
                  action={{ label: "Browse events", href: "/events" }}
                />
              ) : (
                <div className="grid gap-3">
                  {savedEvents.map((event) => (
                    <Card key={event.eventId} className="rounded-xl border border-white/10 bg-[#0a1927] p-4">
                      <div className="flex gap-3">
                        <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-lg bg-[linear-gradient(135deg,#0f2b3f,#0b1d2d)]">
                          <span className="text-2xl font-bold text-white/30">{event.eventName.charAt(0)}</span>
                        </div>
                        <div className="flex flex-1 flex-col justify-center gap-0.5">
                          <h3 className="line-clamp-1 text-base font-semibold text-white">{event.eventName}</h3>
                          <p className="text-sm text-[var(--color-text-secondary)]">
                            {new Date(event.eventDatetime).toLocaleString()}
                          </p>
                          <p className="text-sm text-[var(--color-text-muted)]">
                            {event.addressLabel ?? "Location pending"}
                          </p>
                        </div>
                      </div>
                      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                        <Link
                          href={`/events/${event.eventId}`}
                          className="flex h-11 flex-1 items-center justify-center rounded-lg border border-white/15 text-sm font-medium text-white"
                        >
                          View
                        </Link>
                        <Button
                          type="button"
                          onClick={() => void toggleSavedEvent(event.eventId, true)}
                          variant="danger"
                          className="h-11 flex-1 rounded-lg"
                        >
                          Remove
                        </Button>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </section>
          )}
        </>
      ) : (
        <>
          {/* Admin tab bar */}
          <div className="flex rounded-xl border border-white/10 bg-[#0c1d2e]/75 p-1">
            {(["users", "events", "stats"] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setAdminTab(tab)}
                className={cn(
                  "flex-1 rounded-lg py-3 text-sm font-semibold transition",
                  adminTab === tab
                    ? "bg-[var(--color-brand)] text-[var(--color-brand-text)]"
                    : "text-[var(--color-text-secondary)] active:bg-white/5",
                )}
              >
                {tab === "users" ? "Users" : tab === "events" ? "Events" : "Stats"}
              </button>
            ))}
          </div>

          {adminTab === "users" ? (
            <section className="space-y-4 rounded-2xl border border-white/10 bg-[#0c1d2e]/80 p-4 sm:p-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <h2 className="text-lg font-semibold text-white">User administration</h2>
                <div className="flex gap-2">
                  <Input
                    value={userSearch}
                    onChange={(e) => setUserSearch(e.target.value)}
                    placeholder="Search by email/name"
                    className="bg-[#0a1927]"
                  />
                  <Button onClick={() => void loadAdminUsers()} variant="primary" size="sm">
                    Search
                  </Button>
                </div>
              </div>
              {adminUsersLoading ? (
                <TableSkeleton rows={6} cols={4} />
              ) : (
                <div className="overflow-x-auto">
                  <Table className="table-shell">
                    <thead className="text-[var(--color-brand)]">
                      <tr>
                        <th className="py-2 pr-4">User</th>
                        <th className="py-2 pr-4">Role</th>
                        <th className="py-2 pr-4">Status</th>
                        <th className="py-2 pr-4">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="text-[var(--color-text-secondary)]">
                      {adminUsers.map((row) => (
                        <tr key={row.id || row.email} className="border-t border-white/10">
                          <td className="py-3 pr-4">
                            <p className="text-white">{row.name}</p>
                            <p className="text-sm text-[var(--color-text-muted)]">{row.email}</p>
                          </td>
                          <td className="py-3 pr-4">{row.role}</td>
                          <td className="py-3 pr-4">{row.banned ? "Banned" : "Active"}</td>
                          <td className="py-3 pr-4">
                            <div className="flex flex-wrap gap-2">
                              <Button
                                type="button"
                                size="sm"
                                variant="secondary"
                                onClick={() => void handleSetRole(row.id, row.role === "admin" ? "user" : "admin")}
                              >
                                {row.role === "admin" ? "Remove admin" : "Make admin"}
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                variant="danger"
                                onClick={() => void handleBanToggle(row.id, !row.banned)}
                              >
                                {row.banned ? "Unban" : "Ban"}
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                </div>
              )}
            </section>
          ) : null}

          {adminTab === "events" ? (
            <section className="space-y-4 rounded-2xl border border-white/10 bg-[#0c1d2e]/80 p-4 sm:p-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <h2 className="text-lg font-semibold text-white">Event moderation</h2>
                <div className="flex gap-2">
                  <Input
                    value={eventSearch}
                    onChange={(e) => setEventSearch(e.target.value)}
                    placeholder="Search events"
                    className="bg-[#0a1927]"
                  />
                  <Button onClick={() => void loadAdminEvents()} variant="primary" size="sm">
                    Search
                  </Button>
                </div>
              </div>
              {adminEventsLoading ? (
                <TableSkeleton rows={6} cols={5} />
              ) : (
                <div className="overflow-x-auto">
                  <Table className="table-shell">
                    <thead className="text-[var(--color-brand)]">
                      <tr>
                        <th className="py-2 pr-4">Event</th>
                        <th className="py-2 pr-4">Date</th>
                        <th className="py-2 pr-4">Host</th>
                        <th className="py-2 pr-4">Price</th>
                        <th className="py-2 pr-4">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="text-[var(--color-text-secondary)]">
                      {adminEvents.map((event) => (
                        <tr key={event.eventId} className="border-t border-white/10">
                          <td className="py-3 pr-4 text-white">{event.eventName}</td>
                          <td className="py-3 pr-4">{new Date(event.eventDatetime).toLocaleString()}</td>
                          <td className="py-3 pr-4">{adminUserNameById.get(event.userId) ?? event.userId}</td>
                          <td className="py-3 pr-4">ETB {event.priceField ?? 0}</td>
                          <td className="py-3 pr-4">
                            <div className="flex gap-2">
                              <Button
                                type="button"
                                size="sm"
                                variant="secondary"
                                onClick={() => void startEditEvent(event.eventId)}
                              >
                                Edit
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                variant="danger"
                                onClick={() => void handleDeleteEvent(event.eventId)}
                              >
                                Delete
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                </div>
              )}

              {editingEvent ? (
                <div id="admin-event-editor" className="space-y-3 rounded-xl border border-white/10 bg-[#0a1927] p-4">
                  <h3 className="text-lg font-semibold text-white">Edit event details</h3>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Input value={editingEvent.eventName} onChange={(e) => setEditingEvent((prev) => prev ? { ...prev, eventName: e.target.value } : prev)} placeholder="Event name" className="bg-[#08111c]" />
                    <Input value={editingEvent.pictureUrl ?? ""} onChange={(e) => setEditingEvent((prev) => prev ? { ...prev, pictureUrl: e.target.value } : prev)} placeholder="Picture URL" className="bg-[#08111c]" />
                    <Input type="datetime-local" value={editingEvent.eventDatetime.slice(0, 16)} onChange={(e) => setEditingEvent((prev) => prev ? { ...prev, eventDatetime: new Date(e.target.value).toISOString() } : prev)} className="bg-[#08111c]" />
                    <Input type="datetime-local" value={editingEvent.eventEndtime.slice(0, 16)} onChange={(e) => setEditingEvent((prev) => prev ? { ...prev, eventEndtime: new Date(e.target.value).toISOString() } : prev)} className="bg-[#08111c]" />
                    <Input type="number" value={editingEvent.priceField ?? 0} onChange={(e) => setEditingEvent((prev) => prev ? { ...prev, priceField: Number(e.target.value) } : prev)} placeholder="Price ETB" className="bg-[#08111c]" />
                    <Input type="number" value={editingEvent.capacity ?? 0} onChange={(e) => setEditingEvent((prev) => prev ? { ...prev, capacity: Number(e.target.value) } : prev)} placeholder="Capacity" className="bg-[#08111c]" />
                    <Select value={editingEvent.categoryId ?? ""} onChange={(e) => setEditingEvent((prev) => prev ? { ...prev, categoryId: e.target.value } : prev)} className="bg-[#08111c]">
                      {categories.map((category) => (
                        <option key={category.categoryId} value={category.categoryId}>{category.categoryName}</option>
                      ))}
                    </Select>
                    <Input value={editingEvent.eventLocation ?? ""} onChange={(e) => setEditingEvent((prev) => prev ? { ...prev, eventLocation: e.target.value } : prev)} placeholder="Event location" className="bg-[#08111c]" />
                  </div>
                  <textarea
                    rows={4}
                    value={editingEvent.description ?? ""}
                    onChange={(e) => setEditingEvent((prev) => prev ? { ...prev, description: e.target.value } : prev)}
                    className="w-full rounded-xl border border-white/10 bg-[#08111c] px-4 py-3 text-base text-white sm:text-sm"
                    placeholder="Description"
                  />
                  {editingEvent.isRecurring && editingEvent.seriesId ? (
                    <label className="flex items-center gap-2 text-sm text-[var(--color-text-secondary)]">
                      <input type="checkbox" checked={applyToSeries} onChange={(e) => setApplyToSeries(e.target.checked)} />
                      Apply changes to all occurrences in this recurring series
                    </label>
                  ) : null}
                  {editingEvent.isRecurring && editingEvent.seriesId && applyToSeries ? (
                    <p className="rounded-lg border border-[#22FF88]/40 bg-[#22FF88]/10 px-4 py-3 text-sm text-[#d9ffea]">
                      This will update {seriesCount} occurrence{seriesCount === 1 ? "" : "s"} in this series.
                    </p>
                  ) : null}
                  <div className="flex gap-2">
                    <Button type="button" disabled={savingEvent} onClick={() => void handleSaveEventChanges()} variant="primary">
                      {savingEvent ? "Saving..." : "Save changes"}
                    </Button>
                    <Button type="button" onClick={() => { setEditingEvent(null); setApplyToSeries(false); }} variant="secondary">
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : null}
            </section>
          ) : null}

          {adminTab === "stats" ? (
            <section className="space-y-4 rounded-2xl border border-white/10 bg-[#0c1d2e]/80 p-4 sm:p-5">
              <h2 className="text-lg font-semibold text-white">Platform statistics</h2>
              {statsLoading ? (
                <StatsCardsSkeleton count={4} />
              ) : stats ? (
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                  {Object.entries((stats.cards as Record<string, unknown>) ?? {}).map(([label, value]) => (
                    <div key={label} className="rounded-xl border border-white/10 bg-[#0a1927] p-4">
                      <p className="text-sm uppercase tracking-widest text-[var(--color-brand)]">{label}</p>
                      <p className="mt-2 text-2xl font-bold text-white">{String(value)}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-[var(--color-text-secondary)]">No statistics available.</p>
              )}
            </section>
          ) : null}
        </>
      )}
    </section>
  );
}
