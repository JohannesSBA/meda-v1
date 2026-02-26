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
  const [registeredEvents, setRegisteredEvents] = useState<
    RegisteredEventItem[]
  >([]);
  const [registeredLoading, setRegisteredLoading] = useState(false);

  const [savedEvents, setSavedEvents] = useState<SavedEventItem[]>([]);
  const [savedLoading, setSavedLoading] = useState(false);

  const [adminUsers, setAdminUsers] = useState<
    Array<ReturnType<typeof readUser>>
  >([]);
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
      const res = await fetch(
        `/api/profile/registered-events?status=${registeredStatus}`,
        {
          cache: "no-store",
        },
      );
      const data = await res.json();
      if (!res.ok)
        throw new Error(data?.error || "Failed to load registered events");
      setRegisteredEvents(data.items ?? []);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to load registered events",
      );
    } finally {
      setRegisteredLoading(false);
    }
  };

  const loadSavedEvents = async () => {
    setSavedLoading(true);
    try {
      const res = await fetch("/api/profile/saved-events", {
        cache: "no-store",
      });
      const data = await res.json();
      if (!res.ok)
        throw new Error(data?.error || "Failed to load saved events");
      setSavedEvents(data.items ?? []);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to load saved events",
      );
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
      toast.error(
        error instanceof Error ? error.message : "Failed to load users",
      );
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
      toast.error(
        error instanceof Error ? error.message : "Failed to load admin events",
      );
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
      toast.error(
        error instanceof Error ? error.message : "Failed to load statistics",
      );
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
      toast.error(
        error instanceof Error ? error.message : "Failed to load categories",
      );
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
      toast.success(isSaved ? "Event removed from saved list" : "Event saved", {
        id: `save-${eventId}`,
      });
      await loadSavedEvents();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Save action failed",
      );
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
      toast.error(
        error instanceof Error ? error.message : "Unable to create share link",
      );
    }
  };

  const handleSetRole = async (
    targetUserId: string,
    role: "admin" | "user",
  ) => {
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
      toast.error(
        error instanceof Error ? error.message : "Role update failed",
      );
    }
  };

  const handleBanToggle = async (targetUserId: string, banned: boolean) => {
    try {
      const res = await fetch(`/api/admin/users/${targetUserId}/ban`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          banned,
          banReason: banned ? "Moderation action from admin panel" : undefined,
        }),
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
      const res = await fetch(`/api/admin/events/${eventId}`, {
        method: "DELETE",
      });
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
      toast.error(
        error instanceof Error ? error.message : "Failed to update event",
      );
    } finally {
      setSavingEvent(false);
    }
  };

  return (
    <section className="space-y-6">
      <Card className="rounded-3xl bg-linear-to-br from-[#0f2235]/80 via-[#0c1c2d]/70 to-[#0a1523]/80 p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Image
              src={avatarUrl}
              alt={`${user.name} profile`}
              width={64}
              height={64}
              className="h-16 w-16 rounded-full    -white/15 object-cover"
            />
            <div>
              <p className="text-xs uppercase tracking-[0.25em] text-[#7ccfff]">
                {isAdmin ? "Admin profile" : "My profile"}
              </p>
              <h1 className="mt-2 text-3xl font-bold text-white">
                {user.name}
              </h1>
              <p className="mt-1 text-sm text-[#a7c5de]">{user.email}</p>
            </div>
          </div>
          {isAdmin ? (
            <Badge className="rounded-full    -white/15 bg-white/5 px-4 py-2 text-sm font-semibold text-[#b9cde4]">
              Role: admin
            </Badge>
          ) : (
            <Link
              href="/events"
              className={cn(
                buttonVariants("secondary", "sm"),
                "rounded-full  -white/15 bg-white/5 text-[#22FF88] hover: -[#22FF88]",
              )}
            >
              Browse events
            </Link>
          )}
        </div>
      </Card>

      {!isAdmin ? (
        <>
          <nav className="flex flex-wrap gap-2 rounded-2xl    -white/10 bg-[#0c1d2e]/75 p-2">
            <Button
              type="button"
              onClick={() => setUserTab("registered")}
              variant={userTab === "registered" ? "primary" : "ghost"}
              className={`rounded-xl px-4 py-2 text-sm font-medium ${
                userTab === "registered"
                  ? "text-[#001021]"
                  : "text-[#c4d8ef] hover:bg-white/10 hover:text-white"
              }`}
            >
              Registered Events
            </Button>
            <Button
              type="button"
              onClick={() => setUserTab("saved")}
              variant={userTab === "saved" ? "primary" : "ghost"}
              className={`rounded-xl px-4 py-2 text-sm font-medium ${
                userTab === "saved"
                  ? "text-[#001021]"
                  : "text-[#c4d8ef] hover:bg-white/10 hover:text-white"
              }`}
            >
              Saved Events
            </Button>
          </nav>

          {userTab === "registered" ? (
            <section className="space-y-4 rounded-2xl    -white/10 bg-[#0c1d2e]/80 p-5">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold text-white">
                  Registered events
                </h2>
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
                    <article
                      key={event.eventId}
                      className="rounded-xl    -white/10 bg-[#0a1927] p-4"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <h3 className="font-semibold text-white">
                            {event.eventName}
                          </h3>
                          <p className="text-xs text-[#9ec0df]">
                            {new Date(event.eventDatetime).toLocaleString()} •{" "}
                            {event.addressLabel ?? "Location pending"}
                          </p>
                          <p className="mt-1 text-xs text-[#9ec0df]">
                            Tickets: {event.ticketCount} • Price: ETB{" "}
                            {event.priceField ?? 0}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <Link
                            href={`/events/${event.eventId}`}
                            className="rounded-lg    -white/15 px-3 py-1 text-sm hover: -[#22FF88]"
                          >
                            View
                          </Link>
                          {event.ticketCount > 1 ? (
                            <>
                              <Button
                                type="button"
                                onClick={() => void handleShareLink(event.eventId)}
                                variant="secondary"
                                size="sm"
                                className="rounded-lg"
                              >
                                Share link
                              </Button>
                              {copiedEventId === event.eventId ? (
                                <span className="self-center text-xs text-[#22FF88]">
                                  Copied
                                </span>
                              ) : null}
                            </>
                          ) : null}
                          <Button
                            type="button"
                            onClick={() =>
                              void toggleSavedEvent(
                                event.eventId,
                                savedIds.has(event.eventId),
                              )
                            }
                            variant="secondary"
                            size="sm"
                            className="rounded-lg"
                          >
                            {savedIds.has(event.eventId) ? "Unsave" : "Save"}
                          </Button>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </section>
          ) : (
            <section className="space-y-4 rounded-2xl    -white/10 bg-[#0c1d2e]/80 p-5">
              <h2 className="text-xl font-semibold text-white">Saved events</h2>
              {savedLoading ? (
                <div className="grid gap-3">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <EventListItemSkeleton key={i} />
                  ))}
                </div>
              ) : savedEvents.length === 0 ? (
                <EmptyState
                  title="No saved events yet"
                  description="Save events to find them here."
                  action={{ label: "Browse events", href: "/events" }}
                />
              ) : (
                <div className="grid gap-3">
                  {savedEvents.map((event) => (
                    <article
                      key={event.eventId}
                      className="rounded-xl    -white/10 bg-[#0a1927] p-4"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <h3 className="font-semibold text-white">
                            {event.eventName}
                          </h3>
                          <p className="text-xs text-[#9ec0df]">
                            {new Date(event.eventDatetime).toLocaleString()} •{" "}
                            {event.addressLabel ?? "Location pending"}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <Link
                            href={`/events/${event.eventId}`}
                            className="rounded-lg    -white/15 px-3 py-1 text-sm hover: -[#22FF88]"
                          >
                            View
                          </Link>
                          <Button
                            type="button"
                            onClick={() =>
                              void toggleSavedEvent(event.eventId, true)
                            }
                            variant="danger"
                            size="sm"
                            className="rounded-lg"
                          >
                            Remove
                          </Button>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </section>
          )}
        </>
      ) : (
        <>
          <nav className="flex flex-wrap gap-2 rounded-2xl    -white/10 bg-[#0c1d2e]/75 p-2">
            {(["users", "events", "stats"] as const).map((tab) => (
              <Button
                key={tab}
                type="button"
                onClick={() => setAdminTab(tab)}
                variant={adminTab === tab ? "primary" : "ghost"}
                className={`rounded-xl px-4 py-2 text-sm font-medium ${
                  adminTab === tab
                    ? "text-[#001021]"
                    : "text-[#c4d8ef] hover:bg-white/10 hover:text-white"
                }`}
              >
                {tab === "users"
                  ? "Admin Users"
                  : tab === "events"
                    ? "Admin Events"
                    : "Statistics"}
              </Button>
            ))}
          </nav>

          {adminTab === "users" ? (
            <section className="space-y-4 rounded-2xl    -white/10 bg-[#0c1d2e]/80 p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-xl font-semibold text-white">
                  User administration
                </h2>
                <div className="flex gap-2">
                  <Input
                    value={userSearch}
                    onChange={(e) => setUserSearch(e.target.value)}
                    placeholder="Search by email/name"
                    className="h-10 min-w-[220px] bg-[#0a1927]"
                  />
                  <Button
                    onClick={() => void loadAdminUsers()}
                    variant="primary"
                    size="sm"
                  >
                    Search
                  </Button>
                </div>
              </div>
              {adminUsersLoading ? (
                <TableSkeleton rows={6} cols={4} />
              ) : (
                <div className="overflow-x-auto">
                  <Table className="table-shell">
                    <thead className="text-[#7ccfff]">
                      <tr>
                        <th className="py-2 pr-4">User</th>
                        <th className="py-2 pr-4">Role</th>
                        <th className="py-2 pr-4">Status</th>
                        <th className="py-2 pr-4">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="text-[#d5e7fb]">
                      {adminUsers.map((row) => (
                        <tr
                          key={row.id || row.email}
                          className=" -t  -white/10"
                        >
                          <td className="py-3 pr-4">
                            <p>{row.name}</p>
                            <p className="text-xs text-[#9ec0df]">
                              {row.email}
                            </p>
                          </td>
                          <td className="py-3 pr-4">{row.role}</td>
                          <td className="py-3 pr-4">
                            {row.banned ? "Banned" : "Active"}
                          </td>
                          <td className="py-3 pr-4">
                            <div className="flex flex-wrap gap-2">
                              <button
                                type="button"
                                onClick={() =>
                                  void handleSetRole(
                                    row.id,
                                    row.role === "admin" ? "user" : "admin",
                                  )
                                }
                                className="rounded-lg px-3 py-1 hover: -[#22FF88]"
                              >
                                {row.role === "admin"
                                  ? "Remove admin"
                                  : "Make admin"}
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  void handleBanToggle(row.id, !row.banned)
                                }
                                className="rounded-lg  px-3 py-1 text-red-200 hover: -red-300/60"
                              >
                                {row.banned ? "Unban" : "Ban"}
                              </button>
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
            <section className="space-y-4 rounded-2xl    -white/10 bg-[#0c1d2e]/80 p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-xl font-semibold text-white">
                  Event moderation
                </h2>
                <div className="flex gap-2">
                  <Input
                    value={eventSearch}
                    onChange={(e) => setEventSearch(e.target.value)}
                    placeholder="Search events"
                    className="h-10 min-w-[220px] bg-[#0a1927]"
                  />
                  <Button
                    onClick={() => void loadAdminEvents()}
                    variant="primary"
                    size="sm"
                  >
                    Search
                  </Button>
                </div>
              </div>
              {adminEventsLoading ? (
                <TableSkeleton rows={6} cols={5} />
              ) : (
                <div className="overflow-x-auto">
                  <Table className="table-shell">
                    <thead className="text-[#7ccfff]">
                      <tr>
                        <th className="py-2 pr-4">Event</th>
                        <th className="py-2 pr-4">Date</th>
                        <th className="py-2 pr-4">Host</th>
                        <th className="py-2 pr-4">Price</th>
                        <th className="py-2 pr-4">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="text-[#d5e7fb]">
                      {adminEvents.map((event) => (
                        <tr key={event.eventId} className=" -t  -white/10">
                          <td className="py-3 pr-4">{event.eventName}</td>
                          <td className="py-3 pr-4">
                            {new Date(event.eventDatetime).toLocaleString()}
                          </td>
                          <td className="py-3 pr-4">
                            {adminUserNameById.get(event.userId) ??
                              event.userId}
                          </td>
                          <td className="py-3 pr-4">
                            ETB {event.priceField ?? 0}
                          </td>
                          <td className="py-3 pr-4">
                            <div className="flex gap-2">
                              <button
                                type="button"
                                onClick={() =>
                                  void startEditEvent(event.eventId)
                                }
                                className="rounded-lg  cursor-pointer    -white/15 px-3 py-1 hover: -[#22FF88]"
                              >
                                Edit
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  void handleDeleteEvent(event.eventId)
                                }
                                className="rounded-lg    -red-300/30 px-3 py-1 text-red-200 hover: -red-300/60"
                              >
                                Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                </div>
              )}

              {editingEvent ? (
                <div
                  id="admin-event-editor"
                  className="space-y-3 rounded-xl    -white/10 bg-[#0a1927] p-4"
                >
                  <h3 className="text-lg font-semibold text-white">
                    Edit event details
                  </h3>
                  <div className="grid gap-3 md:grid-cols-2">
                    <input
                      value={editingEvent.eventName}
                      onChange={(e) =>
                        setEditingEvent((prev) =>
                          prev ? { ...prev, eventName: e.target.value } : prev,
                        )
                      }
                      className="rounded-lg    -white/15 bg-[#08111c] px-3 py-2 text-sm text-white"
                      placeholder="Event name"
                    />
                    <input
                      value={editingEvent.pictureUrl ?? ""}
                      onChange={(e) =>
                        setEditingEvent((prev) =>
                          prev ? { ...prev, pictureUrl: e.target.value } : prev,
                        )
                      }
                      className="rounded-lg    -white/15 bg-[#08111c] px-3 py-2 text-sm text-white"
                      placeholder="Picture URL"
                    />
                    <input
                      type="datetime-local"
                      value={editingEvent.eventDatetime.slice(0, 16)}
                      onChange={(e) =>
                        setEditingEvent((prev) =>
                          prev
                            ? {
                                ...prev,
                                eventDatetime: new Date(
                                  e.target.value,
                                ).toISOString(),
                              }
                            : prev,
                        )
                      }
                      className="rounded-lg    -white/15 bg-[#08111c] px-3 py-2 text-sm text-white"
                    />
                    <input
                      type="datetime-local"
                      value={editingEvent.eventEndtime.slice(0, 16)}
                      onChange={(e) =>
                        setEditingEvent((prev) =>
                          prev
                            ? {
                                ...prev,
                                eventEndtime: new Date(
                                  e.target.value,
                                ).toISOString(),
                              }
                            : prev,
                        )
                      }
                      className="rounded-lg    -white/15 bg-[#08111c] px-3 py-2 text-sm text-white"
                    />
                    <input
                      type="number"
                      value={editingEvent.priceField ?? 0}
                      onChange={(e) =>
                        setEditingEvent((prev) =>
                          prev
                            ? { ...prev, priceField: Number(e.target.value) }
                            : prev,
                        )
                      }
                      className="rounded-lg    -white/15 bg-[#08111c] px-3 py-2 text-sm text-white"
                      placeholder="Price ETB"
                    />
                    <input
                      type="number"
                      value={editingEvent.capacity ?? 0}
                      onChange={(e) =>
                        setEditingEvent((prev) =>
                          prev
                            ? { ...prev, capacity: Number(e.target.value) }
                            : prev,
                        )
                      }
                      className="rounded-lg    -white/15 bg-[#08111c] px-3 py-2 text-sm text-white"
                      placeholder="Capacity"
                    />
                    <select
                      value={editingEvent.categoryId ?? ""}
                      onChange={(e) =>
                        setEditingEvent((prev) =>
                          prev ? { ...prev, categoryId: e.target.value } : prev,
                        )
                      }
                      className="rounded-lg    -white/15 bg-[#08111c] px-3 py-2 text-sm text-white"
                    >
                      {categories.map((category) => (
                        <option
                          key={category.categoryId}
                          value={category.categoryId}
                        >
                          {category.categoryName}
                        </option>
                      ))}
                    </select>
                    <input
                      value={editingEvent.eventLocation ?? ""}
                      onChange={(e) =>
                        setEditingEvent((prev) =>
                          prev
                            ? { ...prev, eventLocation: e.target.value }
                            : prev,
                        )
                      }
                      className="rounded-lg    -white/15 bg-[#08111c] px-3 py-2 text-sm text-white"
                      placeholder="Event location"
                    />
                  </div>
                  <textarea
                    rows={4}
                    value={editingEvent.description ?? ""}
                    onChange={(e) =>
                      setEditingEvent((prev) =>
                        prev ? { ...prev, description: e.target.value } : prev,
                      )
                    }
                    className="w-full rounded-lg    -white/15 bg-[#08111c] px-3 py-2 text-sm text-white"
                    placeholder="Description"
                  />
                  {editingEvent.isRecurring && editingEvent.seriesId ? (
                    <label className="flex items-center gap-2 text-sm text-[#c4d8ef]">
                      <input
                        type="checkbox"
                        checked={applyToSeries}
                        onChange={(e) => setApplyToSeries(e.target.checked)}
                      />
                      Apply changes to all occurrences in this recurring series
                    </label>
                  ) : null}
                  {editingEvent.isRecurring &&
                  editingEvent.seriesId &&
                  applyToSeries ? (
                    <p className="rounded-lg    -[#22FF88]/40 bg-[#22FF88]/10 px-3 py-2 text-sm text-[#d9ffea]">
                      This will update {seriesCount} occurrence
                      {seriesCount === 1 ? "" : "s"} in this series.
                    </p>
                  ) : null}
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={savingEvent}
                      onClick={() => void handleSaveEventChanges()}
                      className="rounded-lg bg-[#00E5FF] px-4 py-2 text-sm font-semibold text-[#001021] disabled:opacity-60"
                    >
                      {savingEvent ? "Saving..." : "Save changes"}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingEvent(null);
                        setApplyToSeries(false);
                      }}
                      className="rounded-lg cursor-pointer    -white/15 px-4 py-2 text-sm text-white"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : null}
            </section>
          ) : null}

          {adminTab === "stats" ? (
            <section className="space-y-4 rounded-2xl    -white/10 bg-[#0c1d2e]/80 p-5">
              <h2 className="text-xl font-semibold text-white">
                Platform statistics
              </h2>
              {statsLoading ? (
                <StatsCardsSkeleton count={4} />
              ) : stats ? (
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                  {Object.entries(
                    (stats.cards as Record<string, unknown>) ?? {},
                  ).map(([label, value]) => (
                    <div
                      key={label}
                      className="rounded-xl    -white/10 bg-[#0a1927] p-4"
                    >
                      <p className="text-xs uppercase tracking-[0.12em] text-[#7ccfff]">
                        {label}
                      </p>
                      <p className="mt-2 text-2xl font-bold text-white">
                        {String(value)}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-[#a7c5de]">
                  No statistics available.
                </p>
              )}
            </section>
          ) : null}
        </>
      )}
    </section>
  );
}
