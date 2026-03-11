/**
 * Terms of service page -- static legal content.
 */

import type { Metadata } from "next";
import Link from "next/link";
import { PageShell } from "../components/ui/page-shell";

export const metadata: Metadata = {
  title: "Terms & Conditions | Meda",
  description:
    "Understand the rules for using Meda to join or host pickup football matches, including tickets, payments, refunds, and conduct.",
};

type Section = {
  title: string;
  bullets: string[];
};

const sections: Section[] = [
  {
    title: "Using Meda",
    bullets: [
      "By creating an account or buying a ticket, you agree to these terms and to follow local laws where you play.",
      "Keep your account credentials private. You are responsible for activity under your account.",
      "Meda may update the product experience; continued use after updates means you accept the new terms.",
    ],
  },
  {
    title: "Tickets, payments, and fees",
    bullets: [
      "Prices are shown in ETB unless stated otherwise. Payment processing is handled by trusted partners (e.g., Chapa).",
      "A ticket is confirmed only after payment succeeds and you receive a Meda confirmation/QR code.",
      "Platform or processing fees may apply; any fees are shown before you confirm payment.",
    ],
  },
  {
    title: "Cancellations and refunds",
    bullets: [
      "Self-service refunds are available while the host's refund window is open (typically until 24 hours before kickoff).",
      "If a host cancels, attendees will be notified and refunds will be processed to the original payment method where possible.",
      "Processing times can depend on your bank or payment provider; we share reference IDs so you can track status.",
    ],
  },
  {
    title: "Ticket sharing & transfers",
    bullets: [
      "Sharing is allowed only through Meda's ticket-share flow so we can keep ownership and check-in records accurate.",
      "Hosts may limit how many times a ticket can be shared or when sharing closes to protect roster integrity.",
      "Recipients must accept the shared ticket within the provided limits; expired links will not transfer entry.",
    ],
  },
  {
    title: "Hosts' responsibilities",
    bullets: [
      "Publish accurate details (time, location, surface, pricing, capacity) and honor the roster shown in Meda.",
      "Communicate changes or cancellations promptly through Meda so players receive reliable notifications.",
      "Respect local regulations and venue rules; you are responsible for permits and on-site safety.",
    ],
  },
  {
    title: "Player responsibilities",
    bullets: [
      "Arrive on time, follow venue rules, and respect hosts, referees, and other players.",
      "Do not attempt to bypass payments, duplicate tickets, or share outside the app.",
      "Report issues or misconduct via support@meda.app with the event ID and details.",
    ],
  },
  {
    title: "Prohibited conduct",
    bullets: [
      "Fraud, harassment, hate speech, or any behavior that risks player safety is prohibited.",
      "Reverse engineering, scraping, or abusing rate limits is not allowed.",
      "Misrepresenting identity or reselling tickets without host approval may result in suspension.",
    ],
  },
  {
    title: "Platform availability and changes",
    bullets: [
      "We strive for high uptime but may perform maintenance or experience outages. Critical event pages prioritize availability.",
      "Features may change or be removed; we aim to give notice when changes affect active events or tickets.",
    ],
  },
  {
    title: "Liability",
    bullets: [
      "Football is a physical activity. Participate at your own risk and follow safety guidance from hosts and venues.",
      "To the extent allowed by law, Meda is not liable for indirect or incidental damages arising from the use of the platform.",
      "Some jurisdictions do not allow certain limitations; your local consumer protections still apply.",
    ],
  },
];

export default function TermsPage() {
  return (
    <PageShell containerClassName="mx-auto flex max-w-5xl flex-col gap-8 px-4 py-10 sm:py-12">
      <section className="glass-card space-y-3 rounded-3xl border border-[var(--color-border)] bg-[rgba(10,24,38,0.86)] p-6 sm:p-8">
        <p className="heading-kicker">Terms &amp; Conditions</p>
        <h1 className="text-3xl font-bold text-white sm:text-4xl">The rules for playing and hosting with Meda</h1>
        <p className="max-w-3xl text-sm leading-relaxed text-[var(--color-text-secondary)] sm:text-base">
          These terms help keep matches fair and reliable for everyone. Please read them before you buy a ticket or publish an event.
        </p>
        <p className="text-xs text-[var(--color-text-muted)]">Last updated: March 10, 2026</p>
      </section>

      <section className="grid gap-4 sm:grid-cols-2">
        {sections.map((section) => (
          <article
            key={section.title}
            className="glass-card flex flex-col gap-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5"
          >
            <h2 className="text-lg font-semibold text-white">{section.title}</h2>
            <ul className="space-y-2 text-sm text-[var(--color-text-secondary)]">
              {section.bullets.map((item) => (
                <li key={item} className="flex gap-2">
                  <span className="mt-1 inline-flex h-2 w-2 rounded-full bg-[var(--color-brand)]" aria-hidden />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </article>
        ))}
      </section>

      <section className="glass-card space-y-3 rounded-3xl border border-[var(--color-border)] bg-[var(--color-surface-2)] p-6">
        <h2 className="text-xl font-semibold text-white">Need clarity?</h2>
        <p className="text-sm text-[var(--color-text-secondary)]">
          If something here is unclear, reach us at{" "}
          <a href="mailto:support@meda.app" className="text-[var(--color-brand)] underline-offset-4 hover:underline">
            support@meda.app
          </a>{" "}
          with your question and the event ID. For privacy details, see our{" "}
          <Link href="/privacy" className="text-[var(--color-brand)] underline-offset-4 hover:underline">
            Privacy Policy
          </Link>{" "}
          and{" "}
          <Link href="/cookie-policy" className="text-[var(--color-brand)] underline-offset-4 hover:underline">
            Cookie Policy
          </Link>
          .
        </p>
      </section>
    </PageShell>
  );
}
