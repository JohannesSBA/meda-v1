import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth/server";
import { normalizeAppUserRole } from "@/lib/auth/roles";
import { getCategories } from "@/lib/data/categories";
import { getCurrentOwnerSubscription } from "@/services/subscriptions";
import { listOwnerPitches } from "@/services/pitches";
import { OwnerOperationsWorkspace } from "@/app/components/owner/OwnerOperationsWorkspace";
import { OwnerDashboardWorkspace } from "@/app/components/owner/OwnerDashboardWorkspace";
import { PageShell } from "@/app/components/ui/page-shell";
import { buttonVariants } from "@/app/components/ui/button";
import { cn } from "@/app/components/ui/cn";
import { Stack } from "@/app/components/ui/primitives";
import { AppPageHeader } from "@/app/components/ui/app-page-header";
import { AppSectionCard } from "@/app/components/ui/app-section-card";
import { InlineStatusBanner } from "@/app/components/ui/inline-status-banner";
import type { Category } from "@/app/types/catagory";
import { appRoutes } from "@/lib/navigation";
import { uiCopy } from "@/lib/uiCopy";

export const dynamic = "force-dynamic";

type HostView =
  | "overview"
  | "calendar"
  | "places"
  | "bookings"
  | "people"
  | "money"
  | "settings";

type HostPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const hostViewOrder: HostView[] = [
  "overview",
  "calendar",
  "places",
  "bookings",
  "people",
  "money",
  "settings",
];

const hostViewCopy: Record<
  HostView,
  {
    label: string;
    title: string;
    description: string;
    dashboardTab?: "overview" | "bookings" | "customers" | "payments" | "subscription";
  }
> = {
  overview: {
    label: "Overview",
    title: "Run your place from one calm home screen.",
    description:
      "Check what needs attention today, then jump straight into your calendar, people, money, or account settings.",
    dashboardTab: "overview",
  },
  calendar: {
    label: "Calendar",
    title: "Add booking times and manage your calendar.",
    description:
      "Use the calendar to open time windows, block time, and see how bookings are filling up.",
  },
  places: {
    label: uiCopy.host.places,
    title: "Set up each place so players can trust what they are booking.",
    description:
      "Name the place, set the map location, choose the category, and make sure the place is ready before you publish times.",
  },
  bookings: {
    label: "Bookings",
    title: "See what has been booked and what still needs action.",
    description:
      "Track paid bookings, group reservations, pending actions, and what has already been checked in.",
    dashboardTab: "bookings",
  },
  people: {
    label: uiCopy.host.people,
    title: "See the people behind your bookings.",
    description:
      "Look up customers, what they joined, what they paid, and which tickets have already been used.",
    dashboardTab: "customers",
  },
  money: {
    label: uiCopy.host.money,
    title: "See your money clearly before you send a payout.",
    description:
      "Review money in, platform fees, refunds, your current Meda balance, and what is ready to withdraw right now.",
    dashboardTab: "payments",
  },
  settings: {
    label: "Settings",
    title: "Manage your host plan and account details.",
    description:
      "Check your host plan, renewal timing, grace period, and the settings that affect your places and payouts.",
    dashboardTab: "subscription",
  },
};

function readHostView(value: string | undefined): HostView {
  return hostViewOrder.includes(value as HostView) ? (value as HostView) : "overview";
}

function hostViewHref(view: HostView) {
  return `${appRoutes.host}?view=${view}`;
}

export default async function HostPage({ searchParams }: HostPageProps) {
  const resolvedSearchParams = await searchParams;
  const requestedView = Array.isArray(resolvedSearchParams.view)
    ? resolvedSearchParams.view[0]
    : resolvedSearchParams.view;
  const view = readHostView(requestedView);

  const { data } = await auth.getSession();
  const rawUser = (data?.user ?? null) as
    | {
        id?: string;
        role?: string | null;
      }
    | null;

  if (!rawUser?.id) {
    redirect("/auth/sign-in?redirect=%2Fhost");
  }

  if (normalizeAppUserRole(rawUser.role) !== "pitch_owner") {
    redirect("/profile");
  }

  const [categories, subscription, pitches] = await Promise.all([
    getCategories() as Promise<Category[]>,
    getCurrentOwnerSubscription(rawUser.id),
    listOwnerPitches(rawUser.id),
  ]);

  const activePitchCount = pitches.filter((pitch) => pitch.isActive).length;
  const totalSlotCount = pitches.reduce((sum, pitch) => sum + pitch.slotCount, 0);
  const mapReadyCount = pitches.filter(
    (pitch) =>
      Boolean(pitch.addressLabel) ||
      (typeof pitch.latitude === "number" && typeof pitch.longitude === "number"),
  ).length;
  const viewCopy = hostViewCopy[view];

  return (
    <PageShell containerClassName="mx-auto max-w-[1380px] px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
      <Stack gap="xl">
        <AppPageHeader
          kicker={uiCopy.nav.host}
          title={viewCopy.title}
          description={viewCopy.description}
          primaryAction={
            <Link
              href={view === "calendar" || view === "places" ? hostViewHref("calendar") : hostViewHref("overview")}
              className={cn(buttonVariants("primary", "md"), "rounded-full")}
            >
              {view === "calendar" || view === "places" ? "Open calendar tools" : "Open overview"}
            </Link>
          }
          secondaryActions={
            <>
              <Link
                href={hostViewHref("money")}
                className={cn(buttonVariants("secondary", "md"), "rounded-full")}
              >
                See money
              </Link>
              <Link
                href={appRoutes.createMatch}
                className={cn(buttonVariants("ghost", "md"), "rounded-full")}
              >
                {uiCopy.nav.createMatch}
              </Link>
            </>
          }
          stats={
            <>
              <StatPill label={uiCopy.host.hostPlan} value={subscription?.entitlementActive ? "On" : "Off"} />
              <StatPill label={uiCopy.host.places} value={String(activePitchCount)} />
              <StatPill label={uiCopy.host.bookingTimes} value={String(totalSlotCount)} />
              <StatPill label="Mapped places" value={`${mapReadyCount}/${pitches.length || 0}`} />
            </>
          }
        />

        {!subscription?.entitlementActive ? (
          <InlineStatusBanner
            title={
              subscription?.gracePeriodActive
                ? `Your host plan is in its 15-day grace period.`
                : "Turn on your host plan before you publish new booking times."
            }
            description={
              subscription?.gracePeriodActive
                ? `You still have ${subscription.graceDaysRemaining} day${
                    subscription.graceDaysRemaining === 1 ? "" : "s"
                  } left before publishing access stops.`
                : "You can still set up places and review your data, but new booking times stay locked until the plan is active again."
            }
            tone={subscription?.gracePeriodActive ? "warning" : "info"}
            action={
              <Link
                href={hostViewHref("settings")}
                className={cn(buttonVariants("primary", "sm"), "rounded-full")}
              >
                Manage host plan
              </Link>
            }
          />
        ) : null}

        <AppSectionCard
          density="compact"
          headingKicker="Host sections"
          title="Use one section at a time."
          description="This keeps the page lighter on phones and makes it easier to focus on the task you are doing right now."
        >
          <div
            role="tablist"
            aria-label="Host sections"
            className="inline-flex w-full flex-wrap gap-2 rounded-[24px] border border-[rgba(125,211,252,0.14)] bg-[rgba(255,255,255,0.04)] p-2"
          >
            {hostViewOrder.map((entry) => (
              <Link
                key={entry}
                href={hostViewHref(entry)}
                role="tab"
                aria-selected={view === entry}
                className={cn(
                  "min-h-11 rounded-full px-4 py-2 text-sm font-semibold transition",
                  view === entry
                    ? "bg-[var(--color-accent-soft)] text-[var(--color-text-primary)]"
                    : "text-[var(--color-text-secondary)] hover:bg-[var(--color-control-bg-hover)] hover:text-[var(--color-text-primary)]",
                )}
              >
                {hostViewCopy[entry].label}
              </Link>
            ))}
          </div>
        </AppSectionCard>

        {view === "overview" ? (
          <>
            <AppSectionCard
              headingKicker="Today"
              title="What deserves your attention first"
              description="Start with the task that unlocks the rest of the day."
            >
              <div className="grid gap-3 lg:grid-cols-3">
                <TaskCard
                  title="Keep places easy to find"
                  body="Make sure every active place has a saved address or map pin so players can judge distance before they pay."
                  meta={`${mapReadyCount} of ${pitches.length || 0} place${pitches.length === 1 ? "" : "s"} mapped`}
                  href={hostViewHref("places")}
                  cta="Open places"
                />
                <TaskCard
                  title="Keep your calendar full"
                  body="Add more booking times, block unavailable hours, and check what still looks empty."
                  meta={`${totalSlotCount} booking time${totalSlotCount === 1 ? "" : "s"} saved`}
                  href={hostViewHref("calendar")}
                  cta="Open calendar"
                />
                <TaskCard
                  title="Review money before payout"
                  body="Your payout depends on your current Meda balance, not just what you earned in total."
                  meta="Check money, fees, refunds, and ready-to-withdraw"
                  href={hostViewHref("money")}
                  cta="Open money"
                />
              </div>
            </AppSectionCard>

            <OwnerDashboardWorkspace initialTab="overview" />
          </>
        ) : null}

        {(view === "calendar" || view === "places") ? (
          <>
            <AppSectionCard
              headingKicker={view === "calendar" ? "Calendar" : uiCopy.host.places}
              title={view === "calendar" ? "Add booking times without leaving this page." : "Set up places before you publish times."}
              description={
                view === "calendar"
                  ? "Create or edit 2-hour booking times, block time, and inspect bookings directly from the host calendar."
                  : "Start with the place name, description, map location, and category. Then use the same screen to publish booking times."
              }
              actions={
                <Link
                  href={appRoutes.createMatch}
                  className={cn(buttonVariants("ghost", "sm"), "rounded-full")}
                >
                  Create a match instead
                </Link>
              }
            >
              <div className="grid gap-3 md:grid-cols-3">
                <MiniMetric
                  label="Open places"
                  value={String(activePitchCount)}
                  detail="Places currently ready to accept bookings"
                />
                <MiniMetric
                  label="Booking times"
                  value={String(totalSlotCount)}
                  detail="Saved 2-hour times across all places"
                />
                <MiniMetric
                  label="Mapped places"
                  value={`${mapReadyCount}/${pitches.length || 0}`}
                  detail="Places with a saved address or pin"
                />
              </div>
            </AppSectionCard>

            <OwnerOperationsWorkspace
              categories={categories}
              initialSubscription={subscription}
              initialPitches={pitches}
            />
          </>
        ) : null}

        {view !== "overview" && view !== "calendar" && view !== "places" ? (
          <>
            <AppSectionCard
              headingKicker={hostViewCopy[view].label}
              title={view === "money" ? "Money and payouts" : hostViewCopy[view].label}
              description={hostViewCopy[view].description}
            >
              <div className="grid gap-3 md:grid-cols-3">
                <MiniMetric
                  label={uiCopy.host.places}
                  value={String(activePitchCount)}
                  detail="Active places connected to these reports"
                />
                <MiniMetric
                  label={uiCopy.host.bookingTimes}
                  value={String(totalSlotCount)}
                  detail="Booking times feeding this view"
                />
                <MiniMetric
                  label={uiCopy.host.hostPlan}
                  value={
                    subscription?.gracePeriodActive
                      ? `${subscription.graceDaysRemaining}d left`
                      : subscription?.daysRemaining != null
                        ? `${subscription.daysRemaining}d left`
                        : "Set up"
                  }
                  detail={
                    subscription?.gracePeriodActive
                      ? "Grace period after missed renewal"
                      : subscription?.entitlementActive
                        ? "Plan is active"
                        : "Publishing is locked"
                  }
                />
              </div>
            </AppSectionCard>

            <OwnerDashboardWorkspace initialTab={viewCopy.dashboardTab} />
          </>
        ) : null}
      </Stack>
    </PageShell>
  );
}

function StatPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-full border border-[rgba(125,211,252,0.18)] bg-[rgba(255,255,255,0.04)] px-4 py-2 text-sm text-[var(--color-text-secondary)]">
      <span className="font-semibold text-[var(--color-text-primary)]">{value}</span> {label}
    </div>
  );
}

function MiniMetric({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="rounded-[20px] border border-[var(--color-border)] bg-[var(--color-control-bg)] p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--color-text-muted)]">
        {label}
      </p>
      <p className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-[var(--color-text-primary)]">
        {value}
      </p>
      <p className="mt-2 text-sm leading-6 text-[var(--color-text-secondary)]">{detail}</p>
    </div>
  );
}

function TaskCard({
  title,
  body,
  meta,
  href,
  cta,
}: {
  title: string;
  body: string;
  meta: string;
  href: string;
  cta: string;
}) {
  return (
    <div className="rounded-[22px] border border-[var(--color-border)] bg-[var(--color-control-bg)] p-4">
      <div className="space-y-2">
        <p className="text-base font-semibold text-[var(--color-text-primary)]">{title}</p>
        <p className="text-sm leading-6 text-[var(--color-text-secondary)]">{body}</p>
        <p className="text-xs leading-6 text-[var(--color-text-muted)]">{meta}</p>
      </div>
      <Link
        href={href}
        className={cn(buttonVariants("secondary", "sm"), "mt-4 rounded-full")}
      >
        {cta}
      </Link>
    </div>
  );
}
