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
  topCategories,
  topCities,
}: HeroSectionProps) {
  const hasFeaturedMatches = featuredMatches.length > 0;
  const hasCategories = topCategories.length > 0;
  const hasCities = topCities.length > 0;
  const categoryCount = topCategories.length;
  const cityCount = topCities.length;

  return (
    <div className="space-y-8 pb-4 sm:space-y-10 sm:pb-12">
      {/* Hero */}
      <section className="relative isolate overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[#081627] px-5 py-8 sm:rounded-3xl sm:px-10 sm:py-12 lg:px-14">
        <div className="absolute inset-0 -z-20 bg-[radial-gradient(90%_70%_at_50%_-10%,#00E5FF22,transparent_70%),radial-gradient(80%_80%_at_80%_40%,#22FF8830,transparent_60%),linear-gradient(120deg,#071321,#0B1C2D_40%,#071321_100%)]" />
        <div className="absolute -left-10 top-10 h-40 w-40 rounded-full bg-[#00e5ff1a] blur-3xl" />
        <div className="absolute -right-6 bottom-10 h-52 w-52 rounded-full bg-[#22ff8820] blur-3xl" />

        <div className="grid items-center gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="space-y-4 sm:space-y-6">
            <span className="inline-flex rounded-full border border-[var(--color-border-strong)] bg-white/5 px-3.5 py-1.5 text-xs font-semibold uppercase tracking-widest text-[var(--color-brand)] sm:text-sm">
              Meda Football
            </span>
            <h1 className="text-2xl font-extrabold leading-tight text-white sm:text-4xl lg:text-6xl">
              The football community platform where matches become friendships.
            </h1>
            <p className="max-w-2xl text-sm leading-relaxed text-[var(--color-text-secondary)] sm:text-base">
              Find local pickup games, join trusted hosts, and split pitch costs
              with confidence across Ethiopia.
            </p>
            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <Link
                href="/events"
                className={cn(
                  buttonVariants("primary", "lg"),
                  "w-full justify-center rounded-full px-7 py-3.5 text-center sm:w-auto",
                )}
              >
                Explore Matches
              </Link>
              <Link
                href="/create-events"
                className={cn(
                  buttonVariants("secondary", "lg"),
                  "w-full justify-center rounded-full px-7 py-3.5 text-center sm:w-auto",
                )}
              >
                Start a Match
              </Link>
            </div>
            <div className="flex flex-wrap gap-2 text-sm text-[var(--color-text-muted)]">
              <span className="rounded-full border border-[var(--color-border)] px-3 py-1.5">
                {totalUpcoming} upcoming
              </span>
              <span className="rounded-full border border-[var(--color-border)] px-3 py-1.5">
                {categoryCount} categories
              </span>
              <span className="rounded-full border border-[var(--color-border)] px-3 py-1.5">
                {cityCount} cities
              </span>
            </div>
          </div>
          <Image
            src="/logo.png"
            alt="Meda"
            width={350}
            height={350}
            className="mx-auto h-28 w-28 sm:h-48 sm:w-48 lg:h-[280px] lg:w-[280px]"
          />
        </div>
      </section>

      {/* Featured matches */}
      <section className="space-y-4">
        <div className="flex items-end justify-between gap-4">
          <h2 className="text-xl font-bold text-white sm:text-2xl">
            Matches near you
          </h2>
          <Link
            href="/events"
            className="shrink-0 text-sm font-medium text-[var(--color-brand)] active:opacity-80"
          >
            See all
          </Link>
        </div>
        {hasFeaturedMatches ? (
          <div className="grid gap-3 sm:gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {featuredMatches.map((match) => (
              <Link
                key={match.eventId}
                href={`/events/${match.eventId}`}
                className="glass-card flex flex-col gap-3 p-4 transition will-change-transform active:scale-[0.98] sm:hover:-translate-y-1"
              >
                <div className="aspect-[3/2] rounded-xl bg-[radial-gradient(circle_at_20%_15%,#00e5ff2b,transparent_35%),radial-gradient(circle_at_80%_0%,#22ff8833,transparent_40%),linear-gradient(130deg,#0e2438_0%,#0b1d2e_100%)]" />
                <h3 className="line-clamp-2 text-base font-semibold text-white">
                  {match.title}
                </h3>
                <p className="text-sm text-[var(--color-text-muted)]">
                  {match.when} · {match.locationLabel}
                </p>
                <div className="mt-auto flex items-center justify-between">
                  <span className="text-sm text-[var(--color-brand-alt)]">
                    {match.spotsLeft != null
                      ? `${match.spotsLeft} spots left`
                      : `${match.attendeeCount} attendees`}
                  </span>
                  <span className="rounded-full bg-[var(--color-surface-2)] px-3 py-1 text-sm font-semibold text-[var(--color-brand)]">
                    {match.priceLabel}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <article className="glass-card p-5 text-sm text-[var(--color-text-secondary)]">
            No upcoming matches available yet. Check back soon.
          </article>
        )}
      </section>

      {/* Categories */}
      <section className="space-y-4">
        <h2 className="text-xl font-bold text-white sm:text-2xl">
          Explore top categories
        </h2>
        {hasCategories ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {topCategories.map((category) => (
              <Link
                key={category.name}
                href={`/events?search=${encodeURIComponent(category.name)}`}
                className="glass-card flex items-center justify-between p-4 text-sm transition will-change-transform active:scale-[0.98] sm:hover:-translate-y-0.5"
              >
                <span className="font-medium text-white">{category.name}</span>
                <span className="text-[var(--color-brand)]">
                  {category.upcomingCount} upcoming
                </span>
              </Link>
            ))}
          </div>
        ) : (
          <article className="glass-card p-5 text-sm text-[var(--color-text-secondary)]">
            Categories will appear once events are published.
          </article>
        )}
      </section>

      {/* Cities */}
      <section className="space-y-4">
        <h2 className="text-xl font-bold text-white sm:text-2xl">
          Popular cities on Meda
        </h2>
        {hasCities ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {topCities.map((city) => (
              <Link
                key={city.name}
                href={`/events?search=${encodeURIComponent(city.name)}`}
                className="glass-card p-4 text-center transition will-change-transform active:scale-[0.98] sm:hover:-translate-y-0.5"
              >
                <div className="mx-auto mb-3 h-14 w-14 rounded-full bg-[linear-gradient(145deg,#00e5ff33,#22ff8828)]" />
                <p className="text-sm font-semibold text-white">{city.name}</p>
                <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
                  {city.upcomingCount} upcoming
                </p>
              </Link>
            ))}
          </div>
        ) : (
          <article className="glass-card p-5 text-sm text-[var(--color-text-secondary)]">
            City activity will populate as local events are added.
          </article>
        )}
      </section>

      {/* Platform stats */}
      <section className="glass-card p-5 sm:p-6">
        <p className="heading-kicker">How Meda works</p>
        <h2 className="mt-2 text-xl font-bold text-white sm:text-2xl">
          Real-time platform activity
        </h2>
        <div className="mt-5 grid gap-3 sm:gap-4 sm:grid-cols-3">
          <article className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-2)] p-4">
            <p className="text-sm font-semibold uppercase tracking-widest text-[var(--color-brand)]">
              Active matches
            </p>
            <h3 className="mt-2 text-2xl font-bold text-white sm:text-3xl">
              {totalUpcoming}
            </h3>
            <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
              Upcoming matches currently available to join.
            </p>
          </article>
          <article className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-2)] p-4">
            <p className="text-sm font-semibold uppercase tracking-widest text-[var(--color-brand)]">
              Categories
            </p>
            <h3 className="mt-2 text-2xl font-bold text-white sm:text-3xl">
              {categoryCount}
            </h3>
            <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
              Event categories with upcoming activity.
            </p>
          </article>
          <article className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-2)] p-4">
            <p className="text-sm font-semibold uppercase tracking-widest text-[var(--color-brand)]">
              Cities
            </p>
            <h3 className="mt-2 text-2xl font-bold text-white sm:text-3xl">{cityCount}</h3>
            <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
              Locations with live football events.
            </p>
          </article>
        </div>
      </section>

      {/* CTA */}
      <section className="glass-card relative overflow-hidden px-5 py-8 sm:px-10">
        <div className="absolute -right-8 -top-8 h-36 w-36 rounded-full bg-[#00e5ff1f] blur-2xl" />
        <div className="absolute -bottom-10 left-6 h-28 w-28 rounded-full bg-[#22ff881f] blur-2xl" />
        <div className="relative flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="max-w-xl">
            <h2 className="text-xl font-bold text-white sm:text-2xl">
              Join Meda and find your next game
            </h2>
            <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
              Meet new teammates, discover pitches near you, and keep the
              football momentum going every week.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
