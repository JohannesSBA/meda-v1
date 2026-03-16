/**
 * ProfileDashboard -- Main profile page orchestrator.
 */

"use client";

import { useMemo } from "react";
import { cn } from "@/app/components/ui/cn";
import { Card } from "@/app/components/ui/card";
import { Stack } from "@/app/components/ui/primitives";
import { useProfileData } from "./useProfileData";
import { ProfileHeader } from "./ProfileHeader";
import { RegisteredEventsTab } from "./RegisteredEventsTab";
import { SavedEventsTab } from "./SavedEventsTab";
import { AdminUsersTab } from "./AdminUsersTab";
import { AdminEventsTab } from "./AdminEventsTab";
import { AdminStatsTab } from "./AdminStatsTab";
import { AdminBillingTab } from "./AdminBillingTab";
import { FacilitatorEventsTab } from "./FacilitatorEventsTab";
import { FacilitatorsTab } from "./FacilitatorsTab";
import { PitchOwnerEventsTab } from "./PitchOwnerEventsTab";
import { PayoutSettingsTab } from "./PayoutSettingsTab";
import type { ProfileUser } from "./types";

type ProfileDashboardProps = {
  user: ProfileUser;
};

export default function ProfileDashboard({ user }: ProfileDashboardProps) {
  const data = useProfileData(user);
  const isPitchOwner = user.role === "pitch_owner";
  const isFacilitator = user.role === "facilitator";

  const avatarUrl = useMemo(
    () =>
      user.image ||
      `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name || user.email || "User")}&background=0F2235&color=22FF88&size=160`,
    [user.image, user.name, user.email],
  );

  return (
    <Stack gap="xl">
      <ProfileHeader user={user} isAdmin={data.isAdmin} balance={data.balance} avatarUrl={avatarUrl} />

      {!data.isAdmin ? (
        <>
          {isPitchOwner ? <PitchOwnerEventsTab /> : null}
          {isPitchOwner ? <PayoutSettingsTab /> : null}
          {isPitchOwner ? <FacilitatorsTab /> : null}
          {isFacilitator ? <FacilitatorEventsTab /> : null}

          <Card className="p-2">
            <div role="tablist" aria-label="Profile sections" className="grid grid-cols-2 gap-2">
              {(["registered", "saved"] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  role="tab"
                  aria-selected={data.userTab === tab}
                  aria-controls={`profile-tabpanel-${tab}`}
                  onClick={() => data.setUserTab(tab)}
                  className={cn(
                    "rounded-[var(--radius-md)] px-4 py-3 text-sm font-semibold tracking-[-0.01em] transition",
                    data.userTab === tab
                      ? "bg-[rgba(125,211,252,0.12)] text-[var(--color-text-primary)]"
                      : "text-[var(--color-text-secondary)] hover:bg-white/[0.04] hover:text-[var(--color-text-primary)]",
                  )}
                >
                  {tab === "registered" ? "My tickets" : "Saved events"}
                </button>
              ))}
            </div>
          </Card>

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
          <Card className="p-2">
            <div role="tablist" aria-label="Admin sections" className="grid grid-cols-2 gap-2 lg:grid-cols-4">
              {(["users", "events", "billing", "stats"] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  role="tab"
                  aria-selected={data.adminTab === tab}
                  aria-controls={`admin-tabpanel-${tab}`}
                  onClick={() => data.setAdminTab(tab)}
                  className={cn(
                    "rounded-[var(--radius-md)] px-4 py-3 text-sm font-semibold tracking-[-0.01em] transition",
                    data.adminTab === tab
                      ? "bg-[rgba(125,211,252,0.12)] text-[var(--color-text-primary)]"
                      : "text-[var(--color-text-secondary)] hover:bg-white/[0.04] hover:text-[var(--color-text-primary)]",
                  )}
                >
                  {tab === "users"
                    ? "Users"
                    : tab === "events"
                      ? "Events"
                      : tab === "billing"
                        ? "Billing"
                        : "Stats"}
                </button>
              ))}
            </div>
          </Card>

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
              onPromoteToPitchOwner={data.handlePromoteToPitchOwner}
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

          {data.adminTab === "billing" ? (
            <AdminBillingTab
              fee={data.fee}
              feeLoading={data.feeLoading}
              feeError={data.feeError}
              feeAmountDraft={data.feeAmountDraft}
              setFeeAmountDraft={data.setFeeAmountDraft}
              savingFee={data.savingFee}
              onSaveFee={data.handleSaveEventCreationFee}
              promoCodes={data.promoCodes}
              promoCodesLoading={data.promoCodesLoading}
              promoCodesError={data.promoCodesError}
              promoForm={data.promoForm}
              onPromoFieldChange={data.handlePromoFieldChange}
              creatingPromo={data.creatingPromo}
              onCreatePromo={data.handleCreatePromoCode}
              onTogglePromo={data.handleTogglePromoCode}
              pitchOwners={data.pitchOwners}
              onRetry={data.loadPromoCodes}
            />
          ) : null}
        </>
      )}

      {data.deleteEventDialog}
      {data.applyToSeriesDialog}
    </Stack>
  );
}
