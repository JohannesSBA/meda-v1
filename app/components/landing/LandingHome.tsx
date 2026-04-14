/**
 * Landing page component -- hero section with featured events, categories, and city matches.
 */

import type { ReactNode } from "react";
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
    <Stack gap="xl" className="pb-4 sm:pb-6">
      <Section size="md" className="pb-0">
        <SurfacePanel className="relative overflow-hidden p-5 sm:p-6 lg:p-8">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(125,211,252,0.18),transparent_35%),radial-gradient(circle_at_92%_18%,rgba(52,211,153,0.12),transparent_24%)]" />
          <div className="pointer-events-none absolute -right-10 top-8 h-48 w-48 rounded-full bg-[rgba(125,211,252,0.12)] blur-3xl" />
          <div className="pointer-events-none absolute -bottom-20 left-10 h-52 w-52 rounded-full bg-[rgba(52,211,153,0.12)] blur-3xl" />
          <HeroFieldMarkings className="pointer-events-none absolute right-[8%] top-1/2 hidden w-[min(42%,320px)] -translate-y-1/2 opacity-[0.14] lg:block" />

          <div className="relative space-y-10">
            <div className="grid items-center gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.35fr)_minmax(0,1fr)]">
              <HeroVisualColumn
                align="end"
                className="hidden lg:flex"
                tiles={[
                  { label: "Near you", accent: "violet", icon: <IconMapPin className="h-9 w-9" /> },
                  { label: "Recurring slots", accent: "rose", icon: <IconCalendar className="h-9 w-9" /> },
                ]}
              />

              <PageIntro
                kicker="Meda football"
                title={<>Better pickup football — pitches, people, and payments in one place.</>}
                description="Reserve pitch slots when you already have a squad, or browse one-off matches when you want to join a hosted game. Transparent ETB pricing either way."
                actions={
                  <>
                    <Link
                      href="/play?mode=slots"
                      className={cn(buttonVariants("primary", "lg"), "rounded-full px-6")}
                    >
                      Book a slot
                    </Link>
                    <Link href="/play?mode=events" className={cn(buttonVariants("secondary", "lg"), "rounded-full px-6")}>
                      Find a match
                    </Link>
                    <Link href="/host" className={cn(buttonVariants("secondary", "lg"), "rounded-full px-6")}>
                      Host
                    </Link>
                  </>
                }
                meta={
                  <>
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
                  </>
                }
              />

              <HeroVisualColumn
                align="start"
                className="hidden lg:flex"
                tiles={[
                  { label: "Fair pricing", accent: "amber", icon: <IconCoins className="h-9 w-9" /> },
                  { label: "Squads & groups", accent: "sky", icon: <IconUsers className="h-9 w-9" /> },
                ]}
              />
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:hidden">
              <HeroVisualTile label="Near you" accent="violet" icon={<IconMapPin className="h-8 w-8" />} />
              <HeroVisualTile label="Slots" accent="rose" icon={<IconCalendar className="h-8 w-8" />} />
              <HeroVisualTile label="Pricing" accent="amber" icon={<IconCoins className="h-8 w-8" />} />
              <HeroVisualTile label="Groups" accent="sky" icon={<IconUsers className="h-8 w-8" />} />
            </div>

            <div className="space-y-10">
              <div>
                <p className="heading-kicker text-(--color-brand)">Pitch bookings</p>
                <div className="mt-2 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                  <div className="max-w-2xl space-y-2">
                    <h2 className="section-title text-balance">Got a full group? Pick a pitch.</h2>
                    <p className="text-base leading-relaxed text-(--color-text-secondary)">
                      Hey — do you have a full squad and want to lock in a field? Browse open slot windows,
                      choose a time that fits, and book the pitch in ETB. That&apos;s the main path most teams
                      use on Meda.
                    </p>
                  </div>
                  <Link
                    href="/play?mode=slots"
                    className="shrink-0 text-sm font-semibold text-(--color-brand) transition hover:text-(--color-text-primary)"
                  >
                    See all slots
                  </Link>
                </div>
                {featuredSlotOffers.length > 0 ? (
                  <div className="mt-6">
                    <ResponsiveGrid cols="three" gap="md">
                      {featuredSlotOffers.map((offer) => (
                        <FeatureSlotCard key={offer.key} offer={offer} />
                      ))}
                    </ResponsiveGrid>
                  </div>
                ) : (
                  <div className="mt-6">
                    <EmptySlotsVisual />
                  </div>
                )}
              </div>

              <div className="border-t border-(--color-border-strong) pt-10">
                <p className="heading-kicker text-(--color-text-muted)">One-off matches</p>
                <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                  <div className="max-w-xl space-y-1">
                    <h3 className="text-xl font-semibold tracking-tight text-(--color-text-primary) sm:text-2xl">
                      Discover an organized match
                    </h3>
                    <p className="text-sm text-(--color-text-secondary)">
                      Prefer a hosted pickup or tournament-style event? Explore one-off matches here.
                    </p>
                  </div>
                  <Link
                    href="/play?mode=events"
                    className="shrink-0 text-sm font-semibold text-(--color-text-secondary) transition hover:text-(--color-brand)"
                  >
                    See all matches
                  </Link>
                </div>
                {featuredEvents.length > 0 ? (
                  <div className="mt-6">
                    <ResponsiveGrid cols="two" gap="md">
                      {featuredEvents.map((match) => (
                        <FeatureMatchCard key={match.eventId} match={match} />
                      ))}
                    </ResponsiveGrid>
                  </div>
                ) : (
                  <div className="mt-6">
                    <EmptyMatchesVisual compact />
                  </div>
                )}
              </div>
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
        <SurfacePanel className="relative overflow-hidden">
          <div
            aria-hidden
            className="pointer-events-none absolute -right-8 bottom-0 top-0 w-1/2 max-w-md opacity-[0.12]"
          >
            <HeroFieldMarkings className="h-full w-full" />
          </div>
          <div className="relative flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-(--color-border-strong) bg-[rgba(125,211,252,0.1)] text-(--color-brand)">
                <IconSpark className="h-8 w-8" />
              </div>
              <div>
                <h2 className="section-title text-balance">Ready when you are</h2>
                <p className="mt-1 text-sm text-(--color-text-secondary)">
                  Book slots with your crew or browse matches — then open Host when you run a pitch.
                </p>
              </div>
            </div>
            <Cluster gap="sm">
              <Link
                href="/play?mode=slots"
                className={cn(buttonVariants("primary", "lg"), "rounded-full px-6")}
              >
                Book slots
              </Link>
              <Link
                href="/play?mode=events"
                className={cn(buttonVariants("secondary", "lg"), "rounded-full px-6")}
              >
                Matches
              </Link>
              <Link href="/host" className={cn(buttonVariants("secondary", "lg"), "rounded-full px-6")}>
                Host
              </Link>
            </Cluster>
          </div>
        </SurfacePanel>
      </Section>
    </Stack>
  );
}

const visualBlob: Record<"violet" | "rose" | "amber" | "sky", string> = {
  violet: "bg-violet-500/35",
  rose: "bg-rose-500/35",
  amber: "bg-amber-400/30",
  sky: "bg-sky-400/30",
};

function HeroVisualTile({
  label,
  accent,
  icon,
  className,
}: {
  label: string;
  accent: keyof typeof visualBlob;
  icon: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("relative isolate w-full max-w-[200px]", className)}>
      <div
        aria-hidden
        className={cn(
          "absolute -inset-4 -z-10 rounded-[55%_45%_52%_48%/48%_46%_54%_52%] opacity-80 blur-2xl",
          visualBlob[accent],
        )}
      />
      <Card className="flex flex-col items-center gap-3 rounded-3xl border-(--color-border-strong) bg-[rgba(7,17,26,0.78)] px-4 py-5 text-center shadow-lg backdrop-blur-sm">
        <div className="text-(--color-text-primary) [&_svg]:opacity-90">{icon}</div>
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-(--color-text-secondary)">
          {label}
        </p>
      </Card>
    </div>
  );
}

function HeroVisualColumn({
  tiles,
  align,
  className,
}: {
  tiles: Array<{ label: string; accent: keyof typeof visualBlob; icon: ReactNode }>;
  align: "start" | "end";
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-5",
        align === "end" ? "items-end" : "items-start",
        className,
      )}
    >
      {tiles.map((tile) => (
        <HeroVisualTile key={tile.label} {...tile} />
      ))}
    </div>
  );
}

/** Stylized half-pitch + nodes — decorative only */
function HeroFieldMarkings({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 200 240"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <path
        d="M20 20h160v200H20V20z"
        stroke="currentColor"
        strokeWidth="1.2"
        className="text-(--color-brand)"
      />
      <line
        x1="100"
        y1="20"
        x2="100"
        y2="220"
        stroke="currentColor"
        strokeWidth="1"
        strokeDasharray="4 6"
        className="text-(--color-brand)"
        opacity="0.5"
      />
      <circle cx="100" cy="120" r="28" stroke="currentColor" strokeWidth="1" className="text-(--color-brand)" />
      <circle cx="100" cy="120" r="3" fill="currentColor" className="text-(--color-brand-alt)" />
      <circle cx="48" cy="72" r="6" fill="rgba(125,211,252,0.35)" />
      <circle cx="152" cy="168" r="8" fill="rgba(52,211,153,0.3)" />
      <path
        d="M44 180 Q100 140 156 60"
        stroke="currentColor"
        strokeWidth="0.8"
        strokeDasharray="3 5"
        className="text-(--color-text-muted)"
        opacity="0.4"
      />
    </svg>
  );
}

function EmptyMatchesVisual({ compact = false }: { compact?: boolean }) {
  return (
    <Card className="relative overflow-hidden border-(--color-border-strong)">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_70%_40%,rgba(125,211,252,0.12),transparent),radial-gradient(circle_at_15%_80%,rgba(52,211,153,0.1),transparent)]" />
      <div
        className={cn(
          "relative grid gap-8 sm:grid-cols-[1fr_auto] sm:items-center",
          compact ? "p-5 sm:p-6" : "p-6 sm:p-10",
        )}
      >
        {!compact ? (
          <div className="flex justify-center sm:justify-start">
            <div className="relative w-full max-w-[280px]">
              <div
                aria-hidden
                className="absolute -inset-6 rounded-[50%_45%_48%_52%/42%_58%_48%_52%] bg-violet-500/20 blur-3xl"
              />
              <EmptyPitchIllustration className="relative mx-auto w-full text-(--color-brand)" />
            </div>
          </div>
        ) : null}
        <div
          className={cn(
            "space-y-5 text-center sm:text-left",
            compact ? "sm:max-w-lg" : "sm:max-w-xs",
          )}
        >
          <p className="heading-kicker">Matches</p>
          <p
            className={cn(
              "font-semibold tracking-tight text-(--color-text-primary)",
              compact ? "text-base" : "text-lg",
            )}
          >
            No matches listed yet — check back soon or book a pitch slot with your group.
          </p>
          <Cluster gap="sm" className="justify-center sm:justify-start">
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
    <Card className="relative overflow-hidden border-(--color-border-strong)">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_75%_55%_at_30%_35%,rgba(52,211,153,0.14),transparent),radial-gradient(circle_at_90%_70%,rgba(125,211,252,0.1),transparent)]" />
      <div className="relative grid gap-8 p-6 sm:grid-cols-[1fr_auto] sm:items-center sm:p-10">
        <div className="flex justify-center sm:justify-start">
          <div className="relative w-full max-w-[280px]">
            <div
              aria-hidden
              className="absolute -inset-6 rounded-[50%_45%_48%_52%/42%_58%_48%_52%] bg-emerald-500/15 blur-3xl"
            />
            <EmptyPitchIllustration className="relative mx-auto w-full text-(--color-brand)" />
          </div>
        </div>
        <div className="space-y-5 text-center sm:max-w-xs sm:text-left">
          <p className="heading-kicker">Pitch slots</p>
          <p className="text-lg font-semibold tracking-tight text-(--color-text-primary)">
            No open slots right now — hosts add new windows often. Try again shortly or list your own pitch.
          </p>
          <Cluster gap="sm" className="justify-center sm:justify-start">
            <Link
              href="/play?mode=slots"
              className={cn(buttonVariants("primary", "md"), "rounded-full px-5")}
            >
              Open slot finder
            </Link>
            <Link href="/host" className={cn(buttonVariants("secondary", "md"), "rounded-full px-5")}>
              Host a pitch
            </Link>
          </Cluster>
        </div>
      </div>
    </Card>
  );
}

function EmptyPitchIllustration({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 320 220"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <ellipse cx="160" cy="118" rx="118" ry="72" stroke="currentColor" strokeWidth="1.5" opacity="0.35" />
      <circle cx="160" cy="118" r="22" stroke="currentColor" strokeWidth="1.2" opacity="0.5" />
      <circle cx="160" cy="118" r="3" fill="currentColor" opacity="0.7" />
      <rect
        x="52"
        y="48"
        width="216"
        height="140"
        rx="12"
        stroke="currentColor"
        strokeWidth="1.2"
        opacity="0.25"
      />
      <path d="M88 118h144" stroke="currentColor" strokeWidth="1" strokeDasharray="5 8" opacity="0.3" />
      <circle cx="92" cy="78" r="10" fill="rgba(125,211,252,0.25)" stroke="currentColor" strokeWidth="0.8" />
      <circle cx="228" cy="158" r="12" fill="rgba(52,211,153,0.22)" stroke="currentColor" strokeWidth="0.8" />
      <circle cx="248" cy="72" r="8" fill="rgba(251,191,36,0.2)" />
      <path
        d="M96 168c32-24 64-36 128-20"
        stroke="currentColor"
        strokeWidth="1"
        strokeLinecap="round"
        strokeDasharray="4 7"
        opacity="0.35"
      />
    </svg>
  );
}

function IconMapPin({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <path d="M12 21s7-4.35 7-11a7 7 0 10-14 0c0 6.65 7 11 7 11z" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="12" cy="10" r="2.25" />
    </svg>
  );
}

function IconCalendar({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <rect x="3.5" y="5" width="17" height="16" rx="2" />
      <path d="M3.5 9.5h17M8 3v4M16 3v4" strokeLinecap="round" />
      <path d="M8 14h2M12 14h2M16 14h2M8 17h2" strokeLinecap="round" opacity="0.7" />
    </svg>
  );
}

function IconCoins({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <ellipse cx="9" cy="7" rx="5" ry="3" />
      <path d="M4 7v8c0 1.66 2.24 3 5 3s5-1.34 5-3V7" />
      <path d="M14 10c2.76 0 5-1.34 5-3s-2.24-3-5-3" opacity="0.65" />
      <path d="M19 7v6" strokeLinecap="round" opacity="0.65" />
    </svg>
  );
}

function IconUsers({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <circle cx="9" cy="8" r="3" />
      <path d="M3.5 20.5v-1c0-2.2 2.02-4 4.5-4h2c2.48 0 4.5 1.8 4.5 4v1" strokeLinecap="round" />
      <circle cx="17" cy="9" r="2.5" opacity="0.85" />
      <path d="M21 20.5v-0.5c0-1.6-1.34-2.9-3-3.2" strokeLinecap="round" opacity="0.85" />
    </svg>
  );
}

function IconSpark({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12 2l1.2 5.4L18 9l-4.8 1.6L12 16l-1.2-5.4L6 9l4.8-1.6L12 2zM19 14l.6 2.4L22 17l-2.4.6L19 20l-.6-2.4L16 17l2.4-.6L19 14zM5 15l.5 2L7 17.5l-1.5.5L5 20l-.5-2L3 17.5l1.5-.5L5 15z" />
    </svg>
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
    <Link href={href} className="group h-full">
      <Card className="flex h-full flex-col overflow-hidden transition hover:-translate-y-0.5">
        <div className="relative aspect-16/10 overflow-hidden">
          {imageSrc ? (
            <Image
              src={imageSrc}
              alt={offer.pitchName}
              fill
              className="object-cover transition duration-500 group-hover:scale-105"
              sizes="(max-width: 768px) 100vw, (max-width: 1280px) 50vw, 33vw"
            />
          ) : (
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_18%,rgba(52,211,153,0.2),transparent_30%),radial-gradient(circle_at_100%_0%,rgba(125,211,252,0.18),transparent_26%),linear-gradient(135deg,#102033,#0b1724)]" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-[rgba(6,17,27,0.84)] via-[rgba(6,17,27,0.22)] to-transparent" />
          <div className="absolute inset-x-3 bottom-3 flex items-end justify-between gap-3">
            <span className="rounded-full border border-(--color-border-strong) bg-[rgba(7,17,26,0.78)] px-2.5 py-1 text-[0.72rem] font-semibold uppercase tracking-[0.16em] text-(--color-text-primary) backdrop-blur">
              {offer.categoryName}
            </span>
            <div className="flex max-w-[min(100%,11rem)] flex-col items-end gap-1">
              <span className="rounded-full border border-[rgba(52,211,153,0.28)] bg-[rgba(52,211,153,0.14)] px-3 py-1 text-xs font-semibold text-(--color-text-primary) backdrop-blur">
                {priceLabel}
              </span>
              {perPersonLabel ? (
                <span className="rounded-full border border-[rgba(125,211,252,0.22)] bg-[rgba(7,17,26,0.82)] px-2.5 py-0.5 text-[0.65rem] font-medium leading-tight text-(--color-text-secondary) backdrop-blur">
                  {perPersonLabel}
                </span>
              ) : null}
            </div>
          </div>
          {offer.requiresParty ? (
            <div className="absolute left-3 top-3">
              <span className="rounded-full border border-[rgba(125,211,252,0.35)] bg-[rgba(7,17,26,0.82)] px-2.5 py-1 text-[0.65rem] font-bold uppercase tracking-[0.14em] text-(--color-brand) backdrop-blur">
                Group
              </span>
            </div>
          ) : null}
        </div>
        <div className="flex flex-1 flex-col gap-3 p-4 sm:p-5">
          <div className="space-y-2">
            <h3 className="line-clamp-2 text-xl font-semibold tracking-[-0.03em] text-(--color-text-primary)">
              {offer.pitchName}
            </h3>
            {nextLabel ? <p className="text-sm text-(--color-text-secondary)">{nextLabel}</p> : null}
            <p className="line-clamp-1 text-sm text-(--color-text-muted)">
              {offer.addressLabel?.trim() || "Location on booking page"}
            </p>
          </div>

          <div className="mt-auto flex items-center justify-between pt-3 text-sm">
            <span className="font-medium text-[#c9ffea]">
              {nextSlot != null
                ? `${nextSlot.remainingCapacity} spots left (next window)`
                : "Open slot"}
            </span>
            <span className="text-(--color-text-muted) transition group-hover:text-(--color-text-primary)">
              Book slot
            </span>
          </div>
        </div>
      </Card>
    </Link>
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
