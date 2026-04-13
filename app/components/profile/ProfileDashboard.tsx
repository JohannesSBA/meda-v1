/**
 * ProfileDashboard -- Main profile page orchestrator.
 */

"use client";

import { useMemo } from "react";
import Link from "next/link";
import { cn } from "@/app/components/ui/cn";
import { buttonVariants } from "@/app/components/ui/button";
import { Stack } from "@/app/components/ui/primitives";
import { AppSectionCard } from "@/app/components/ui/app-section-card";
import { InlineStatusBanner } from "@/app/components/ui/inline-status-banner";
import { ResponsiveActionBar } from "@/app/components/ui/responsive-action-bar";
import { useProfileUserData } from "./useProfileUserData";
import { ProfileHeader } from "./ProfileHeader";
import { RegisteredEventsTab } from "./RegisteredEventsTab";
import { SavedEventsTab } from "./SavedEventsTab";
import { PayoutSettingsTab } from "./PayoutSettingsTab";
import { FacilitatorsTab } from "./FacilitatorsTab";
import type { ProfileUser } from "./types";
import { appRoutes } from "@/lib/navigation";
import { HOST_TEAM_PROFILE_HASH } from "@/lib/hostNavigation";

type ProfileDashboardProps = {
  user: ProfileUser;
};

export default function ProfileDashboard({ user }: ProfileDashboardProps) {
  const isPitchOwner = user.role === "pitch_owner";
  const isAdmin = user.role === "admin";
  const userData = useProfileUserData(isAdmin);

  const avatarUrl = useMemo(
    () =>
      user.image ||
      `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name || user.email || "User")}&background=0F2235&color=22FF88&size=160`,
    [user.image, user.name, user.email],
  );

  return (
    <Stack gap="xl">
      <ProfileHeader
        user={user}
        isAdmin={isAdmin}
        balance={userData.balance}
        avatarUrl={avatarUrl}
      />

      <AppSectionCard
        headingKicker="Quick paths"
        title="Use the right page for the job."
        description="Profile now focuses on your account, saved items, and role access. Use Tickets for things you joined, Host for pitch operations, and Admin for platform-wide work."
      >
        <ResponsiveActionBar>
          <Link href={appRoutes.play} className={cn(buttonVariants("secondary", "md"), "rounded-full")}>
            Play
          </Link>
          <Link href={appRoutes.tickets} className={cn(buttonVariants("primary", "md"), "rounded-full")}>
            Tickets
          </Link>
          {isPitchOwner ? (
            <Link href={appRoutes.host} className={cn(buttonVariants("secondary", "md"), "rounded-full")}>
              Host
            </Link>
          ) : null}
          {isAdmin ? (
            <Link href={appRoutes.admin} className={cn(buttonVariants("secondary", "md"), "rounded-full")}>
              Admin
            </Link>
          ) : null}
          <Link
            href={appRoutes.accountSettings}
            className={cn(buttonVariants("ghost", "md"), "rounded-full")}
          >
            Account settings
          </Link>
          <Link
            href="/account/security"
            className={cn(buttonVariants("ghost", "md"), "rounded-full")}
          >
            Security
          </Link>
          {isPitchOwner ? (
            <Link
              href={appRoutes.createMatch}
              className={cn(buttonVariants("ghost", "md"), "rounded-full")}
            >
              Create match
            </Link>
          ) : null}
        </ResponsiveActionBar>
      </AppSectionCard>

      {isAdmin ? (
        <InlineStatusBanner
          title="Platform operations moved to Admin."
          description="Users, event moderation, billing, payouts, promo codes, and stats now live in the Admin workspace so Profile stays focused on your account."
          action={
            <Link href={appRoutes.admin} className={cn(buttonVariants("primary", "sm"), "rounded-full")}>
              Open Admin
            </Link>
          }
        />
      ) : null}

      {!isAdmin ? (
        <>
          <InlineStatusBanner
            title="Tickets and hosting have their own homes now."
            description={
              isPitchOwner
                ? "Use Tickets for things you joined, and Host for places, booking times, people, and money."
                : "Use Tickets for things you joined. Profile keeps your account and saved items easy to find."
            }
            tone="info"
            action={
              <ResponsiveActionBar align="end">
                <Link href={appRoutes.tickets} className={cn(buttonVariants("primary", "sm"), "rounded-full")}>
                  Open Tickets
                </Link>
                {isPitchOwner ? (
                  <Link href={appRoutes.host} className={cn(buttonVariants("secondary", "sm"), "rounded-full")}>
                    Open Host
                  </Link>
                ) : null}
              </ResponsiveActionBar>
            }
          />

          <RegisteredEventsTab
            registeredStatus={userData.registeredStatus}
            setRegisteredStatus={userData.setRegisteredStatus}
            registeredEvents={userData.registeredEvents}
            registeredLoading={userData.registeredLoading}
            registeredError={userData.registeredError}
            savedIds={userData.savedIds}
            copiedEventId={userData.copiedEventId}
            refundingEventId={userData.refundingEventId}
            onShareLink={userData.handleShareLink}
            onToggleSaved={userData.toggleSavedEvent}
            onRefund={userData.handleRefundFromProfile}
            onRetry={userData.loadRegisteredEvents}
          />

          <SavedEventsTab
            savedEvents={userData.savedEvents}
            savedLoading={userData.savedLoading}
            savedError={userData.savedError}
            onToggleSaved={userData.toggleSavedEvent}
            onRetry={userData.loadSavedEvents}
          />

          {isPitchOwner ? <PayoutSettingsTab /> : null}
          {isPitchOwner ? (
            <div id={HOST_TEAM_PROFILE_HASH} className="scroll-mt-24">
              <FacilitatorsTab />
            </div>
          ) : null}
        </>
      ) : null}
    </Stack>
  );
}
