/**
 * ProfileDashboard -- Main profile page orchestrator.
 *
 * Renders profile header and tabbed content: My Tickets / Saved Events for users,
 * or Users / Events / Stats for admins.
 */

"use client";

import { useMemo } from "react";
import { cn } from "@/app/components/ui/cn";
import { useProfileData } from "./useProfileData";
import { ProfileHeader } from "./ProfileHeader";
import { RegisteredEventsTab } from "./RegisteredEventsTab";
import { SavedEventsTab } from "./SavedEventsTab";
import { AdminUsersTab } from "./AdminUsersTab";
import { AdminEventsTab } from "./AdminEventsTab";
import { AdminStatsTab } from "./AdminStatsTab";
import type { ProfileUser } from "./types";

type ProfileDashboardProps = {
  user: ProfileUser;
};

export default function ProfileDashboard({ user }: ProfileDashboardProps) {
  const data = useProfileData(user);

  const avatarUrl = useMemo(
    () =>
      user.image ||
      `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name || user.email || "User")}&background=0F2235&color=22FF88&size=160`,
    [user.image, user.name, user.email],
  );

  return (
    <section className="space-y-6">
      <ProfileHeader
        user={user}
        isAdmin={data.isAdmin}
        balance={data.balance}
        avatarUrl={avatarUrl}
      />

      {!data.isAdmin ? (
        <>
          <div
            role="tablist"
            aria-label="Profile sections"
            className="flex rounded-xl border border-white/10 bg-[#0c1d2e]/75 p-1"
          >
            {(["registered", "saved"] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                role="tab"
                aria-selected={data.userTab === tab}
                aria-controls={`profile-tabpanel-${tab}`}
                onClick={() => data.setUserTab(tab)}
                className={cn(
                  "flex-1 rounded-lg py-3 text-sm font-semibold transition",
                  data.userTab === tab
                    ? "bg-[var(--color-brand)] text-[var(--color-brand-text)]"
                    : "text-[var(--color-text-secondary)] active:bg-white/5",
                )}
              >
                {tab === "registered" ? "My Tickets" : "Saved Events"}
              </button>
            ))}
          </div>

          {data.userTab === "registered" ? (
            <RegisteredEventsTab
              registeredStatus={data.registeredStatus}
              setRegisteredStatus={data.setRegisteredStatus}
              registeredEvents={data.registeredEvents}
              registeredLoading={data.registeredLoading}
              registeredError={data.registeredError}
              savedIds={data.savedIds}
              copiedEventId={data.copiedEventId}
              refundingEventId={data.refundingEventId}
              onShareLink={data.handleShareLink}
              onToggleSaved={data.toggleSavedEvent}
              onRefund={data.handleRefundFromProfile}
              onRetry={data.loadRegisteredEvents}
            />
          ) : (
            <SavedEventsTab
              savedEvents={data.savedEvents}
              savedLoading={data.savedLoading}
              savedError={data.savedError}
              onToggleSaved={data.toggleSavedEvent}
              onRetry={data.loadSavedEvents}
            />
          )}
        </>
      ) : (
        <>
          <div
            role="tablist"
            aria-label="Admin sections"
            className="flex rounded-xl border border-white/10 bg-[#0c1d2e]/75 p-1"
          >
            {(["users", "events", "stats"] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                role="tab"
                aria-selected={data.adminTab === tab}
                aria-controls={`admin-tabpanel-${tab}`}
                onClick={() => data.setAdminTab(tab)}
                className={cn(
                  "flex-1 rounded-lg py-3 text-sm font-semibold transition",
                  data.adminTab === tab
                    ? "bg-[var(--color-brand)] text-[var(--color-brand-text)]"
                    : "text-[var(--color-text-secondary)] active:bg-white/5",
                )}
              >
                {tab === "users" ? "Users" : tab === "events" ? "Events" : "Stats"}
              </button>
            ))}
          </div>

          {data.adminTab === "users" ? (
            <AdminUsersTab
              adminUsers={data.adminUsers}
              adminUsersLoading={data.adminUsersLoading}
              adminUsersError={data.adminUsersError}
              userSearch={data.userSearch}
              setUserSearch={data.setUserSearch}
              onSearch={data.loadAdminUsers}
              onSetRole={data.handleSetRole}
              onBanToggle={data.handleBanToggle}
              onRetry={data.loadAdminUsers}
            />
          ) : null}

          {data.adminTab === "events" ? (
            <AdminEventsTab
              adminEvents={data.adminEvents}
              adminEventsLoading={data.adminEventsLoading}
              adminEventsError={data.adminEventsError}
              eventSearch={data.eventSearch}
              setEventSearch={data.setEventSearch}
              onSearch={data.loadAdminEvents}
              adminUserNameById={data.adminUserNameById}
              onEdit={data.startEditEvent}
              onDelete={data.handleDeleteEvent}
              editingEvent={data.editingEvent}
              setEditingEvent={data.setEditingEvent}
              categories={data.categories}
              applyToSeries={data.applyToSeries}
              setApplyToSeries={data.setApplyToSeries}
              seriesCount={data.seriesCount}
              savingEvent={data.savingEvent}
              onSaveChanges={data.handleSaveEventChanges}
              onRetry={data.loadAdminEvents}
            />
          ) : null}

          {data.adminTab === "stats" ? (
            <AdminStatsTab
              stats={data.stats}
              statsLoading={data.statsLoading}
              statsError={data.statsError}
              onRetry={data.loadStats}
            />
          ) : null}
        </>
      )}

      {data.deleteEventDialog}
      {data.applyToSeriesDialog}
    </section>
  );
}
