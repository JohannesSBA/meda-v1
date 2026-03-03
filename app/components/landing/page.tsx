import Link from "next/link";
import { buttonVariants } from "../ui/button";
import { cn } from "../ui/cn";
import Image from "next/image";

export type LandingMatch = {
  eventId: string;
  title: string;
  when: string;
  locationLabel: string;
  priceLabel: string;
  spotsLeft: number | null;
  attendeeCount: number;
};

export type LandingCategory = {
  name: string;
  upcomingCount: number;
};

export type LandingCity = {
  name: string;
  upcomingCount: number;
};

type HeroSectionProps = {
  totalUpcoming: number;
  featuredMatches: LandingMatch[];
  onlineMatches: LandingMatch[];
  topCategories: LandingCategory[];
  topCities: LandingCity[];
};

export default function HeroSection({
  totalUpcoming,
  featuredMatches,
  onlineMatches,
  topCategories,
  topCities,
}: HeroSectionProps) {
  const hasFeaturedMatches = featuredMatches.length > 0;
  const hasOnlineMatches = onlineMatches.length > 0;
  const hasCategories = topCategories.length > 0;
  const hasCities = topCities.length > 0;
  const categoryCount = topCategories.length;
  const cityCount = topCities.length;

  return (
    <div className="space-y-10 pb-12">
      <section className="relative isolate overflow-hidden rounded-3xl border border-(--color-border) bg-[#e8f7f0] px-6 py-12 sm:px-10 lg:px-14">
        <div className="absolute inset-0 -z-20 bg-[radial-gradient(90%_70%_at_50%_-10%,#00E5FF18,transparent_70%),radial-gradient(80%_80%_at_80%_40%,#22FF8820,transparent_60%),linear-gradient(120deg,#f0fdf4,#ffffff_40%,#ecfdf5_100%)]" />
        <div className="absolute -left-10 top-10 h-40 w-40 rounded-full bg-[#00e5ff15] blur-3xl" />
        <div className="absolute -right-6 bottom-10 h-52 w-52 rounded-full bg-[#22ff8818] blur-3xl" />

        <div className="grid items-center gap-8 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="space-y-6">
            <span className="inline-flex rounded-full border border-(--color-border-strong) bg-white/80 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-(--color-brand)">
              Meda Football
            </span>
            <h1 className="text-4xl font-extrabold leading-tight text-[var(--color-text-primary)] sm:text-5xl lg:text-6xl">
              The football community platform where matches become friendships.
            </h1>
            <p className="max-w-2xl text-sm text-[var(--color-text-secondary)] sm:text-base">
              Find local pickup games, join trusted hosts, and split pitch costs
              with confidence across Ethiopia.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link
                href="/events"
                className={cn(
                  buttonVariants("primary", "lg"),
                  "rounded-full px-7",
                )}
              >
                Explore Matches
              </Link>
              <Link
                href="/create-events"
                className={cn(
                  buttonVariants("secondary", "lg"),
                  "rounded-full px-7",
                )}
              >
                Start a Match
              </Link>
            </div>
            <div className="flex flex-wrap gap-2 text-xs text-(--color-text-muted)">
              <span className="rounded-full border border-(--color-border) px-3 py-1">
                Upcoming matches: {totalUpcoming}
              </span>
              <span className="rounded-full border border-(--color-border) px-3 py-1">
                Active categories: {categoryCount}
              </span>
              <span className="rounded-full border border-(--color-border) px-3 py-1">
                Cities live: {cityCount}
              </span>
            </div>
          </div>
          <Image src="/logo.png" alt="Meda" width={350} height={350} />
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex items-end justify-between">
          <h2 className="text-2xl font-bold text-[var(--color-text-primary)]">Matches near you</h2>
          <Link
            href="/events"
            className="text-sm text-(--color-brand) hover:underline"
          >
            See all
          </Link>
        </div>
        {hasFeaturedMatches ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {featuredMatches.map((match) => (
              <article
                key={match.eventId}
                className="glass-card flex flex-col gap-3 p-4 transition hover:-translate-y-1"
              >
                <div className="h-28 rounded-2xl bg-[radial-gradient(circle_at_20%_15%,#00e5ff25,transparent_35%),radial-gradient(circle_at_80%_0%,#22ff8825,transparent_40%),linear-gradient(130deg,#e0f2fe_0%,#f0fdf4_100%)]" />
                <h3 className="text-base font-semibold text-[var(--color-text-primary)]">
                  {match.title}
                </h3>
                <p className="text-xs text-(--color-text-muted)">
                  {match.when} • {match.locationLabel}
                </p>
                <div className="mt-auto flex items-center justify-between">
                  <span className="text-xs text-(--color-brand-alt)">
                    {match.spotsLeft != null
                      ? `${match.spotsLeft} spots left`
                      : `${match.attendeeCount} attendees`}
                  </span>
                  <span className="rounded-full bg-(--color-surface-2) px-3 py-1 text-xs font-semibold text-(--color-brand)">
                    {match.priceLabel}
                  </span>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <article className="glass-card p-5 text-sm text-(--color-text-secondary)">
            No upcoming matches available yet. Check back soon.
          </article>
        )}
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-bold text-[var(--color-text-primary)]">
          Explore top categories
        </h2>
        {hasCategories ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {topCategories.map((category) => (
              <article
                key={category.name}
                className="glass-card flex items-center justify-between p-4 text-sm"
              >
                <span className="font-medium text-[var(--color-text-primary)]">{category.name}</span>
                <span className="text-(--color-brand)">
                  {category.upcomingCount} upcoming
                </span>
              </article>
            ))}
          </div>
        ) : (
          <article className="glass-card p-5 text-sm text-(--color-text-secondary)">
            Categories will appear once events are published.
          </article>
        )}
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-bold text-[var(--color-text-primary)]">
          Popular cities on Meda
        </h2>
        {hasCities ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {topCities.map((city) => (
              <article key={city.name} className="glass-card p-4 text-center">
                <div className="mx-auto mb-3 h-16 w-16 rounded-full bg-[linear-gradient(145deg,#00e5ff33,#22ff8828)]" />
                <p className="text-sm font-semibold text-[var(--color-text-primary)]">{city.name}</p>
                <p className="mt-1 text-xs text-(--color-text-secondary)">
                  {city.upcomingCount} upcoming
                </p>
              </article>
            ))}
          </div>
        ) : (
          <article className="glass-card p-5 text-sm text-(--color-text-secondary)">
            City activity will populate as local events are added.
          </article>
        )}
      </section>

      <section className="glass-card p-6">
        <p className="heading-kicker">How Meda works</p>
        <h2 className="mt-2 text-2xl font-bold text-[var(--color-text-primary)]">
          Real-time platform activity
        </h2>
        <div className="mt-5 grid gap-4 md:grid-cols-3">
          <article className="rounded-2xl border border-(--color-border) bg-(--color-surface-2) p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-(--color-brand)">
              Active matches
            </p>
            <h3 className="mt-2 text-3xl font-bold text-[var(--color-text-primary)]">
              {totalUpcoming}
            </h3>
            <p className="mt-2 text-sm text-(--color-text-secondary)">
              Upcoming matches currently available to join.
            </p>
          </article>
          <article className="rounded-2xl border border-(--color-border) bg-(--color-surface-2) p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-(--color-brand)">
              Categories
            </p>
            <h3 className="mt-2 text-3xl font-bold text-[var(--color-text-primary)]">
              {categoryCount}
            </h3>
            <p className="mt-2 text-sm text-(--color-text-secondary)">
              Event categories with upcoming activity.
            </p>
          </article>
          <article className="rounded-2xl border border-(--color-border) bg-(--color-surface-2) p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-(--color-brand)">
              Cities
            </p>
            <h3 className="mt-2 text-3xl font-bold text-[var(--color-text-primary)]">{cityCount}</h3>
            <p className="mt-2 text-sm text-(--color-text-secondary)">
              Locations with live football events.
            </p>
          </article>
        </div>
      </section>

      <section className="glass-card relative overflow-hidden px-6 py-8 sm:px-10">
        <div className="absolute -right-8 -top-8 h-36 w-36 rounded-full bg-[#00e5ff1f] blur-2xl" />
        <div className="absolute -bottom-10 left-6 h-28 w-28 rounded-full bg-[#22ff881f] blur-2xl" />
        <div className="relative flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="max-w-xl">
            <h2 className="text-2xl font-bold text-[var(--color-text-primary)]">
              Join Meda and find your next game
            </h2>
            <p className="mt-2 text-sm text-(--color-text-secondary)">
              Meet new teammates, discover pitches near you, and keep the
              football momentum going every week.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
