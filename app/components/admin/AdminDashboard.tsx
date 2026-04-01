"use client";

import { useState } from "react";
import Link from "next/link";
import { cn } from "@/app/components/ui/cn";
import { buttonVariants } from "@/app/components/ui/button";
import { AppPageHeader } from "@/app/components/ui/app-page-header";
import { AppSectionCard } from "@/app/components/ui/app-section-card";
import { InlineStatusBanner } from "@/app/components/ui/inline-status-banner";
import { AdminUsersTab } from "@/app/components/profile/AdminUsersTab";
import { AdminEventsTab } from "@/app/components/profile/AdminEventsTab";
import { AdminStatsTab } from "@/app/components/profile/AdminStatsTab";
import { AdminBillingTab } from "@/app/components/profile/AdminBillingTab";
import { useProfileAdminData } from "@/app/components/profile/useProfileAdminData";
import type { AdminTab, ProfileUser } from "@/app/components/profile/types";
import { appRoutes } from "@/lib/navigation";

type AdminDashboardProps = {
  user: ProfileUser;
};

const adminTabLabels: Record<AdminTab, string> = {
  users: "Users",
  events: "Events",
  billing: "Billing",
  stats: "Stats",
};

export default function AdminDashboard({ user }: AdminDashboardProps) {
  const [adminTab, setAdminTab] = useState<AdminTab>("events");
  const data = useProfileAdminData(true, adminTab);

  return (
    <div className="space-y-6">
      <AppPageHeader
        kicker="Admin"
        title="Run platform operations from one dedicated workspace."
        description="Profile is now personal. Admin keeps user management, event moderation, billing, promo codes, payouts, and platform stats in one place."
        primaryAction={
          <Link
            href={appRoutes.profile}
            className={cn(buttonVariants("secondary", "md"), "rounded-full")}
          >
            Open profile
          </Link>
        }
        secondaryActions={
          <Link
            href={appRoutes.play}
            className={cn(buttonVariants("ghost", "md"), "rounded-full")}
          >
            Open app
          </Link>
        }
        stats={
          <>
            <span className="rounded-full border border-[rgba(125,211,252,0.18)] bg-[rgba(255,255,255,0.04)] px-4 py-2 text-sm text-[var(--color-text-secondary)]">
              Signed in as <span className="font-semibold text-[var(--color-text-primary)]">{user.name}</span>
            </span>
            <span className="rounded-full border border-[rgba(125,211,252,0.18)] bg-[rgba(255,255,255,0.04)] px-4 py-2 text-sm text-[var(--color-text-secondary)]">
              {user.email}
            </span>
          </>
        }
      />

      <InlineStatusBanner
        title="Admin work is now separated from Profile."
        description="Use Admin for platform-wide operations. Use Profile for account settings and personal shortcuts."
        action={
          <Link href={appRoutes.profile} className={cn(buttonVariants("secondary", "sm"), "rounded-full")}>
            Back to Profile
          </Link>
        }
      />

      <AppSectionCard
        headingKicker="Sections"
        title="Choose the part of the platform you want to manage."
        density="compact"
      >
        <div role="tablist" aria-label="Admin sections" className="grid grid-cols-2 gap-2 lg:grid-cols-4">
          {(["users", "events", "billing", "stats"] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              role="tab"
              aria-selected={adminTab === tab}
              aria-controls={`admin-tabpanel-${tab}`}
              onClick={() => setAdminTab(tab)}
              className={cn(
                "rounded-[var(--radius-md)] px-4 py-3 text-sm font-semibold tracking-[-0.01em] transition",
                adminTab === tab
                  ? "bg-[rgba(125,211,252,0.12)] text-[var(--color-text-primary)]"
                  : "text-[var(--color-text-secondary)] hover:bg-white/[0.04] hover:text-[var(--color-text-primary)]",
              )}
            >
              {adminTabLabels[tab]}
            </button>
          ))}
        </div>
      </AppSectionCard>

      {adminTab === "users" ? (
        <AdminUsersTab
          adminUsers={data.adminUsers}
          adminUsersLoading={data.adminUsersLoading}
          adminUsersError={data.adminUsersError}
          userSearch={data.userSearch}
          setUserSearch={data.setUserSearch}
          onSearch={data.loadAdminUsers}
          onSetRole={data.handleSetRole}
          onPromotePitchOwner={data.handlePromotePitchOwner}
          onBanToggle={data.handleBanToggle}
          onRetry={data.loadAdminUsers}
        />
      ) : null}

      {adminTab === "events" ? (
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

      {adminTab === "stats" ? (
        <AdminStatsTab
          stats={data.stats}
          statsLoading={data.statsLoading}
          statsError={data.statsError}
          onRetry={data.loadStats}
        />
      ) : null}

      {adminTab === "billing" ? (
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
          payoutOwners={data.payoutOwners}
          payoutsLoading={data.payoutsLoading}
          payoutsError={data.payoutsError}
          ticketSurchargeEtb={data.ticketSurchargeEtb}
          commissionPercent={data.commissionPercent}
          payoutDraftByOwner={data.payoutDraftByOwner}
          payingOutOwnerId={data.payingOutOwnerId}
          onPayoutDraftChange={data.handlePayoutDraftChange}
          onCreatePayout={data.handleCreatePayout}
          pitchOwners={data.pitchOwners}
          onRetry={data.loadBillingData}
        />
      ) : null}

      {data.deleteEventDialog}
      {data.applyToSeriesDialog}
    </div>
  );
}
