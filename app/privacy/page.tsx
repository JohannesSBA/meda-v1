/**
 * Privacy policy page -- static legal content.
 */

import type { Metadata } from "next";
import Link from "next/link";
import { PageShell } from "../components/ui/page-shell";

export const metadata: Metadata = {
  title: "Privacy Policy | Meda",
  description:
    "How Meda collects, uses, and protects your data when you join or host pickup football matches across Ethiopia.",
};

type Section = {
  title: string;
  bullets: string[];
  footnote?: string;
};

const sections: Section[] = [
  {
    title: "Data we collect",
    bullets: [
      "Account details: name, email, password hash, and optionally phone number to verify bookings.",
      "Profile context: preferred position, playing level, and city so we can personalize match suggestions.",
      "Event activity: tickets you buy, waitlists you join, refunds issued, and tickets you share or receive.",
      "Payments: references and status returned by our processors (e.g., Chapa) so we can confirm success - never your full card or mobile wallet details.",
      "Device + analytics: IP address, device type, and coarse location to secure accounts and detect abuse.",
    ],
  },
  {
    title: "How we use your data",
    bullets: [
      "Provide the service: show events near you, issue tickets, manage waitlists, and deliver confirmations.",
      "Safety and trust: prevent duplicate check-ins, detect fraud in ticket sharing, and flag abusive behavior.",
      "Support: investigate payment issues, refunds, and access problems with clear audit trails.",
      "Product quality: measure performance, troubleshoot errors, and improve flows that feel slow on mobile data.",
      "Communication: send transactional updates (tickets, cancellations, refunds). We keep marketing minimal and opt-in.",
    ],
  },
  {
    title: "When we share data",
    bullets: [
      "Hosts: your name and attendance status so they can manage the roster and venue access.",
      "Payment partners: necessary payment references to confirm charges or payouts.",
      "Infrastructure + analytics: secure vendors that help us run the platform (e.g., logging, monitoring).",
      "Legal and safety: if required to comply with law or to protect players, hosts, or Meda from harm.",
    ],
  },
  {
    title: "Retention & deletion",
    bullets: [
      "Transaction records are retained as required for accounting and fraud prevention.",
      "Event and ticket history is kept so hosts can comply with venue rules and handle disputes.",
      "You may request deletion of your account; we will remove non-essential data while keeping what the law requires.",
    ],
  },
  {
    title: "Your choices & rights",
    bullets: [
      "Access and correct your info in Profile; contact support for anything you cannot edit.",
      "Opt out of marketing messages at any time; transactional updates will continue so your tickets work.",
      "Control cookies and local storage via your browser; see our Cookie Policy for details.",
      "Request data export or deletion by emailing support@meda.app. We respond with timelines and scope.",
    ],
  },
  {
    title: "Security",
    bullets: [
      "Encryption in transit and at rest for sensitive data we store.",
      "Least-privilege access for staff tools; production access is audited.",
      "Fraud-aware ticket sharing and rate limits to reduce abuse.",
      "If we ever face a data incident, we will notify affected users with clear next steps.",
    ],
  },
  {
    title: "Children",
    bullets: [
      "Meda is built for adults organizing and joining pickup matches. If you believe a minor has provided data, contact us so we can address it quickly.",
    ],
  },
  {
    title: "Policy updates",
    bullets: [
      "We will post updates here and adjust the 'Last updated' date when the policy changes.",
    ],
    footnote: "Last updated: March 10, 2026",
  },
];

export default function PrivacyPolicyPage() {
  return (
    <PageShell containerClassName="mx-auto flex max-w-5xl flex-col gap-8 px-4 py-10 sm:py-12">
      <section className="glass-card space-y-3 rounded-3xl border border-[var(--color-border)] bg-[rgba(10,24,38,0.86)] p-6 sm:p-8">
        <p className="heading-kicker">Privacy first</p>
        <h1 className="text-3xl font-bold text-white sm:text-4xl">
          Meda Privacy Policy
        </h1>
        <p className="max-w-3xl text-sm leading-relaxed text-[var(--color-text-secondary)] sm:text-base">
          We collect only what we need to run safe, reliable football sessions
          and to settle payments correctly. You stay in control of your data,
          and we keep the service usable even when you limit tracking.
        </p>
      </section>

      <section className="grid gap-4 sm:grid-cols-2">
        {sections.map((section) => (
          <article
            key={section.title}
            className="glass-card flex flex-col gap-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5"
          >
            <h2 className="text-lg font-semibold text-white">
              {section.title}
            </h2>
            <ul className="space-y-2 text-sm text-[var(--color-text-secondary)]">
              {section.bullets.map((item) => (
                <li key={item} className="flex gap-2">
                  <span
                    className="mt-1 inline-flex h-2 w-2 rounded-full bg-[var(--color-brand)]"
                    aria-hidden
                  />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
            {section.footnote ? (
              <p className="text-xs text-[var(--color-text-muted)]">
                {section.footnote}
              </p>
            ) : null}
          </article>
        ))}
      </section>

      <section className="glass-card space-y-3 rounded-3xl border border-[var(--color-border)] bg-[var(--color-surface-2)] p-6">
        <h2 className="text-xl font-semibold text-white">Contact & requests</h2>
        <p className="text-sm text-[var(--color-text-secondary)]">
          For privacy questions, data access, or deletion requests, email{" "}
          <a
            href="mailto:support@meda.app"
            className="text-[var(--color-brand)] underline-offset-4 hover:underline"
          >
            support@meda.app
          </a>{" "}
          and include your account email plus relevant match IDs. We answer with
          clear timelines and what we can or cannot remove.
        </p>
        <p className="text-sm text-[var(--color-text-secondary)]">
          See also our{" "}
          <Link
            href="/terms"
            className="text-[var(--color-brand)] underline-offset-4 hover:underline"
          >
            Terms &amp; Conditions
          </Link>{" "}
          and{" "}
          <Link
            href="/cookie-policy"
            className="text-[var(--color-brand)] underline-offset-4 hover:underline"
          >
            Cookie Policy
          </Link>{" "}
          for additional detail on how the service operates.
        </p>
      </section>
    </PageShell>
  );
}
