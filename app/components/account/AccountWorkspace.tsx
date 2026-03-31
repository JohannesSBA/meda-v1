"use client";

import Link from "next/link";
import Image from "next/image";
import {
  AccountSettingsCards,
  SecuritySettingsCards,
  accountViewPaths,
  useAuthData,
} from "@neondatabase/auth/react";
import { Badge } from "@/app/components/ui/badge";
import { buttonVariants } from "@/app/components/ui/button";
import { Card } from "@/app/components/ui/card";
import { cn } from "@/app/components/ui/cn";
import { Cluster, PageIntro, ResponsiveGrid, Stack } from "@/app/components/ui/primitives";
import { authClient } from "@/lib/auth/client";
import type { AppUserRole } from "@/lib/auth/roles";
import type { AccountWorkspaceOverview } from "@/services/accountOverview";

type AccountSection = "settings" | "security";

type AccountWorkspaceProps = {
  section: AccountSection;
  overview: AccountWorkspaceOverview;
};

type LinkedAccount = {
  providerId?: string | null;
};

type DeviceSession = {
  id?: string | null;
  expiresAt?: string | Date | null;
  ipAddress?: string | null;
  userAgent?: string | null;
};

type ChecklistItem = {
  label: string;
  description: string;
  complete: boolean | null;
};

const providerLabels: Record<string, string> = {
  credential: "Password",
  google: "Google",
  passkey: "Passkey",
  github: "GitHub",
  apple: "Apple",
  microsoft: "Microsoft",
};

export function AccountWorkspace({ section, overview }: AccountWorkspaceProps) {
  const { data: sessionData } = authClient.useSession();
  const { data: rawAccounts, isPending: accountsPending } = useAuthData({
    queryFn: authClient.listAccounts,
    cacheKey: "account-workspace:list-accounts",
  });
  const { data: rawSessions, isPending: sessionsPending } = useAuthData({
    queryFn: authClient.listSessions,
    cacheKey: "account-workspace:list-sessions",
  });

  const liveUser = (sessionData?.user ?? null) as
    | {
        name?: string | null;
        email?: string | null;
        image?: string | null;
        emailVerified?: boolean | null;
      }
    | null;
  const liveSession = (sessionData?.session ?? null) as DeviceSession | null;
  const accounts = Array.isArray(rawAccounts) ? (rawAccounts as LinkedAccount[]) : [];
  const sessions = Array.isArray(rawSessions) ? (rawSessions as DeviceSession[]) : [];

  const mergedUser = {
    ...overview.user,
    name: liveUser?.name ?? overview.user.name,
    email: liveUser?.email ?? overview.user.email,
    image: liveUser?.image ?? overview.user.image,
  };

  const displayName = mergedUser.name?.trim() || getNameFromEmail(mergedUser.email) || "Meda member";
  const emailVerified =
    typeof liveUser?.emailVerified === "boolean" ? liveUser.emailVerified : null;
  const providerIds = Array.from(
    new Set(
      accounts
        .map((account) => account.providerId)
        .filter((providerId): providerId is string => Boolean(providerId)),
    ),
  );
  const providerNames = providerIds.map(formatProviderLabel);
  const currentSession =
    sessions.find((session) => session.id && session.id === liveSession?.id) ??
    liveSession ??
    sessions[0] ??
    null;
  const sessionCount = sessions.length;
  const activityLabel = getActivityLabel(overview.user.role);
  const readinessItems =
    section === "settings"
      ? getSettingsChecklist({
          hasAvatar: Boolean(mergedUser.image),
          hasName: Boolean(mergedUser.name?.trim()),
          emailVerified,
          providerCount: providerNames.length,
        })
      : getSecurityChecklist({
          emailVerified,
          providerCount: providerNames.length,
          sessionCount,
          hasKnownCurrentSession: currentSession ? true : sessionsPending ? null : false,
        });
  const readinessPercent = getChecklistPercent(readinessItems);

  return (
    <Stack gap="xl">
      <Card className="relative overflow-hidden p-6 sm:p-8">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(125,211,252,0.16),transparent_34%),radial-gradient(circle_at_88%_10%,rgba(52,211,153,0.14),transparent_28%)]" />

        <div className="relative space-y-6">
          <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
            <PageIntro
              kicker="Account center"
              title={section === "settings" ? "Shape how your Meda identity shows up." : "Tighten the parts of your account that matter most."}
              description={
                section === "settings"
                  ? "Update the details people recognize on tickets, host rosters, and profile surfaces without hunting through a generic auth screen."
                  : "Review sign-in methods, sessions, and recovery controls with the same account context you use to buy, share, host, and scan events."
              }
              meta={
                <>
                  <Badge variant="accent">{formatRoleLabel(overview.user.role)}</Badge>
                  <Badge variant={emailVerified ? "success" : "default"}>
                    {emailVerified ? "Email verified" : "Email verification pending"}
                  </Badge>
                  <Badge variant="default">
                    {providerNames.length > 0
                      ? `${providerNames.length} sign-in method${providerNames.length === 1 ? "" : "s"}`
                      : "Checking sign-in methods"}
                  </Badge>
                </>
              }
            />

            <div className="flex flex-wrap gap-2">
              <AccountSectionLink
                href={`/account/${accountViewPaths.SETTINGS}`}
                active={section === "settings"}
                label="Settings"
              />
              <AccountSectionLink
                href={`/account/${accountViewPaths.SECURITY}`}
                active={section === "security"}
                label="Security"
              />
              <Link href="/profile" className={cn(buttonVariants("ghost", "md"), "rounded-full px-5")}>
                Profile
              </Link>
            </div>
          </div>

          <ResponsiveGrid cols="four" gap="sm">
            <MetricCard
              label="Wallet balance"
              value={`ETB ${overview.stats.balanceEtb.toFixed(2)}`}
              tone="accent"
            />
            <MetricCard
              label="Held tickets"
              value={String(overview.stats.upcomingHeldTickets)}
              detail="Upcoming events where you currently have entry."
            />
            <MetricCard
              label="Shared access"
              value={String(overview.stats.upcomingSharedTickets)}
              detail="Tickets you paid for but transferred to someone else."
            />
            <MetricCard
              label={activityLabel}
              value={String(overview.stats.upcomingManagedEvents)}
              detail={getActivityDetail(overview.user.role)}
            />
          </ResponsiveGrid>
        </div>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
        <Stack gap="lg" className="xl:sticky xl:top-[calc(var(--header-height)+2rem)] xl:self-start">
          <ProfileIdentityCard
            displayName={displayName}
            email={mergedUser.email}
            imageUrl={mergedUser.image}
            role={overview.user.role}
            emailVerified={emailVerified}
          />

          <ReadinessCard
            title={section === "settings" ? "Account readiness" : "Security baseline"}
            description={
              section === "settings"
                ? "The basics that make your account recognizable and reliable across tickets, hosting, and support."
                : "The basics that protect access, payouts, attendee actions, and recovery."
            }
            percent={readinessPercent}
            items={readinessItems}
          />

          <ShortcutCard role={overview.user.role} section={section} />
        </Stack>

        <Stack gap="lg">
          {section === "settings" ? (
            <SettingsWorkspace
              role={overview.user.role}
              recommendation={getSettingsRecommendation({
                role: overview.user.role,
                hasAvatar: Boolean(mergedUser.image),
                emailVerified,
              })}
            />
          ) : (
            <SecurityWorkspace
              role={overview.user.role}
              providerNames={providerNames}
              accountsPending={accountsPending}
              sessionsPending={sessionsPending}
              currentSession={currentSession}
              sessionCount={sessionCount}
              recommendation={getSecurityRecommendation({
                role: overview.user.role,
                emailVerified,
                providerCount: providerNames.length,
                sessionCount,
              })}
            />
          )}
        </Stack>
      </div>
    </Stack>
  );
}

function SettingsWorkspace({
  role,
  recommendation,
}: {
  role: AppUserRole;
  recommendation: string;
}) {
  return (
    <>
      <Card className="space-y-4 p-6 sm:p-7">
        <div className="space-y-2">
          <p className="heading-kicker">Why this matters</p>
          <h2 className="section-title">Your Meda profile is operational, not cosmetic.</h2>
          <p className="body-copy">
            {recommendation}
          </p>
        </div>
      </Card>

      <section className="space-y-4">
        <div className="space-y-2">
          <p className="heading-kicker">Editable fields</p>
          <h2 className="section-title">Personal details and linked account details</h2>
          <p className="body-copy">
            These controls come from Neon Auth, but they now sit inside a Meda-specific workspace
            so you can update them with the right product context around them.
          </p>
        </div>

        <AccountSettingsCards />
      </section>

      <ResponsiveGrid cols="three" gap="md">
        <InfoCard
          kicker="Visibility"
          title="What hosts and players see"
          body="Hosts see your name and attendance status for their event. Shared-ticket recipients rely on your ticket record staying accurate, so keep this profile recognizable."
        />
        <InfoCard
          kicker="Role impact"
          title={role === "pitch_owner" ? "Host identity matters more here" : "Your profile travels with your ticket activity"}
          body={getSettingsRoleImpact(role)}
        />
        <InfoCard
          kicker="Support"
          title="Keep recovery-friendly details"
          body="If support has to help with a refund, a transfer issue, or a payout question, current name and email details reduce manual verification and back-and-forth."
          actions={
            <>
              <Link href="/help" className={cn(buttonVariants("secondary", "sm"), "rounded-full")}>
                Help center
              </Link>
              <Link href="/privacy" className={cn(buttonVariants("ghost", "sm"), "rounded-full")}>
                Privacy
              </Link>
            </>
          }
        />
      </ResponsiveGrid>
    </>
  );
}

function SecurityWorkspace({
  role,
  providerNames,
  accountsPending,
  sessionsPending,
  currentSession,
  sessionCount,
  recommendation,
}: {
  role: AppUserRole;
  providerNames: string[];
  accountsPending: boolean;
  sessionsPending: boolean;
  currentSession: DeviceSession | null;
  sessionCount: number;
  recommendation: string;
}) {
  return (
    <>
      <Card className="space-y-5 p-6 sm:p-7">
        <div className="space-y-2">
          <p className="heading-kicker">Live security signal</p>
          <h2 className="section-title">Current session snapshot</h2>
          <p className="body-copy">{recommendation}</p>
        </div>

        <ResponsiveGrid cols="two" gap="sm">
          <SessionStat
            label="This device"
            value={summarizeUserAgent(currentSession?.userAgent)}
          />
          <SessionStat
            label="IP address"
            value={currentSession?.ipAddress?.trim() || "Unavailable"}
          />
          <SessionStat
            label="Session expires"
            value={formatDateTime(currentSession?.expiresAt)}
          />
          <SessionStat
            label="Open sessions"
            value={sessionsPending ? "Checking..." : String(sessionCount)}
          />
        </ResponsiveGrid>

        <div className="space-y-2">
          <p className="text-sm font-semibold text-[var(--color-text-primary)]">Sign-in methods</p>
          <Cluster gap="sm">
            {accountsPending ? (
              <Badge variant="default">Checking providers...</Badge>
            ) : providerNames.length > 0 ? (
              providerNames.map((provider) => (
                <Badge key={provider} variant="accent">
                  {provider}
                </Badge>
              ))
            ) : (
              <Badge variant="default">No linked providers reported yet</Badge>
            )}
          </Cluster>
        </div>
      </Card>

      <section className="space-y-4">
        <div className="space-y-2">
          <p className="heading-kicker">Controls</p>
          <h2 className="section-title">Password, providers, sessions, recovery</h2>
          <p className="body-copy">
            Meda depends on these controls for ticket ownership, refunds, scanning access, and
            hosted event operations. The auth layer stays unchanged; the surrounding guidance is now
            specific to how the product actually works.
          </p>
        </div>

        <SecuritySettingsCards />
      </section>

      <ResponsiveGrid cols="two" gap="md">
        <InfoCard
          kicker="Risk surface"
          title="What this account can do"
          body={getSecurityRoleImpact(role)}
        />
        <InfoCard
          kicker="Policy"
          title="When to review sessions immediately"
          body="Do it after signing in on a borrowed laptop, after traveling, after changing your password, or anytime a payment or ticket action happened from a device you do not recognize."
          actions={
            <>
              <Link href="/help" className={cn(buttonVariants("secondary", "sm"), "rounded-full")}>
                Help center
              </Link>
              <Link href="/terms" className={cn(buttonVariants("ghost", "sm"), "rounded-full")}>
                Terms
              </Link>
            </>
          }
        />
      </ResponsiveGrid>
    </>
  );
}

function ProfileIdentityCard({
  displayName,
  email,
  imageUrl,
  role,
  emailVerified,
}: {
  displayName: string;
  email: string | null;
  imageUrl: string | null;
  role: AppUserRole;
  emailVerified: boolean | null;
}) {
  return (
    <Card className="space-y-5 p-6">
      <div className="flex items-start gap-4">
        <Avatar imageUrl={imageUrl} displayName={displayName} />
        <div className="min-w-0 space-y-2">
          <div className="space-y-1">
            <p className="text-lg font-semibold tracking-[-0.03em] text-[var(--color-text-primary)]">
              {displayName}
            </p>
            <p className="truncate text-sm text-[var(--color-text-secondary)]">{email || "No email on file"}</p>
          </div>
          <Cluster gap="sm">
            <Badge variant="accent">{formatRoleLabel(role)}</Badge>
            <Badge variant={emailVerified ? "success" : "default"}>
              {emailVerified ? "Verified" : "Verification pending"}
            </Badge>
          </Cluster>
        </div>
      </div>

      <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-control-bg)] p-4">
        <p className="text-sm font-semibold text-[var(--color-text-primary)]">Meda-specific note</p>
        <p className="mt-2 text-sm leading-7 text-[var(--color-text-secondary)]">
          {getIdentityNote(role)}
        </p>
      </div>
    </Card>
  );
}

function ReadinessCard({
  title,
  description,
  percent,
  items,
}: {
  title: string;
  description: string;
  percent: number;
  items: ChecklistItem[];
}) {
  return (
    <Card className="space-y-5 p-6">
      <div className="space-y-2">
        <p className="text-sm font-semibold text-[var(--color-text-primary)]">{title}</p>
        <p className="text-sm leading-7 text-[var(--color-text-secondary)]">{description}</p>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-text-muted)]">
          <span>Coverage</span>
          <span>{percent}%</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-white/6">
          <div
            className="h-full rounded-full bg-[linear-gradient(90deg,var(--color-brand),var(--color-brand-alt))]"
            style={{ width: `${percent}%` }}
          />
        </div>
      </div>

      <div className="space-y-3">
        {items.map((item) => (
          <div
            key={item.label}
            className="flex gap-3 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-control-bg)] p-3"
          >
            <StatusDot complete={item.complete} />
            <div className="min-w-0">
              <p className="text-sm font-semibold text-[var(--color-text-primary)]">{item.label}</p>
              <p className="mt-1 text-sm leading-6 text-[var(--color-text-secondary)]">
                {item.description}
              </p>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

function ShortcutCard({
  role,
  section,
}: {
  role: AppUserRole;
  section: AccountSection;
}) {
  const shortcuts = [
    { href: "/tickets", label: "Tickets", tone: "secondary" as const },
    { href: "/play", label: "Play", tone: "ghost" as const },
    { href: section === "settings" ? "/account/security" : "/account/settings", label: section === "settings" ? "Open security" : "Open settings", tone: "ghost" as const },
    ...(role === "admin" || role === "pitch_owner"
      ? [{ href: "/create-events", label: "Create match", tone: "secondary" as const }]
      : []),
    ...(role === "pitch_owner"
      ? [{ href: "/host", label: "Host", tone: "secondary" as const }]
      : []),
    { href: "/profile", label: "Profile", tone: "secondary" as const },
  ];

  return (
    <Card className="space-y-4 p-6">
      <div className="space-y-2">
        <p className="text-sm font-semibold text-[var(--color-text-primary)]">Quick links</p>
        <p className="text-sm leading-7 text-[var(--color-text-secondary)]">
          Jump to the parts of Meda this account touches most often.
        </p>
      </div>

      <div className="grid gap-2">
        {shortcuts.map((shortcut) => (
          <Link
            key={`${shortcut.href}:${shortcut.label}`}
            href={shortcut.href}
            className={cn(
              buttonVariants(shortcut.tone, "sm"),
              "justify-between rounded-full px-4",
            )}
          >
            <span>{shortcut.label}</span>
            <ArrowRightIcon className="h-4 w-4" />
          </Link>
        ))}
      </div>
    </Card>
  );
}

function InfoCard({
  kicker,
  title,
  body,
  actions,
}: {
  kicker: string;
  title: string;
  body: string;
  actions?: React.ReactNode;
}) {
  return (
    <Card className="space-y-4 p-5 sm:p-6">
      <div className="space-y-2">
        <p className="heading-kicker">{kicker}</p>
        <h3 className="text-lg font-semibold tracking-[-0.03em] text-[var(--color-text-primary)]">
          {title}
        </h3>
        <p className="text-sm leading-7 text-[var(--color-text-secondary)]">{body}</p>
      </div>

      {actions ? <Cluster gap="sm">{actions}</Cluster> : null}
    </Card>
  );
}

function MetricCard({
  label,
  value,
  detail,
  tone = "default",
}: {
  label: string;
  value: string;
  detail?: string;
  tone?: "default" | "accent";
}) {
  return (
    <div
      className={cn(
        "rounded-[var(--radius-md)] border p-4 sm:p-5",
        tone === "accent"
          ? "border-[rgba(125,211,252,0.28)] bg-[rgba(125,211,252,0.11)]"
          : "border-[var(--color-border)] bg-[var(--color-control-bg)]",
      )}
    >
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-text-muted)]">
        {label}
      </p>
      <p className="mt-3 text-2xl font-semibold tracking-[-0.04em] text-[var(--color-text-primary)]">
        {value}
      </p>
      {detail ? (
        <p className="mt-2 text-sm leading-6 text-[var(--color-text-secondary)]">{detail}</p>
      ) : null}
    </div>
  );
}

function SessionStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-control-bg)] p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-text-muted)]">
        {label}
      </p>
      <p className="mt-2 text-sm font-semibold text-[var(--color-text-primary)]">{value}</p>
    </div>
  );
}

function AccountSectionLink({
  href,
  active,
  label,
}: {
  href: string;
  active: boolean;
  label: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        buttonVariants(active ? "primary" : "secondary", "md"),
        "rounded-full px-5",
      )}
      aria-current={active ? "page" : undefined}
    >
      {label}
    </Link>
  );
}

function Avatar({
  imageUrl,
  displayName,
}: {
  imageUrl: string | null;
  displayName: string;
}) {
  if (imageUrl) {
    return (
      <Image
        src={imageUrl}
        alt={`${displayName} avatar`}
        width={72}
        height={72}
        className="h-[72px] w-[72px] rounded-[22px] border border-[var(--color-border-strong)] object-cover"
      />
    );
  }

  return (
    <div className="flex h-[72px] w-[72px] items-center justify-center rounded-[22px] border border-[var(--color-border-strong)] bg-[radial-gradient(circle_at_30%_30%,rgba(125,211,252,0.24),transparent_48%),linear-gradient(135deg,#102033,#0b1724)] text-xl font-semibold text-[var(--color-text-primary)]">
      {getInitials(displayName)}
    </div>
  );
}

function StatusDot({ complete }: { complete: boolean | null }) {
  if (complete === null) {
    return (
      <span className="mt-1 inline-flex h-5 w-5 shrink-0 rounded-full border border-[var(--color-border-strong)] bg-[var(--color-control-bg)]" />
    );
  }

  return complete ? (
    <span className="mt-1 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[rgba(52,211,153,0.18)] text-[var(--color-brand-alt)]">
      <CheckIcon className="h-3.5 w-3.5" />
    </span>
  ) : (
    <span className="mt-1 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[rgba(251,113,133,0.16)] text-[var(--color-danger)]">
      <MinusIcon className="h-3.5 w-3.5" />
    </span>
  );
}

function getChecklistPercent(items: ChecklistItem[]) {
  if (items.length === 0) return 0;
  const completed = items.filter((item) => item.complete === true).length;
  return Math.round((completed / items.length) * 100);
}

function getSettingsChecklist({
  hasAvatar,
  hasName,
  emailVerified,
  providerCount,
}: {
  hasAvatar: boolean;
  hasName: boolean;
  emailVerified: boolean | null;
  providerCount: number;
}): ChecklistItem[] {
  return [
    {
      label: "Recognizable profile",
      description: hasAvatar
        ? "Your avatar is already helping hosts and ticket recipients recognize you."
        : "Add a profile photo so hosts and shared-ticket recipients can identify you faster.",
      complete: hasAvatar,
    },
    {
      label: "Stable display name",
      description: hasName
        ? "You have a display name set for tickets, rosters, and support references."
        : "Set a display name so your tickets are not anchored only to an email address.",
      complete: hasName,
    },
    {
      label: "Verified recovery email",
      description:
        emailVerified === true
          ? "Your email is verified, which keeps account recovery and change confirmations dependable."
          : "Verify your email so purchase confirmations and recovery steps reach the right inbox.",
      complete: emailVerified,
    },
    {
      label: "Backup sign-in path",
      description:
        providerCount > 1
          ? "You already have more than one sign-in path linked."
          : "Consider adding another provider before you actually need recovery.",
      complete: providerCount > 1,
    },
  ];
}

function getSecurityChecklist({
  emailVerified,
  providerCount,
  sessionCount,
  hasKnownCurrentSession,
}: {
  emailVerified: boolean | null;
  providerCount: number;
  sessionCount: number;
  hasKnownCurrentSession: boolean | null;
}): ChecklistItem[] {
  return [
    {
      label: "Verified email",
      description:
        emailVerified === true
          ? "Recovery email is verified."
          : "Start here. It is the cleanest recovery path when something goes wrong.",
      complete: emailVerified,
    },
    {
      label: "Multiple sign-in methods",
      description:
        providerCount > 1
          ? "You have a second way back into the account if one method fails."
          : "Link at least one more sign-in method or passkey if available.",
      complete: providerCount > 1,
    },
    {
      label: "Current device visible",
      description:
        hasKnownCurrentSession === true
          ? "You can see the session you are using right now."
          : "Session visibility is still loading or this device is not clearly identifiable yet.",
      complete: hasKnownCurrentSession,
    },
    {
      label: "Reasonable session footprint",
      description:
        sessionCount <= 2
          ? "Only a small number of sessions are active."
          : "Review older devices and revoke the ones you do not need anymore.",
      complete: sessionCount <= 2,
    },
  ];
}

function getSettingsRecommendation({
  role,
  hasAvatar,
  emailVerified,
}: {
  role: AppUserRole;
  hasAvatar: boolean;
  emailVerified: boolean | null;
}) {
  if (!hasAvatar) {
    return "Start with a photo. It reduces friction at check-in, makes ticket transfers less confusing, and gives hosts a better roster signal than a bare email address.";
  }

  if (emailVerified !== true) {
    return "Verify your email next. That is the channel Meda depends on for recovery, change confirmation, and the most common support escalations.";
  }

  if (role === "pitch_owner") {
    return "Because this account represents a host operation, keep the identity details here aligned with the person attendees and support expect to deal with.";
  }

  return "Your profile basics are in good shape. Use this page whenever your identity, inbox, or sign-in setup changes so ticket operations stay clean everywhere else.";
}

function getSecurityRecommendation({
  role,
  emailVerified,
  providerCount,
  sessionCount,
}: {
  role: AppUserRole;
  emailVerified: boolean | null;
  providerCount: number;
  sessionCount: number;
}) {
  if (emailVerified !== true) {
    return "Verify your email first. That is the recovery path Meda will trust when ticket ownership, payment access, or host actions need to be confirmed.";
  }

  if (sessionCount > 2) {
    return "You have several active sessions. Review them before making other security changes so stale devices do not remain signed in.";
  }

  if (providerCount < 2) {
    return "Add another sign-in method if you can. A second recovery path is worth more than cosmetic hardening when you actually lose access.";
  }

  if (role === "pitch_owner" || role === "admin") {
    return "This account touches higher-impact operations than a standard player account. Keep sessions tight and use passkeys or two-factor when available.";
  }

  return "The basics are in place. Use the controls below after travel, device changes, or anything unusual around purchases, transfers, or event access.";
}

function getActivityLabel(role: AppUserRole) {
  if (role === "pitch_owner") return "Hosted events";
  if (role === "facilitator") return "Managed events";
  if (role === "admin") return "Created events";
  return "Created events";
}

function getActivityDetail(role: AppUserRole) {
  if (role === "pitch_owner") return "Upcoming matches published from this account.";
  if (role === "facilitator") return "Upcoming events under the host you are attached to.";
  if (role === "admin") return "Events authored from this account identity.";
  return "Useful if you later become a host or facilitator.";
}

function getSettingsRoleImpact(role: AppUserRole) {
  if (role === "pitch_owner") {
    return "Attendees, facilitators, payout workflows, and support threads all hinge on this account being current. Treat it like operational infrastructure, not a disposable profile.";
  }

  if (role === "facilitator") {
    return "Hosts rely on this account to grant scan access and coordinate live event operations. Clean identity details reduce ambiguity during check-in and support follow-up.";
  }

  if (role === "admin") {
    return "This account can affect users, events, and billing across the platform. Keep the identity details here unmistakably yours.";
  }

  return "Your name and avatar follow your tickets, refunds, and shared-access flows. Small profile changes have real downstream effects.";
}

function getSecurityRoleImpact(role: AppUserRole) {
  if (role === "pitch_owner") {
    return "A compromised pitch-owner account can impact attendee rosters, live check-in workflows, refunds, event creation, and payout-related operations. It deserves stronger discipline than a casual social login.";
  }

  if (role === "facilitator") {
    return "A compromised facilitator account can still affect gate operations and attendee verification, so old sessions and weak recovery paths are not low-stakes here.";
  }

  if (role === "admin") {
    return "This is platform-wide access. Every extra stale session or weak recovery path compounds across users, events, billing, and moderation.";
  }

  return "Even a standard player account can buy, transfer, refund, and reclaim access. Good recovery paths are worth setting up before you need them.";
}

function getIdentityNote(role: AppUserRole) {
  if (role === "pitch_owner") {
    return "Hosts and facilitators depend on this identity staying current because it anchors event ownership, payout setup, and support verification.";
  }

  if (role === "facilitator") {
    return "This identity is used when scanning attendees and coordinating with the host you work under.";
  }

  if (role === "admin") {
    return "This identity is attached to high-impact admin actions across Meda.";
  }

  return "This identity appears in the flows that matter most: ticket ownership, refunds, and hosted-event attendance.";
}

function formatRoleLabel(role: AppUserRole) {
  if (role === "pitch_owner") return "Pitch owner";
  if (role === "facilitator") return "Facilitator";
  if (role === "admin") return "Admin";
  return "Community member";
}

function formatProviderLabel(providerId: string) {
  return providerLabels[providerId] ?? capitalize(providerId.replace(/[-_]/g, " "));
}

function summarizeUserAgent(userAgent?: string | null) {
  if (!userAgent) return "Unknown device";

  const platform = /iPhone|iPad|iOS/i.test(userAgent)
    ? "iPhone or iPad"
    : /Android/i.test(userAgent)
      ? "Android"
      : /Mac OS X|Macintosh/i.test(userAgent)
        ? "Mac"
        : /Windows/i.test(userAgent)
          ? "Windows"
          : /Linux/i.test(userAgent)
            ? "Linux"
            : "Unknown OS";

  const browser = /Edg/i.test(userAgent)
    ? "Edge"
    : /Chrome/i.test(userAgent)
      ? "Chrome"
      : /Safari/i.test(userAgent) && !/Chrome/i.test(userAgent)
        ? "Safari"
        : /Firefox/i.test(userAgent)
          ? "Firefox"
          : "Browser";

  return `${browser} on ${platform}`;
}

function formatDateTime(value?: string | Date | null) {
  if (!value) return "Unavailable";

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "Unavailable";

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function getInitials(value: string) {
  const words = value.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "M";
  return words
    .slice(0, 2)
    .map((word) => word.charAt(0).toUpperCase())
    .join("");
}

function getNameFromEmail(email: string | null) {
  if (!email) return "";
  const local = email.split("@")[0] ?? "";
  return capitalize(local.replace(/[._-]+/g, " "));
}

function capitalize(value: string) {
  return value.replace(/\b\w/g, (char) => char.toUpperCase());
}

function ArrowRightIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M5 12h14" />
      <path d="m12 5 7 7-7 7" />
    </svg>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

function MinusIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M5 12h14" />
    </svg>
  );
}
