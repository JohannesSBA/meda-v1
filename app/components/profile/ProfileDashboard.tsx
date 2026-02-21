"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";

type ProfileUser = {
  id: string;
  name: string;
  email: string;
  role: string;
};

type MyEventItem = {
  eventId: string;
  eventName: string;
  eventDatetime: string;
  attendeeCount: number;
  capacity: number | null;
  isRecurring?: boolean;
  recurrenceKind?: string | null;
  addressLabel?: string | null;
};

type AdminEventItem = {
  eventId: string;
  eventName: string;
  eventDatetime: string;
  userId: string;
  attendeeCount: number;
  isRecurring?: boolean;
  addressLabel?: string | null;
};

type TabId = "overview" | "myEvents" | "users" | "events" | "stats";

const userTabs: Array<{ id: TabId; label: string }> = [
  { id: "overview", label: "Overview" },
  { id: "myEvents", label: "My Events" },
];
const adminTabs: Array<{ id: TabId; label: string }> = [
  { id: "users", label: "Admin Users" },
  { id: "events", label: "Admin Events" },
  { id: "stats", label: "Statistics" },
];

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
  const isAdmin = user.role === "admin";
  const [activeTab, setActiveTab] = useState<TabId>("overview");

  const [myEvents, setMyEvents] = useState<MyEventItem[]>([]);
  const [myEventsStatus, setMyEventsStatus] = useState("upcoming");
  const [myEventsLoading, setMyEventsLoading] = useState(false);

  const [adminUsers, setAdminUsers] = useState<Array<ReturnType<typeof readUser>>>([]);
  const [adminUsersLoading, setAdminUsersLoading] = useState(false);
  const [userSearch, setUserSearch] = useState("");

  const [adminEvents, setAdminEvents] = useState<AdminEventItem[]>([]);
  const [adminEventsLoading, setAdminEventsLoading] = useState(false);
  const [eventSearch, setEventSearch] = useState("");

  const [stats, setStats] = useState<Record<string, unknown> | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);

  const tabs = useMemo(
    () => (isAdmin ? [...userTabs, ...adminTabs] : userTabs),
    [isAdmin]
  );

  useEffect(() => {
    if (!tabs.some((t) => t.id === activeTab)) setActiveTab("overview");
  }, [tabs, activeTab]);

  const loadMyEvents = async () => {
    setMyEventsLoading(true);
    try {
      const res = await fetch(`/api/profile/events?status=${myEventsStatus}`, { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to load events");
      setMyEvents(data.items ?? []);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load events");
    } finally {
      setMyEventsLoading(false);
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

  useEffect(() => {
    if (activeTab === "myEvents") void loadMyEvents();
    if (activeTab === "users") void loadAdminUsers();
    if (activeTab === "events") void loadAdminEvents();
    if (activeTab === "stats") void loadStats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, myEventsStatus]);

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
      const res = await fetch(`/api/admin/events/${eventId}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Delete failed");
      toast.success("Event deleted");
      void loadAdminEvents();
      if (activeTab === "myEvents") void loadMyEvents();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Delete failed");
    }
  };

  return (
    <section className="space-y-6">
      <header className="rounded-3xl bg-linear-to-br from-[#0f2235]/80 via-[#0c1c2d]/70 to-[#0a1523]/80 p-6 shadow-2xl shadow-[#00e5ff12]">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.25em] text-[#7ccfff]">Profile center</p>
            <h1 className="mt-2 text-3xl font-bold text-white">{user.name}</h1>
            <p className="mt-1 text-sm text-[#a7c5de]">{user.email}</p>
          </div>
          <span className="rounded-full border border-white/15 bg-white/5 px-4 py-2 text-sm font-semibold text-[#b9cde4]">
            Role: {user.role}
          </span>
        </div>
      </header>

      <nav className="flex flex-wrap gap-2 rounded-2xl border border-white/10 bg-[#0c1d2e]/75 p-2">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`rounded-xl px-4 py-2 text-sm font-medium transition ${
              activeTab === tab.id
                ? "bg-[#00E5FF] text-[#001021]"
                : "text-[#c4d8ef] hover:bg-white/10 hover:text-white"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      {activeTab === "overview" ? (
        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-white/10 bg-[#0c1d2e]/80 p-5">
            <p className="text-xs uppercase tracking-[0.14em] text-[#7ccfff]">Account</p>
            <p className="mt-2 text-lg font-semibold text-white">Authenticated with Neon Auth</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-[#0c1d2e]/80 p-5">
            <p className="text-xs uppercase tracking-[0.14em] text-[#7ccfff]">Quick action</p>
            <Link href="/create-events" className="mt-2 inline-flex text-sm font-semibold text-[#22FF88] hover:underline">
              Create a new event
            </Link>
          </div>
          <div className="rounded-2xl border border-white/10 bg-[#0c1d2e]/80 p-5">
            <p className="text-xs uppercase tracking-[0.14em] text-[#7ccfff]">Admin access</p>
            <p className="mt-2 text-sm text-[#c4d8ef]">
              {isAdmin
                ? "You can manage users, moderation, and platform statistics."
                : "Ask an admin for elevated access if you need moderation tools."}
            </p>
          </div>
        </div>
      ) : null}

      {activeTab === "myEvents" ? (
        <section className="space-y-4 rounded-2xl border border-white/10 bg-[#0c1d2e]/80 p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-white">My events</h2>
            <select
              value={myEventsStatus}
              onChange={(e) => setMyEventsStatus(e.target.value)}
              className="rounded-lg border border-white/15 bg-[#0a1927] px-3 py-2 text-sm text-white"
            >
              <option value="upcoming">Upcoming</option>
              <option value="past">Past</option>
              <option value="all">All</option>
            </select>
          </div>
          {myEventsLoading ? (
            <p className="text-sm text-[#a7c5de]">Loading your events...</p>
          ) : myEvents.length === 0 ? (
            <p className="text-sm text-[#a7c5de]">No events found for this filter.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="text-[#7ccfff]">
                  <tr>
                    <th className="py-2 pr-4">Name</th>
                    <th className="py-2 pr-4">Date</th>
                    <th className="py-2 pr-4">Attendees</th>
                    <th className="py-2 pr-4">Type</th>
                    <th className="py-2 pr-4">Actions</th>
                  </tr>
                </thead>
                <tbody className="text-[#d5e7fb]">
                  {myEvents.map((event) => (
                    <tr key={event.eventId} className="border-t border-white/10">
                      <td className="py-3 pr-4">{event.eventName}</td>
                      <td className="py-3 pr-4">{new Date(event.eventDatetime).toLocaleString()}</td>
                      <td className="py-3 pr-4">
                        {event.attendeeCount}/{event.capacity ?? "∞"}
                      </td>
                      <td className="py-3 pr-4">{event.isRecurring ? `Recurring (${event.recurrenceKind ?? "series"})` : "Single"}</td>
                      <td className="py-3 pr-4">
                        <div className="flex gap-2">
                          <Link href={`/events/${event.eventId}`} className="rounded-lg border border-white/15 px-3 py-1 hover:border-[#22FF88]">
                            View
                          </Link>
                          {isAdmin ? (
                            <button
                              type="button"
                              onClick={() => handleDeleteEvent(event.eventId)}
                              className="rounded-lg border border-red-300/30 px-3 py-1 text-red-200 hover:border-red-300/60"
                            >
                              Delete
                            </button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      ) : null}

      {isAdmin && activeTab === "users" ? (
        <section className="space-y-4 rounded-2xl border border-white/10 bg-[#0c1d2e]/80 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-xl font-semibold text-white">User administration</h2>
            <div className="flex gap-2">
              <input
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                placeholder="Search by email/name"
                className="rounded-lg border border-white/15 bg-[#0a1927] px-3 py-2 text-sm text-white"
              />
              <button onClick={() => void loadAdminUsers()} className="rounded-lg bg-[#00E5FF] px-3 py-2 text-sm font-semibold text-[#001021]">
                Search
              </button>
            </div>
          </div>

          {adminUsersLoading ? (
            <p className="text-sm text-[#a7c5de]">Loading users...</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
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
                    <tr key={row.id || row.email} className="border-t border-white/10">
                      <td className="py-3 pr-4">
                        <p>{row.name}</p>
                        <p className="text-xs text-[#9ec0df]">{row.email}</p>
                      </td>
                      <td className="py-3 pr-4">{row.role}</td>
                      <td className="py-3 pr-4">{row.banned ? "Banned" : "Active"}</td>
                      <td className="py-3 pr-4">
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => void handleSetRole(row.id, row.role === "admin" ? "user" : "admin")}
                            className="rounded-lg border border-white/15 px-3 py-1 hover:border-[#22FF88]"
                          >
                            {row.role === "admin" ? "Remove admin" : "Make admin"}
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleBanToggle(row.id, !row.banned)}
                            className="rounded-lg border border-red-300/30 px-3 py-1 text-red-200 hover:border-red-300/60"
                          >
                            {row.banned ? "Unban" : "Ban"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      ) : null}

      {isAdmin && activeTab === "events" ? (
        <section className="space-y-4 rounded-2xl border border-white/10 bg-[#0c1d2e]/80 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-xl font-semibold text-white">Event moderation</h2>
            <div className="flex gap-2">
              <input
                value={eventSearch}
                onChange={(e) => setEventSearch(e.target.value)}
                placeholder="Search events"
                className="rounded-lg border border-white/15 bg-[#0a1927] px-3 py-2 text-sm text-white"
              />
              <button onClick={() => void loadAdminEvents()} className="rounded-lg bg-[#00E5FF] px-3 py-2 text-sm font-semibold text-[#001021]">
                Search
              </button>
            </div>
          </div>
          {adminEventsLoading ? (
            <p className="text-sm text-[#a7c5de]">Loading events...</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="text-[#7ccfff]">
                  <tr>
                    <th className="py-2 pr-4">Event</th>
                    <th className="py-2 pr-4">Date</th>
                    <th className="py-2 pr-4">Host</th>
                    <th className="py-2 pr-4">Attendees</th>
                    <th className="py-2 pr-4">Actions</th>
                  </tr>
                </thead>
                <tbody className="text-[#d5e7fb]">
                  {adminEvents.map((event) => (
                    <tr key={event.eventId} className="border-t border-white/10">
                      <td className="py-3 pr-4">
                        <p>{event.eventName}</p>
                        <p className="text-xs text-[#9ec0df]">{event.addressLabel ?? "No location label"}</p>
                      </td>
                      <td className="py-3 pr-4">{new Date(event.eventDatetime).toLocaleString()}</td>
                      <td className="py-3 pr-4">{event.userId}</td>
                      <td className="py-3 pr-4">{event.attendeeCount}</td>
                      <td className="py-3 pr-4">
                        <button
                          type="button"
                          onClick={() => void handleDeleteEvent(event.eventId)}
                          className="rounded-lg border border-red-300/30 px-3 py-1 text-red-200 hover:border-red-300/60"
                        >
                          Delete event
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      ) : null}

      {isAdmin && activeTab === "stats" ? (
        <section className="space-y-4 rounded-2xl border border-white/10 bg-[#0c1d2e]/80 p-5">
          <h2 className="text-xl font-semibold text-white">Platform statistics</h2>
          {statsLoading ? (
            <p className="text-sm text-[#a7c5de]">Loading stats...</p>
          ) : stats ? (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {Object.entries((stats.cards as Record<string, unknown>) ?? {}).map(([label, value]) => (
                <div key={label} className="rounded-xl border border-white/10 bg-[#0a1927] p-4">
                  <p className="text-xs uppercase tracking-[0.12em] text-[#7ccfff]">{label}</p>
                  <p className="mt-2 text-2xl font-bold text-white">{String(value)}</p>
                </div>
              ))}
              {Object.entries((stats.trends as Record<string, unknown>) ?? {}).map(([label, value]) => (
                <div key={label} className="rounded-xl border border-white/10 bg-[#0a1927] p-4">
                  <p className="text-xs uppercase tracking-[0.12em] text-[#7ccfff]">{label}</p>
                  <p className="mt-2 text-2xl font-bold text-white">{String(value)}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-[#a7c5de]">No statistics available.</p>
          )}
        </section>
      ) : null}
    </section>
  );
}
