/**
 * About page -- static content describing the platform and its mission.
 */

import Link from "next/link";
import type { Metadata } from "next";
import { PageShell } from "../components/ui/page-shell";
import { buttonVariants } from "../components/ui/button";
import { cn } from "../components/ui/cn";

export const metadata: Metadata = {
  title: "About Meda | Pickup football built for Ethiopia",
  description:
    "Learn how Meda helps players and hosts run trustworthy pickup football across Ethiopia with transparent payments, safety-first tools, and intentional UX.",
};

const pillars = [
  {
    title: "Designed for pickup football",
    body: "Fast flows for night games and weekend runs, ETB-first payments, and location-aware details that make Addis Ababa play feel native.",
  },
  {
    title: "Trust baked into every step",
    body: "Verified hosts, transparent capacity, waitlists, and shareable tickets with clear ownership trails keep matches fair for everyone.",
  },
  {
    title: "Operational clarity for hosts",
    body: "Hosts see live headcounts, payment status, and refund windows in one place - no spreadsheets or scattered group chats.",
  },
  {
    title: "Mobile native, safe-area aware",
    body: "Bottom navigation, safe-area padding, and purposeful motion make Meda comfortable on any device, even on low-light pitches.",
  },
];

const values = [
  {
    title: "Reliability over hype",
    detail: "We optimize for on-time kickoffs and transparent rosters, not vanity metrics.",
  },
  {
    title: "Local-first decisions",
    detail:
      "We build for Ethiopian payment rails, time zones, and football culture before anything else.",
  },
  {
    title: "Calm, confident UX",
    detail:
      "Interfaces are intentional, legible in the dark, and respectful of players' limited time.",
  },
  {
    title: "Security as a feature",
    detail:
      "Role-aware actions, fraud-aware ticket sharing, and protective defaults come standard.",
  },
];

const operatingPrinciples = [
  "Every screen answers: what should the player do next?",
  "Data minimization by default; only the essentials are collected for operations and safety.",
  "Performance budgets for all public pages to keep booking feel instant on mobile data.",
  "Accessible color contrast and motion that can be reduced without losing context.",
];

export default function AboutPage() {
  return (
    <PageShell containerClassName="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-10 sm:py-12">
      <section className="glass-card relative overflow-hidden rounded-3xl border border-[var(--color-border)] bg-[rgba(10,24,38,0.86)] px-6 py-8 sm:px-10 sm:py-12">
        <div className="absolute -left-12 top-0 h-40 w-40 rounded-full bg-[#00e5ff1f] blur-3xl" />
        <div className="absolute -right-6 bottom-0 h-48 w-48 rounded-full bg-[#22ff8818] blur-3xl" />
        <div className="relative grid gap-6 lg:grid-cols-[1.2fr_0.8fr] lg:items-center">
          <div className="space-y-4">
            <p className="heading-kicker">About Meda</p>
            <h1 className="text-3xl font-bold text-white sm:text-4xl">
              Building the most trusted way to organize pickup football.
            </h1>
            <p className="max-w-2xl text-base leading-relaxed text-[var(--color-text-secondary)]">
              Meda is crafted for Ethiopia&apos;s football community: transparent rosters, ETB-first
              payments, and a UI that feels right at 10 p.m. under floodlights. Players get clarity,
              hosts get control, and everyone gets to the pitch on time.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link
                href="/events"
                className={cn(buttonVariants("primary", "lg"), "rounded-full px-6")}
              >
                Explore matches
              </Link>
              <Link
                href="/create-events"
                className={cn(buttonVariants("secondary", "lg"), "rounded-full px-6")}
              >
                Host with Meda
              </Link>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {pillars.map((pillar) => (
              <article
                key={pillar.title}
                className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-2)] p-4"
              >
                <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[var(--color-brand)]">
                  {pillar.title}
                </p>
                <p className="mt-2 text-sm text-[var(--color-text-secondary)]">{pillar.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-xl font-bold text-white sm:text-2xl">Our product truths</h2>
          <span className="rounded-full border border-[var(--color-border)] px-3 py-1 text-xs font-semibold text-[var(--color-brand)]">
            UI crafted with intent
          </span>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {values.map((value) => (
            <article
              key={value.title}
              className="glass-card rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5"
            >
              <h3 className="text-lg font-semibold text-white">{value.title}</h3>
              <p className="mt-2 text-sm text-[var(--color-text-secondary)]">{value.detail}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="glass-card space-y-4 rounded-3xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6">
        <div className="flex flex-wrap items-center gap-2">
          <p className="heading-kicker">How Meda operates</p>
          <span className="rounded-full bg-[var(--color-surface-2)] px-3 py-1 text-xs font-semibold text-[var(--color-brand)]">
            Detail oriented
          </span>
        </div>
        <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-3">
            <h3 className="text-lg font-semibold text-white">Design & product standards</h3>
            <ul className="space-y-2 text-sm text-[var(--color-text-secondary)]">
              {operatingPrinciples.map((item) => (
                <li key={item} className="flex gap-2">
                  <span
                    className="mt-1 inline-flex h-2 w-2 rounded-full bg-[var(--color-brand)]"
                    aria-hidden
                  />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <article className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-2)] p-4">
              <p className="text-sm font-semibold text-white">Safety & trust</p>
              <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
                Waitlists, refund windows, and shareable tickets are built with audit trails so
                captains know who&apos;s actually on the pitch.
              </p>
            </article>
            <article className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-2)] p-4">
              <p className="text-sm font-semibold text-white">Operational excellence</p>
              <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
                Hosts see live attendance and payments without leaving the flow; players get concise
                confirmations that work offline after loading.
              </p>
            </article>
            <article className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-2)] p-4 sm:col-span-2">
              <p className="text-sm font-semibold text-white">Community-first support</p>
              <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
                We respond with context: match IDs, payment references, and timelines so issues
                resolve quickly. Reach us anytime at support@meda.app.
              </p>
            </article>
          </div>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2">
        <article className="glass-card space-y-3 rounded-3xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6">
          <p className="heading-kicker">For players</p>
          <h3 className="text-xl font-semibold text-white">Show up confident</h3>
          <ul className="space-y-2 text-sm text-[var(--color-text-secondary)]">
            <li>Clear capacity and pricing before you commit.</li>
            <li>Instant QR tickets with share controls for teammates.</li>
            <li>Refund guidance that respects both hosts and players.</li>
          </ul>
        </article>
        <article className="glass-card space-y-3 rounded-3xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6">
          <p className="heading-kicker">For hosts</p>
          <h3 className="text-xl font-semibold text-white">Run smooth sessions</h3>
          <ul className="space-y-2 text-sm text-[var(--color-text-secondary)]">
            <li>Unified roster, payments, and waitlist in one dashboard.</li>
            <li>Flexible ticket sharing rules to keep squads balanced.</li>
            <li>Messaging-ready confirmations so captains stay aligned.</li>
          </ul>
        </article>
      </section>
    </PageShell>
  );
}
