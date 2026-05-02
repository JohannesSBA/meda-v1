/**
 * Landing page — hero, featured slots, featured matches, category/city browse.
 */

import type { ReactNode } from "react";
import Link from "next/link";
import Image from "next/image";
import { buttonVariants } from "../ui/button";
import { Card } from "../ui/card";
import { cn } from "../ui/cn";
import { Cluster, ResponsiveGrid, Section, Stack } from "../ui/primitives";
import {
  getOfferLeadSlotId,
  getOfferNextAvailableLabel,
  getOfferPerPersonPriceLabel,
  getOfferPriceLabel,
  type SlotOffer,
} from "@/lib/slots/offerGrouping";

export type LandingSlotOffer = Pick<
  SlotOffer,
  | "key"
  | "pitchId"
  | "pitchName"
  | "pitchImageUrl"
  | "addressLabel"
  | "categoryName"
  | "productType"
  | "capacity"
  | "price"
  | "currency"
  | "requiresParty"
> & {
  slots: Array<Pick<SlotOffer["slots"][number], "id" | "startsAt" | "endsAt" | "remainingCapacity">>;
};

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
  openSlotCount: number;
  featuredSlotOffers: LandingSlotOffer[];
  featuredMatches: LandingMatch[];
  topCategories: LandingCategory[];
  topCities: LandingCity[];
};

export default function HeroSection({
  totalUpcoming,
  openSlotCount,
  featuredSlotOffers,
  featuredMatches,
  topCategories,
  topCities,
}: HeroSectionProps) {
  const featuredEvents = featuredMatches.slice(0, 4);

  return (
    <Stack gap="xl" className="pb-6 sm:pb-8">
      {/* ── Main hero card ──────────────────────────── */}
      <Section size="md" className="pb-0">
        <div className="surface-card relative overflow-hidden">
          {/* Background atmosphere */}
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_60%_50%_at_8%_0%,rgba(74,222,128,0.14),transparent),radial-gradient(ellipse_40%_40%_at_92%_8%,rgba(56,189,248,0.09),transparent),radial-gradient(ellipse_35%_45%_at_50%_100%,rgba(74,222,128,0.05),transparent)]" />

          {/* Subtle pitch-lines watermark */}
          <FieldWatermark className="pointer-events-none absolute right-0 top-0 h-full w-[46%] opacity-[0.055] text-[var(--color-brand)]" />

          <div className="relative px-5 pb-8 pt-7 sm:px-7 sm:pb-10 sm:pt-9 lg:px-10 lg:pb-12 lg:pt-11">
            {/* Kicker + stat pills */}
            <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
              <p className="heading-kicker">Meda football</p>
              <div className="flex flex-wrap items-center gap-2">
                <StatPill
                  label="Open slots"
                  value={openSlotCount > 0 ? String(openSlotCount) : "—"}
                />
                <StatPill
                  label="Matches"
                  value={totalUpcoming > 0 ? String(totalUpcoming) : "—"}
                />
                <StatPill
                  label="Cities"
                  value={topCities.length > 0 ? String(topCities.length) : "—"}
                />
              </div>
            </div>

            {/* Headline */}
            <div className="max-w-3xl">
              <h1 className="text-balance font-black tracking-[-0.06em] text-[var(--color-text-primary)] leading-[0.9] text-[clamp(2.8rem,7.5vw,5.5rem)]">
                Better pickup{" "}
                <span className="gradient-text">football.</span>
              </h1>
              <p className="mt-5 max-w-xl text-[clamp(0.95rem,1.5vw,1.08rem)] leading-[1.72] text-[var(--color-text-secondary)]">
                Reserve pitch slots when you already have a squad, or browse organized matches
                when you want to join a hosted game. Transparent ETB pricing, real-time availability.
              </p>
            </div>

            {/* CTAs */}
            <Cluster gap="sm" className="mt-7">
              <Link
                href="/play?mode=slots"
                className={cn(buttonVariants("primary", "lg"), "rounded-full px-7")}
              >
                Book a slot
              </Link>
              <Link
                href="/play?mode=events"
                className={cn(buttonVariants("secondary", "lg"), "rounded-full px-7")}
              >
                Find a match
              </Link>
              <Link
                href="/host"
                className={cn(buttonVariants("ghost", "lg"), "rounded-full px-7")}
              >
                Host a pitch
              </Link>
            </Cluster>

            {/* ── Pitch Slots ──────────────────────────── */}
            <div className="mt-10 lg:mt-12">
              <div className="soft-divider mb-8" />

              <div className="flex items-end justify-between gap-4 mb-5">
                <div>
                  <p className="heading-kicker mb-1">Pitch bookings</p>
                  <h2 className="section-title text-balance">Got a full group? Pick a pitch.</h2>
                </div>
                <Link
                  href="/play?mode=slots"
                  className="shrink-0 flex items-center gap-1 text-sm font-semibold text-[var(--color-brand)] hover:text-[var(--color-text-primary)] transition"
                >
                  See all
                  <ChevronRightIcon className="h-4 w-4" />
                </Link>
              </div>

              {featuredSlotOffers.length > 0 ? (
                <ResponsiveGrid cols="three" gap="md">
                  {featuredSlotOffers.map((offer) => (
                    <FeatureSlotCard key={offer.key} offer={offer} />
                  ))}
                </ResponsiveGrid>
              ) : (
                <EmptySlotsVisual />
              )}
            </div>

            {/* ── One-off Matches ──────────────────────── */}
            <div className="mt-10 lg:mt-12">
              <div className="soft-divider mb-8" />

              <div className="flex items-end justify-between gap-4 mb-5">
                <div>
                  <p className="heading-kicker text-[var(--color-brand-alt)] mb-1">One-off matches</p>
                  <h3 className="section-title">Discover an organized match</h3>
                </div>
                <Link
                  href="/play?mode=events"
                  className="shrink-0 flex items-center gap-1 text-sm font-semibold text-[var(--color-text-secondary)] hover:text-[var(--color-brand)] transition"
                >
                  See all
                  <ChevronRightIcon className="h-4 w-4" />
                </Link>
              </div>

              {featuredEvents.length > 0 ? (
                <ResponsiveGrid cols="two" gap="md">
                  {featuredEvents.map((match) => (
                    <FeatureMatchCard key={match.eventId} match={match} />
                  ))}
                </ResponsiveGrid>
              ) : (
                <EmptyMatchesVisual />
              )}
            </div>
          </div>
        </div>
      </Section>

      {/* ── Browse by category & city ────────────────── */}
      <Section size="sm" className="pt-0">
        <div className="surface-card overflow-hidden">
          <div className="grid gap-0 lg:grid-cols-2">
            {/* Categories */}
            <div className="p-5 sm:p-7 lg:p-8">
              <p className="heading-kicker mb-1">Browse by category</p>
              <h2 className="section-title mb-4">What kind of game?</h2>
              {topCategories.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {topCategories.map((category) => (
                    <Link
                      key={category.name}
                      href={`/play?mode=events&search=${encodeURIComponent(category.name)}`}
                      className="group inline-flex items-center gap-1.5 rounded-full border border-[var(--color-border-strong)] bg-[var(--color-control-bg)] px-4 py-2 text-sm font-medium text-[var(--color-text-secondary)] transition hover:border-[rgba(74,222,128,0.4)] hover:bg-[rgba(74,222,128,0.08)] hover:text-[var(--color-text-primary)]"
                    >
                      {category.name}
                      <span className="rounded-full bg-[var(--color-control-bg-hover)] px-1.5 py-0.5 text-[0.65rem] font-bold text-[var(--color-text-muted)] group-hover:text-[var(--color-brand)]">
                        {category.upcomingCount}
                      </span>
                    </Link>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-[var(--color-text-muted)]">
                  Categories will appear as hosts publish events.
                </p>
              )}
            </div>

            {/* Cities */}
            <div className="border-t border-[var(--color-border)] p-5 sm:p-7 lg:border-l lg:border-t-0 lg:p-8">
              <p className="heading-kicker mb-1">Cities</p>
              <h2 className="section-title mb-4">Where the action is</h2>
              {topCities.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {topCities.map((city) => (
                    <Link
                      key={city.name}
                      href={`/play?mode=events&search=${encodeURIComponent(city.name)}`}
                      className="group inline-flex items-center gap-1.5 rounded-full border border-[var(--color-border-strong)] bg-[var(--color-control-bg)] px-4 py-2 text-sm font-medium text-[var(--color-text-secondary)] transition hover:border-[rgba(125,211,252,0.38)] hover:bg-[rgba(125,211,252,0.08)] hover:text-[var(--color-text-primary)]"
                    >
                      {city.name}
                      <span className="rounded-full bg-[var(--color-control-bg-hover)] px-1.5 py-0.5 text-[0.65rem] font-bold text-[var(--color-text-muted)] group-hover:text-[var(--color-brand-alt)]">
                        {city.upcomingCount}
                      </span>
                    </Link>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-[var(--color-text-muted)]">
                  Cities will appear as local hosts publish.
                </p>
              )}
            </div>
          </div>
        </div>
      </Section>

      {/* ── Bottom CTA banner ────────────────────────── */}
      <Section size="sm" className="pt-0">
        <div className="surface-card relative overflow-hidden">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_55%_80%_at_0%_50%,rgba(74,222,128,0.1),transparent),radial-gradient(ellipse_35%_60%_at_100%_50%,rgba(56,189,248,0.08),transparent)]" />
          <FieldWatermark className="pointer-events-none absolute -right-10 bottom-0 top-0 w-1/2 max-w-xs opacity-[0.06] text-[var(--color-brand)]" />

          <div className="relative flex flex-col gap-5 p-5 sm:flex-row sm:items-center sm:justify-between sm:gap-6 sm:p-7 lg:p-8">
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-[rgba(74,222,128,0.3)] bg-[rgba(74,222,128,0.12)] text-[var(--color-brand)]">
                <BoltIcon className="h-7 w-7" />
              </div>
              <div>
                <h2 className="text-xl font-bold tracking-[-0.04em] text-[var(--color-text-primary)]">
                  Ready when you are
                </h2>
                <p className="mt-0.5 text-sm text-[var(--color-text-secondary)]">
                  Book a slot with your crew or browse matches — then open Host when you run a pitch.
                </p>
              </div>
            </div>

            <Cluster gap="sm" className="shrink-0">
              <Link
                href="/play?mode=slots"
                className={cn(buttonVariants("primary", "md"), "rounded-full px-6")}
              >
                Book slots
              </Link>
              <Link
                href="/play?mode=events"
                className={cn(buttonVariants("secondary", "md"), "rounded-full px-6")}
              >
                Matches
              </Link>
              <Link
                href="/host"
                className={cn(buttonVariants("ghost", "md"), "rounded-full px-6")}
              >
                Host
              </Link>
            </Cluster>
          </div>
        </div>
      </Section>
    </Stack>
  );
}

/* ── Sub-components ────────────────────────────────────── */

function StatPill({ label, value }: { label: string; value: string }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-[var(--color-border-strong)] bg-[var(--color-control-bg)] px-3 py-1.5 text-xs">
      <span className="text-[var(--color-text-muted)]">{label}</span>
      <span className="font-bold text-[var(--color-text-primary)]">{value}</span>
    </span>
  );
}

function FeatureSlotCard({ offer }: { offer: LandingSlotOffer }) {
  const leadId = getOfferLeadSlotId({ slots: offer.slots });
  const href = leadId ? `/play/slots/${leadId}` : "/play?mode=slots";
  const nextLabel = getOfferNextAvailableLabel({ slots: offer.slots });
  const priceLabel = getOfferPriceLabel(offer);
  const perPersonLabel = getOfferPerPersonPriceLabel(offer);
  const sortedSlots = [...offer.slots].sort(
    (a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime(),
  );
  const nextSlot = sortedSlots[0];
  const imageSrc = offer.pitchImageUrl?.trim() || null;

  return (
    <Link href={href} className="group block h-full">
      <Card className="flex h-full flex-col overflow-hidden transition-all duration-200 hover:-translate-y-1 hover:shadow-[0_20px_56px_rgba(1,5,14,0.5)]">
        {/* Image */}
        <div className="relative aspect-[16/10] overflow-hidden bg-[var(--color-surface-3)]">
          {imageSrc ? (
            <Image
              src={imageSrc}
              alt={offer.pitchName}
              fill
              className="object-cover transition-transform duration-500 group-hover:scale-105"
              sizes="(max-width: 768px) 100vw, (max-width: 1280px) 50vw, 33vw"
            />
          ) : (
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(74,222,128,0.22),transparent_40%),radial-gradient(circle_at_80%_80%,rgba(56,189,248,0.16),transparent_35%),linear-gradient(135deg,#102218,#0b1c2a)]" />
          )}
          {/* Gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-[rgba(5,14,22,0.88)] via-[rgba(5,14,22,0.18)] to-transparent" />

          {/* Category badge */}
          <div className="absolute left-3 top-3">
            <span className="rounded-full border border-[var(--color-border-strong)] bg-[rgba(5,14,22,0.8)] px-2.5 py-1 text-[0.68rem] font-bold uppercase tracking-[0.15em] text-[var(--color-text-primary)] backdrop-blur-sm">
              {offer.categoryName}
            </span>
          </div>

          {/* Price badges */}
          <div className="absolute bottom-3 right-3 flex flex-col items-end gap-1.5">
            <span className="rounded-full border border-[rgba(74,222,128,0.35)] bg-[rgba(74,222,128,0.18)] px-3 py-1 text-xs font-bold text-[var(--color-text-primary)] backdrop-blur-sm">
              {priceLabel}
            </span>
            {perPersonLabel ? (
              <span className="rounded-full border border-[var(--color-border)] bg-[rgba(5,14,22,0.85)] px-2.5 py-0.5 text-[0.65rem] font-medium text-[var(--color-text-secondary)] backdrop-blur-sm">
                {perPersonLabel}
              </span>
            ) : null}
          </div>

          {offer.requiresParty ? (
            <div className="absolute bottom-3 left-3">
              <span className="rounded-full border border-[rgba(74,222,128,0.4)] bg-[rgba(5,14,22,0.82)] px-2.5 py-1 text-[0.65rem] font-bold uppercase tracking-[0.14em] text-[var(--color-brand)] backdrop-blur-sm">
                Group booking
              </span>
            </div>
          ) : null}
        </div>

        {/* Body */}
        <div className="flex flex-1 flex-col gap-3 p-4 sm:p-5">
          <div className="space-y-1.5">
            <h3 className="line-clamp-2 text-[1.05rem] font-bold tracking-[-0.03em] text-[var(--color-text-primary)] leading-[1.25]">
              {offer.pitchName}
            </h3>
            {nextLabel ? (
              <p className="text-sm text-[var(--color-text-secondary)]">{nextLabel}</p>
            ) : null}
            <p className="line-clamp-1 text-xs text-[var(--color-text-muted)]">
              {offer.addressLabel?.trim() || "Location on booking page"}
            </p>
          </div>

          <div className="mt-auto flex items-center justify-between border-t border-[var(--color-border)] pt-3 text-xs">
            <span className="font-semibold text-[var(--color-brand)]">
              {nextSlot != null
                ? `${nextSlot.remainingCapacity} spots (next window)`
                : "Open slot"}
            </span>
            <span className="font-semibold text-[var(--color-text-muted)] transition group-hover:text-[var(--color-text-primary)]">
              Book →
            </span>
          </div>
        </div>
      </Card>
    </Link>
  );
}

function FeatureMatchCard({ match }: { match: LandingMatch }) {
  return (
    <Link href={`/events/${match.eventId}`} className="group block h-full">
      <Card className="flex h-full flex-col overflow-hidden transition-all duration-200 hover:-translate-y-1 hover:shadow-[0_20px_56px_rgba(1,5,14,0.5)]">
        {/* Image */}
        <div className="relative aspect-[16/9] overflow-hidden bg-[var(--color-surface-3)]">
          {match.pictureUrl ? (
            <Image
              src={match.pictureUrl}
              alt={match.title}
              fill
              className="object-cover transition-transform duration-500 group-hover:scale-105"
              sizes="(max-width: 768px) 100vw, (max-width: 1280px) 50vw, 33vw"
            />
          ) : (
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(125,211,252,0.22),transparent_40%),radial-gradient(circle_at_80%_80%,rgba(74,222,128,0.16),transparent_35%),linear-gradient(135deg,#0e1e2e,#0b1a1e)]" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-[rgba(5,14,22,0.88)] via-[rgba(5,14,22,0.18)] to-transparent" />

          <div className="absolute left-3 top-3">
            <span className="rounded-full border border-[rgba(74,222,128,0.35)] bg-[rgba(74,222,128,0.16)] px-2.5 py-1 text-[0.68rem] font-bold uppercase tracking-[0.15em] text-[var(--color-brand)] backdrop-blur-sm">
              Upcoming
            </span>
          </div>

          <div className="absolute bottom-3 right-3">
            <span className="rounded-full border border-[rgba(125,211,252,0.32)] bg-[rgba(125,211,252,0.14)] px-3 py-1 text-xs font-bold text-[var(--color-text-primary)] backdrop-blur-sm">
              {match.priceLabel}
            </span>
          </div>
        </div>

        {/* Body */}
        <div className="flex flex-1 flex-col gap-3 p-4 sm:p-5">
          <div className="space-y-1.5">
            <h3 className="line-clamp-2 text-[1.05rem] font-bold tracking-[-0.03em] text-[var(--color-text-primary)] leading-[1.25]">
              {match.title}
            </h3>
            <p className="text-sm text-[var(--color-text-secondary)]">{match.when}</p>
            <p className="line-clamp-1 text-xs text-[var(--color-text-muted)]">
              {match.locationLabel}
            </p>
          </div>

          <div className="mt-auto flex items-center justify-between border-t border-[var(--color-border)] pt-3 text-xs">
            <span className="font-semibold text-[var(--color-brand-alt)]">
              {match.spotsLeft != null
                ? `${match.spotsLeft} spots left`
                : `${match.attendeeCount} attending`}
            </span>
            <span className="font-semibold text-[var(--color-text-muted)] transition group-hover:text-[var(--color-text-primary)]">
              View →
            </span>
          </div>
        </div>
      </Card>
    </Link>
  );
}

function EmptyMatchesVisual() {
  return (
    <Card className="relative overflow-hidden border-[var(--color-border)]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_70%_40%,rgba(125,211,252,0.1),transparent),radial-gradient(circle_at_10%_80%,rgba(74,222,128,0.08),transparent)]" />
      <div className="relative flex flex-col gap-5 p-6 sm:flex-row sm:items-center sm:p-8">
        <div className="space-y-4 sm:max-w-md">
          <p className="heading-kicker">Matches</p>
          <p className="text-base font-semibold tracking-tight text-[var(--color-text-primary)]">
            No matches listed yet — check back soon or book a pitch slot with your group.
          </p>
          <Cluster gap="sm">
            <Link
              href="/play?mode=events"
              className={cn(buttonVariants("primary", "md"), "rounded-full px-5")}
            >
              Browse matches
            </Link>
            <Link
              href="/play?mode=slots"
              className={cn(buttonVariants("secondary", "md"), "rounded-full px-5")}
            >
              Book a slot
            </Link>
          </Cluster>
        </div>
      </div>
    </Card>
  );
}

function EmptySlotsVisual() {
  return (
    <Card className="relative overflow-hidden border-[var(--color-border)]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_75%_55%_at_30%_35%,rgba(74,222,128,0.1),transparent),radial-gradient(circle_at_90%_70%,rgba(125,211,252,0.08),transparent)]" />
      <div className="relative flex flex-col gap-5 p-6 sm:flex-row sm:items-center sm:p-8">
        <div className="space-y-4 sm:max-w-md">
          <p className="heading-kicker">Pitch slots</p>
          <p className="text-base font-semibold tracking-tight text-[var(--color-text-primary)]">
            No open slots right now — hosts add new windows often. Try again shortly or list your own pitch.
          </p>
          <Cluster gap="sm">
            <Link
              href="/play?mode=slots"
              className={cn(buttonVariants("primary", "md"), "rounded-full px-5")}
            >
              Open slot finder
            </Link>
            <Link
              href="/host"
              className={cn(buttonVariants("secondary", "md"), "rounded-full px-5")}
            >
              Host a pitch
            </Link>
          </Cluster>
        </div>
      </div>
    </Card>
  );
}

/* ── Icons ─────────────────────────────────────────────── */

function FieldWatermark({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 240 320"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      {/* Outer pitch rectangle */}
      <rect x="20" y="20" width="200" height="280" rx="4" stroke="currentColor" strokeWidth="1.5" />
      {/* Centre line */}
      <line x1="20" y1="160" x2="220" y2="160" stroke="currentColor" strokeWidth="1" strokeDasharray="5 7" opacity="0.6" />
      {/* Centre circle */}
      <circle cx="120" cy="160" r="36" stroke="currentColor" strokeWidth="1" opacity="0.8" />
      {/* Centre dot */}
      <circle cx="120" cy="160" r="3.5" fill="currentColor" opacity="0.9" />
      {/* Top goal area */}
      <rect x="70" y="20" width="100" height="42" stroke="currentColor" strokeWidth="1" opacity="0.7" />
      {/* Bottom goal area */}
      <rect x="70" y="258" width="100" height="42" stroke="currentColor" strokeWidth="1" opacity="0.7" />
      {/* Top penalty spot */}
      <circle cx="120" cy="78" r="2.5" fill="currentColor" opacity="0.6" />
      {/* Bottom penalty spot */}
      <circle cx="120" cy="242" r="2.5" fill="currentColor" opacity="0.6" />
      {/* Corner arcs */}
      <path d="M20 32 A12 12 0 0 1 32 20" stroke="currentColor" strokeWidth="1" opacity="0.5" />
      <path d="M208 20 A12 12 0 0 1 220 32" stroke="currentColor" strokeWidth="1" opacity="0.5" />
      <path d="M20 288 A12 12 0 0 0 32 300" stroke="currentColor" strokeWidth="1" opacity="0.5" />
      <path d="M208 300 A12 12 0 0 0 220 288" stroke="currentColor" strokeWidth="1" opacity="0.5" />
    </svg>
  );
}

function BoltIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M13 2L4.5 13.5H11L11 22L19.5 10.5H13L13 2Z" />
    </svg>
  );
}

function ChevronRightIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}
