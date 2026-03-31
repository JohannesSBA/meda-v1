/**
 * Help page -- FAQ and support content.
 */

import Link from "next/link";
import type { Metadata } from "next";
import { PageShell } from "../components/ui/page-shell";
import { buttonVariants } from "../components/ui/button";
import { cn } from "../components/ui/cn";

export const metadata: Metadata = {
  title: "Help Center | Meda",
  description:
    "Get answers to common Meda questions about tickets, payments, hosting, refunds, and safety for pickup football.",
};

const quickStart = [
  "Find a match: browse Events, filter by city, time, or category, and open the card for full details.",
  "Reserve your spot: pick the occurrence if there are multiple dates, choose quantity, and confirm payment.",
  "Get your ticket: a QR code and confirmation appear instantly; you can add it to your wallet or share if enabled.",
  "Show up ready: arrive on time, bring ID if the host requires it, and follow venue rules.",
];

const faqs = [
  {
    q: "How do payments work?",
    a: "We process payments via trusted partners (e.g., Chapa) in ETB. Once payment succeeds you'll see a confirmation and ticket QR. If payment fails, no ticket is issued.",
  },
  {
    q: "Can I get a refund?",
    a: "If the host allows self-service refunds, you can refund from your ticket until the posted cutoff (typically 24 hours before kickoff). If a host cancels, we notify you and process a refund where possible.",
  },
  {
    q: "How do I share a ticket with a friend?",
    a: "Use the ticket share button inside your ticket. Sharing outside Meda (screenshots, PDFs) will not transfer entry because we track ownership and check-ins.",
  },
  {
    q: "Why was my share link limited?",
    a: "Hosts can cap the number of claims or set an expiry to keep rosters accurate. Claim before it expires, or ask the host to reissue.",
  },
  {
    q: "Who sees my data?",
    a: "Hosts see your name and attendance status for their event. Payment processors see only what's required to settle the charge. More details are in our Privacy Policy.",
  },
];

const safety = [
  "Check the event location and host rating before you confirm.",
  "Bring the same name or ID you used in your booking if the host requires verification.",
  "If something feels off, don't go - request a refund if eligible and tell us what happened.",
  "Use official ticket sharing so we can help if there's a dispute at the gate.",
];

export default function HelpPage() {
  return (
    <PageShell containerClassName="mx-auto flex max-w-5xl flex-col gap-8 px-4 py-10 sm:py-12">
      <section className="glass-card space-y-4 rounded-3xl border border-[var(--color-border)] bg-[rgba(10,24,38,0.86)] p-6 sm:p-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-2">
            <p className="heading-kicker">Help center</p>
            <h1 className="text-3xl font-bold text-white sm:text-4xl">
              Answers for players and hosts
            </h1>
            <p className="max-w-3xl text-sm leading-relaxed text-[var(--color-text-secondary)] sm:text-base">
              Everything you need to move from &quot;I found a match&quot; to &quot;See you on the
              pitch&quot; with confidence.
            </p>
          </div>
          <Link
            href="/play?mode=events"
            className={cn(buttonVariants("secondary", "lg"), "rounded-full px-6")}
          >
            Find a match
          </Link>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <article className="glass-card space-y-3 rounded-3xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6">
          <p className="heading-kicker">Quick start</p>
          <h2 className="text-xl font-semibold text-white">Book a match in four steps</h2>
          <ol className="list-decimal space-y-3 pl-5 text-sm text-[var(--color-text-secondary)]">
            {quickStart.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ol>
        </article>

        <article className="glass-card space-y-3 rounded-3xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6">
          <p className="heading-kicker">Troubleshooting</p>
          <div className="space-y-2 text-sm text-[var(--color-text-secondary)]">
            <p className="font-semibold text-white">Payment didn&apos;t go through</p>
            <p>
              Wait a moment and check if a ticket issued. If not, retry with a stable connection; no
              charge is made without a ticket.
            </p>
            <p className="font-semibold text-white">Didn&apos;t receive email</p>
            <p>
              Look in spam, then open your ticket from Profile &rarr; My Tickets. Email delivery can
              lag; the in-app ticket is instant.
            </p>
            <p className="font-semibold text-white">Can&apos;t scan QR at the gate</p>
            <p>
              Use brightness max, and ensure the ticket hasn&apos;t been shared. Hosts can search
              your name as a backup.
            </p>
          </div>
        </article>
      </section>

      <section className="glass-card space-y-4 rounded-3xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6">
        <div className="flex flex-wrap items-center gap-2">
          <p className="heading-kicker">FAQs</p>
          <span className="rounded-full bg-[var(--color-surface-2)] px-3 py-1 text-xs font-semibold text-[var(--color-brand)]">
            Up-to-date
          </span>
        </div>
        <div className="space-y-3">
          {faqs.map((item) => (
            <article
              key={item.q}
              className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-2)] p-4"
            >
              <p className="text-sm font-semibold text-white">{item.q}</p>
              <p className="mt-1 text-sm text-[var(--color-text-secondary)]">{item.a}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2">
        <article className="glass-card space-y-3 rounded-3xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6">
          <p className="heading-kicker">Safety & etiquette</p>
          <ul className="space-y-2 text-sm text-[var(--color-text-secondary)]">
            {safety.map((item) => (
              <li key={item} className="flex gap-2">
                <span
                  className="mt-1 inline-flex h-2 w-2 rounded-full bg-[var(--color-brand-alt)]"
                  aria-hidden
                />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </article>

        <article className="glass-card space-y-3 rounded-3xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6">
          <p className="heading-kicker">Still need help?</p>
          <p className="text-sm text-[var(--color-text-secondary)]">
            Email us at{" "}
            <a
              href="mailto:support@meda.app"
              className="text-[var(--color-brand)] underline-offset-4 hover:underline"
            >
              support@meda.app
            </a>{" "}
            with your account email, event ID, payment reference (if any), and a quick summary. We
            respond with concrete next steps.
          </p>
          <div className="flex flex-wrap gap-3 text-sm">
            <Link
              href="/terms"
              className="rounded-full border border-[var(--color-border)] px-3 py-1 text-[var(--color-text-primary)] hover:border-[var(--color-brand)] hover:text-[var(--color-brand)]"
            >
              Terms &amp; Conditions
            </Link>
            <Link
              href="/privacy"
              className="rounded-full border border-[var(--color-border)] px-3 py-1 text-[var(--color-text-primary)] hover:border-[var(--color-brand)] hover:text-[var(--color-brand)]"
            >
              Privacy Policy
            </Link>
          </div>
        </article>
      </section>
    </PageShell>
  );
}
