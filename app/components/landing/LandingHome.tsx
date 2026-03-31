/**
 * Landing page component -- hero section with featured events, categories, and city matches.
 */

import Link from "next/link";
import Image from "next/image";
import { buttonVariants } from "../ui/button";
import { Card } from "../ui/card";
import { cn } from "../ui/cn";
import {
  Cluster,
  PageIntro,
  ResponsiveGrid,
  Section,
  Stack,
  SurfacePanel,
} from "../ui/primitives";

export type LandingMatch = {
  eventId: string;
  title: string;
  when: string;
  locationLabel: string;
  priceLabel: string;
  spotsLeft: number | null;
  attendeeCount: number;
  pictureUrl?: string | null;
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
  topCategories: LandingCategory[];
  topCities: LandingCity[];
};

export default function HeroSection({
  totalUpcoming,
  featuredMatches,
  topCategories,
  topCities,
}: HeroSectionProps) {
  const featuredEvents = featuredMatches.slice(0, 6);

  return (
    <Stack gap="xl" className="pb-4 sm:pb-6">
      <Section size="md" className="pb-0">
        <SurfacePanel className="relative overflow-hidden p-5 sm:p-6 lg:p-8">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(125,211,252,0.18),transparent_35%),radial-gradient(circle_at_92%_18%,rgba(52,211,153,0.12),transparent_24%)]" />
          <div className="pointer-events-none absolute -right-10 top-8 h-48 w-48 rounded-full bg-[rgba(125,211,252,0.12)] blur-3xl" />
          <div className="pointer-events-none absolute -bottom-20 left-10 h-52 w-52 rounded-full bg-[rgba(52,211,153,0.12)] blur-3xl" />

          <div className="relative space-y-8">
            <PageIntro
              kicker="Meda football"
              title={<>Build your week around better pickup football.</>}
              description="Join reliable hosts, split pitch costs transparently, and fill lineups faster with a calmer event experience built for Ethiopia."
              actions={
                <>
                  <Link href="/play" className={cn(buttonVariants("primary", "lg"), "rounded-full px-6")}>Play</Link>
                  <Link href="/host" className={cn(buttonVariants("secondary", "lg"), "rounded-full px-6")}>Host</Link>
                </>
              }
              meta={
                <>
                  <StatPill label="Upcoming" value={`${totalUpcoming}`} />
                  <StatPill label="Categories" value={`${topCategories.length}`} />
                  <StatPill label="Cities" value={`${topCities.length}`} />
                </>
              }
            />

            <div>
              <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <h2 className="section-title">Upcoming matches</h2>
                <Link href="/play?mode=events" className="text-sm font-semibold text-(--color-brand) transition hover:text-(--color-text-primary)">
                  See all matches
                </Link>
              </div>
              {featuredEvents.length > 0 ? (
                <ResponsiveGrid cols="three" gap="md">
                  {featuredEvents.map((match) => (
                    <FeatureMatchCard key={match.eventId} match={match} />
                  ))}
                </ResponsiveGrid>
              ) : (
                <Card className="p-6 text-center">
                  <p className="text-sm text-(--color-text-secondary)">No upcoming matches yet. Check back soon or create one.</p>
                  <Link href="/host" className="mt-3 inline-block text-sm font-semibold text-(--color-brand)">Open Host</Link>
                </Card>
              )}
            </div>
          </div>
        </SurfacePanel>
      </Section>

      <Section size="md" className="pt-0">
        <SurfacePanel>
          <div className="grid gap-6 xl:grid-cols-2">
            <div>
              <p className="heading-kicker">Browse by category</p>
              <h2 className="section-title mt-1">What kind of football?</h2>
              {topCategories.length > 0 ? (
                <div className="mt-4 flex flex-wrap gap-2">
                  {topCategories.map((category) => (
                    <Link
                      key={category.name}
                      href={`/play?mode=events&search=${encodeURIComponent(category.name)}`}
                      className="rounded-full border border-(--color-border-strong) bg-(--color-control-bg) px-4 py-2 text-sm font-medium text-(--color-text-secondary) transition hover:border-[rgba(125,211,252,0.3)] hover:text-(--color-text-primary)"
                    >
                      {category.name} ({category.upcomingCount})
                    </Link>
                  ))}
                </div>
              ) : (
                <p className="mt-4 text-sm text-(--color-text-secondary)">Categories will appear as hosts publish events.</p>
              )}
            </div>
            <div>
              <p className="heading-kicker">Cities</p>
              <h2 className="section-title mt-1">Where the action is</h2>
              {topCities.length > 0 ? (
                <div className="mt-4 flex flex-wrap gap-2">
                  {topCities.map((city) => (
                    <Link
                      key={city.name}
                      href={`/play?mode=events&search=${encodeURIComponent(city.name)}`}
                      className="rounded-full border border-(--color-border-strong) bg-(--color-control-bg) px-4 py-2 text-sm font-medium text-(--color-text-secondary) transition hover:border-[rgba(125,211,252,0.3)] hover:text-(--color-text-primary)"
                    >
                      {city.name} ({city.upcomingCount})
                    </Link>
                  ))}
                </div>
              ) : (
                <p className="mt-4 text-sm text-(--color-text-secondary)">Cities will appear as local hosts publish.</p>
              )}
            </div>
          </div>
        </SurfacePanel>
      </Section>

      <Section size="sm" className="pt-0">
        <SurfacePanel className="overflow-hidden">
          <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
            <div className="space-y-4">
              <p className="heading-kicker">Start with one match</p>
              <h2 className="section-title text-balance">Join Meda and make the next run easier to organize.</h2>
              <p className="body-copy max-w-2xl">
                Find teammates, discover better pitches, and stop chasing payments through scattered chats.
              </p>
            </div>
            <Cluster gap="sm" className="lg:justify-end">
              <Link href="/play" className={cn(buttonVariants("primary", "lg"), "rounded-full px-6")}>Play</Link>
              <Link href="/host" className={cn(buttonVariants("secondary", "lg"), "rounded-full px-6")}>Host</Link>
            </Cluster>
          </div>
        </SurfacePanel>
      </Section>
    </Stack>
  );
}

function StatPill({ label, value }: { label: string; value: string }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-(--color-border-strong) bg-white/6 px-3 py-1.5 text-sm text-(--color-text-secondary)">
      <span className="text-(--color-text-secondary)">{label}</span>
      <span className="font-semibold text-(--color-text-primary)">{value}</span>
    </span>
  );
}

function FeatureMatchCard({ match }: { match: LandingMatch }) {
  return (
    <Link href={`/events/${match.eventId}`} className="group h-full">
      <Card className="flex h-full flex-col overflow-hidden transition hover:-translate-y-0.5">
        <div className="relative aspect-16/10 overflow-hidden">
          {match.pictureUrl ? (
            <Image src={match.pictureUrl} alt={match.title} fill className="object-cover transition duration-500 group-hover:scale-105" sizes="(max-width: 768px) 100vw, (max-width: 1280px) 50vw, 33vw" />
          ) : (
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_18%,rgba(125,211,252,0.22),transparent_30%),radial-gradient(circle_at_100%_0%,rgba(52,211,153,0.18),transparent_26%),linear-gradient(135deg,#102033,#0b1724)]" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-[rgba(6,17,27,0.84)] via-[rgba(6,17,27,0.22)] to-transparent" />
          <div className="absolute inset-x-3 bottom-3 flex items-center justify-between gap-3">
            <span className="rounded-full border border-(--color-border-strong) bg-[rgba(7,17,26,0.78)] px-2.5 py-1 text-[0.72rem] font-semibold uppercase tracking-[0.16em] text-(--color-text-primary) backdrop-blur">
              Upcoming
            </span>
            <span className="rounded-full border border-[rgba(125,211,252,0.22)] bg-[rgba(125,211,252,0.16)] px-3 py-1 text-xs font-semibold text-(--color-text-primary) backdrop-blur">
              {match.priceLabel}
            </span>
          </div>
        </div>
        <div className="flex flex-1 flex-col gap-3 p-4 sm:p-5">
          <div className="space-y-2">
            <h3 className="line-clamp-2 text-xl font-semibold tracking-[-0.03em] text-(--color-text-primary)">
              {match.title}
            </h3>
            <p className="text-sm text-(--color-text-secondary)">{match.when}</p>
            <p className="line-clamp-1 text-sm text-(--color-text-muted)">{match.locationLabel}</p>
          </div>

          <div className="mt-auto flex items-center justify-between pt-3 text-sm">
            <span className="font-medium text-[#c9ffea]">
              {match.spotsLeft != null ? `${match.spotsLeft} spots left` : `${match.attendeeCount} attending`}
            </span>
            <span className="text-(--color-text-muted) transition group-hover:text-(--color-text-primary)">View match</span>
          </div>
        </div>
      </Card>
    </Link>
  );
}
