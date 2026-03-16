/**
 * Privacy policy page -- static legal content.
 */

import type { Metadata } from "next";
import Link from "next/link";
import { PageShell } from "../components/ui/page-shell";

export const metadata: Metadata = {
  title: "Privacy Policy | Meda",
  description:
    "How Meda collects, uses, shares, and protects data for attendees, pitch owners, facilitators, and admins using the Meda event marketplace.",
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
      "Account details: name, email, password hash, and any profile information you choose to add.",
      "Marketplace role data: whether you are an attendee, pitch owner, facilitator, or admin, plus facilitator-to-pitch-owner links used to scope access.",
      "Event activity: events you create, tickets you buy, waitlists you join, refunds issued, events you save, and tickets you share or receive.",
      "Ticket verification records: QR-code scans, scan timestamps, event IDs, scanner account IDs, and related audit data used to prevent duplicate entry and investigate disputes.",
      "Payments and billing data: payment references, statuses, fee records, promo-code usage, and balance transactions needed to confirm ticket purchases and event-creation payments.",
      "Pitch owner payout details: business name, bank code, account name, account number, Chapa subaccount ID, and payout verification status. Sensitive payout fields are encrypted at rest.",
      "Device, security, and analytics data: IP address, device/browser information, and coarse location used to secure accounts, prevent abuse, and improve reliability.",
    ],
  },
  {
    title: "How we use your data",
    bullets: [
      "Provide the service: show events, issue tickets and QR codes, manage waitlists, confirm event-creation payments, and deliver confirmations.",
      "Operate the marketplace: create and verify pitch owner payout profiles, create Chapa subaccounts, apply split-payment rules, and credit Meda balances where applicable.",
      "Enforce permissions: scope admin, pitch owner, and facilitator access so users only see or act on the events they are allowed to manage.",
      "Safety and trust: prevent duplicate check-ins, detect fraud in payments or ticket sharing, investigate disputes, and flag abusive behavior.",
      "Support and operations: investigate payout issues, refunds, failed checkouts, promo-code problems, and access issues with clear audit trails.",
      "Product quality and security: measure performance, troubleshoot errors, rate limit abuse, and improve reliability on low-bandwidth connections.",
      "Communication: send transactional updates about tickets, payments, event changes, cancellations, refunds, and payout-related issues. Marketing remains limited and opt-in.",
    ],
  },
  {
    title: "When we share data",
    bullets: [
      "Event operators: admins or pitch owners may see attendee names, attendance status, ticket counts, and scan status for events they manage.",
      "Facilitators: facilitators can see ticket-validation details needed to check attendees into events within their assigned scope.",
      "Payment partners: necessary payment references and payout data are shared with processors such as Chapa to confirm charges, event-creation fees, split settlements, and subaccount setup.",
      "Infrastructure and service providers: vendors that help us host the product, store files, log errors, monitor reliability, and deliver email notifications.",
      "Legal and safety requests: when required by law, to enforce our terms, or to protect attendees, hosts, facilitators, admins, or Meda from harm.",
    ],
  },
  {
    title: "Retention & deletion",
    bullets: [
      "Transaction, payout, and billing records may be retained as needed for accounting, fraud prevention, reconciliation, and legal compliance.",
      "Event, ticket, scan, and facilitator-assignment history may be retained so operators can handle disputes, audits, and venue-access questions.",
      "You may request deletion of your account; we will remove or anonymize non-essential data while retaining information we must keep for operational, security, tax, or legal reasons.",
    ],
  },
  {
    title: "Your choices & rights",
    bullets: [
      "Access and correct your information in Profile where available; contact support for anything you cannot update directly.",
      "Pitch owners may update payout details, which will replace the prior subaccount setup after re-verification.",
      "Opt out of marketing messages at any time; transactional messages may still be sent so tickets, payouts, and billing workflows function correctly.",
      "Control cookies and local storage via your browser; see our Cookie Policy for details.",
      "Request data export or deletion by emailing support@meda.app. We respond with timelines, scope, and any data we are legally required to keep.",
    ],
  },
  {
    title: "Security",
    bullets: [
      "Encryption in transit and at rest for sensitive data we store, including encrypted payout fields for pitch owners.",
      "Least-privilege access for staff tools, role-based access controls for marketplace features, and audited production access.",
      "Fraud-aware checkout, ticket sharing protections, scan audit trails, and rate limits to reduce abuse.",
      "If we experience a material data incident, we will notify affected users and explain the next steps required by applicable law.",
    ],
  },
  {
    title: "Children",
    bullets: [
      "Meda is intended for adults organizing, operating, and joining events. If you believe a minor has provided personal data without appropriate permission, contact us so we can address it promptly.",
    ],
  },
  {
    title: "Policy updates",
    bullets: [
      "We will post updates here and adjust the 'Last updated' date when the policy changes.",
    ],
    footnote: "Last updated: March 15, 2026",
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
          We collect only what we need to run the Meda marketplace safely and
          reliably, including ticketing, scanning, event-creation billing, and
          pitch-owner payouts. You stay in control of your data, and we aim to
          keep the service usable even when you limit tracking.
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
