"use client";
import Link from "next/link";
import { buttonVariants } from "../ui/button";
import { cn } from "../ui/cn";

const highlights = [
  {
    title: "Split cost fairly",
    description:
      "Set a price per player and avoid chasing payments in group chats.",
  },
  {
    title: "Clear match logistics",
    description:
      "Share exact time, location pin, and available spots in one place.",
  },
  {
    title: "Reliable attendance",
    description:
      "Players register directly, so hosts can plan with confidence.",
  },
];

const quickFacts = [
  { label: "Designed for", value: "Pickup football" },
  { label: "Best for", value: "Night + weekend runs" },
  { label: "Coverage", value: "Nearby local pitches" },
];

export default function HeroSection() {
  return (
    <div className="space-y-6">
      <section className="relative isolate flex h-[min(760px,100vh)] w-full items-center overflow-hidden rounded-3xl bg-[#081627]">
        <div className="absolute inset-0 -z-30 bg-[radial-gradient(90%_70%_at_50%_-10%,#00E5FF22,transparent_70%),radial-gradient(80%_80%_at_80%_40%,#22FF8830,transparent_60%),linear-gradient(120deg,#071321,#0B1C2D_40%,#071321_100%)]" />
        <div className="absolute inset-6 -z-20 rounded-[32px] border border-[#1c2f42] bg-[#0f1f31]/60 blur-[1px]" />
        {/* Pitch arc motif */}
        <div className="pointer-events-none absolute left-1/2 top-1/2 -z-10 h-[420px] w-[680px] -translate-x-1/2 -translate-y-1/2 opacity-70">
          <div className="absolute inset-0 rounded-[320px_320px_60px_60px] border-10 border-[#00E5FF] blur-[0.2px]" />
          <div className="absolute inset-10 rounded-[280px_280px_48px_48px] border-2 border-[#00E5FF]/60" />
          <div className="absolute inset-24 rounded-[240px_240px_40px_40px] border-2 border-[#22FF88]/50" />
          <div className="absolute left-1/2 top-6 h-12 w-12 -translate-x-1/2 rounded-full border-[6px] border-[#00E5FF] bg-[#0B1C2D]" />
          <div className="absolute inset-y-16 left-1/2 w-[2px] -translate-x-1/2 bg-linear-to-b from-[#00E5FF]/80 via-[#22FF88]/80 to-transparent" />
        </div>

        <div className="relative z-20 flex w-full justify-start">
          <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-6 py-16 text-left text-white sm:px-10 lg:px-16">
            <span className="max-w-fit rounded-full border border-[var(--color-border-strong)] bg-white/5 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.25em] text-[var(--color-brand)]">
              Meda Football
            </span>
            <h1 className="font-extrabold text-4xl leading-tight text-white sm:text-[54px] sm:leading-[1.05] lg:text-[64px]">
              Find a pitch. Pay your part. Play.
            </h1>
            <p className="max-w-2xl text-base text-[#d7e9ff] sm:text-lg">
              Organize pickup matches, split the pitch cost per player, and
              lock in games near you. Built for Ethiopia’s night football and
              weekend runs.
            </p>
            <div className="flex flex-wrap items-center gap-4 pt-2">
              <Link
                href="/events"
                className={cn(
                  buttonVariants("primary", "lg"),
                  "rounded-full px-8 uppercase tracking-[0.18em]",
                )}
              >
                Join a Match
              </Link>
              <Link
                href="/create-events"
                className={cn(
                  buttonVariants("secondary", "lg"),
                  "rounded-full px-8 uppercase tracking-[0.18em]",
                )}
              >
                Host a Match
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        {highlights.map((item) => (
          <article
            key={item.title}
            className="glass-card p-5 text-[var(--color-text-secondary)]"
          >
            <h2 className="text-base font-semibold text-white">{item.title}</h2>
            <p className="mt-2 text-sm leading-relaxed">{item.description}</p>
          </article>
        ))}
      </section>

      <section className="glass-card p-6">
        <div className="grid gap-8 lg:grid-cols-[1.4fr_1fr]">
          <div>
            <p className="heading-kicker">How Meda works</p>
            <h2 className="mt-2 text-2xl font-bold text-white">
              Simple flow for hosts and players
            </h2>
            <ol className="mt-4 space-y-3 text-sm text-[var(--color-text-secondary)]">
              <li>
                <strong className="text-white">1. Host creates an event</strong>{" "}
                with price, capacity, and location.
              </li>
              <li>
                <strong className="text-white">2. Players register</strong> and
                secure their slots early.
              </li>
              <li>
                <strong className="text-white">3. Everyone shows up ready</strong>{" "}
                with clear match details and fewer surprises.
              </li>
            </ol>
          </div>
          <div className="space-y-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-2)] p-4">
            <p className="heading-kicker">Quick facts</p>
            <ul className="space-y-2">
              {quickFacts.map((fact) => (
                <li
                  key={fact.label}
                  className="flex items-center justify-between gap-4 rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm"
                >
                  <span className="text-[var(--color-text-muted)]">
                    {fact.label}
                  </span>
                  <span className="font-semibold text-white">{fact.value}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>
    </div>
  );
}
