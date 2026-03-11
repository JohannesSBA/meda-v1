import type { Metadata } from "next";
import Link from "next/link";
import { PageShell } from "../components/ui/page-shell";

export const metadata: Metadata = {
  title: "Cookie Policy | Meda",
  description:
    "Understand how Meda uses cookies and similar storage to run pickup football features, keep accounts secure, and improve performance.",
};

type Section = {
  title: string;
  bullets: string[];
};

const sections: Section[] = [
  {
    title: "What this covers",
    bullets: [
      "Cookies, local storage, and similar technologies used by Meda on web and mobile browsers.",
      "Why we need them for critical features like sign-in, tickets, and payment confirmations.",
    ],
  },
  {
    title: "Types of cookies we use",
    bullets: [
      "Essential: required for authentication, session continuity, and secure check-in tokens.",
      "Performance: lightweight analytics to understand load times, crashes, and error rates.",
      "Preference: remember your city or recent filters so event results stay relevant.",
      "Security and fraud: detect unusual sharing activity or repeated failed payments.",
    ],
  },
  {
    title: "How we use them",
    bullets: [
      "Keep you signed in while you navigate between pages and protect against CSRF.",
      "Issue temporary tokens for QR tickets so hosts can validate entry quickly.",
      "Store non-sensitive preferences (e.g., last viewed radius) to reduce friction.",
      "Measure page performance to ensure flows stay fast on mobile networks.",
    ],
  },
  {
    title: "Your controls",
    bullets: [
      "Manage cookies in your browser settings; blocking essentials may break sign-in or ticket access.",
      "You can clear preferences at any time - filters and saved city data will reset.",
      "Opt out of non-essential analytics where offered; we keep them minimal by default.",
    ],
  },
  {
    title: "Local storage & app data",
    bullets: [
      "We may cache small, non-sensitive items (like recently viewed events) to speed up navigation.",
      "Payment details are never stored in local storage; processors handle them directly.",
    ],
  },
  {
    title: "Changes & contact",
    bullets: [
      "We will update this policy if our use of cookies changes and adjust the date below.",
      "Questions? Email support@meda.app with 'Cookie policy' in the subject.",
    ],
  },
];

export default function CookiePolicyPage() {
  return (
    <PageShell containerClassName="mx-auto flex max-w-5xl flex-col gap-8 px-4 py-10 sm:py-12">
      <section className="glass-card space-y-3 rounded-3xl border border-[var(--color-border)] bg-[rgba(10,24,38,0.86)] p-6 sm:p-8">
        <p className="heading-kicker">Cookie Policy</p>
        <h1 className="text-3xl font-bold text-white sm:text-4xl">
          How Meda uses cookies and local storage
        </h1>
        <p className="max-w-3xl text-sm leading-relaxed text-[var(--color-text-secondary)] sm:text-base">
          Cookies help us keep you signed in, validate tickets, and measure
          performance so matches stay reliable. We keep them purposeful and
          minimal.
        </p>
        <p className="text-xs text-[var(--color-text-muted)]">
          Last updated: March 10, 2026
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
          </article>
        ))}
      </section>

      <section className="glass-card space-y-3 rounded-3xl border border-[var(--color-border)] bg-[var(--color-surface-2)] p-6">
        <h2 className="text-xl font-semibold text-white">Related policies</h2>
        <p className="text-sm text-[var(--color-text-secondary)]">
          Read our{" "}
          <Link
            href="/privacy"
            className="text-[var(--color-brand)] underline-offset-4 hover:underline"
          >
            Privacy Policy
          </Link>{" "}
          and{" "}
          <Link
            href="/terms"
            className="text-[var(--color-brand)] underline-offset-4 hover:underline"
          >
            Terms &amp; Conditions
          </Link>{" "}
          for details on data handling, tickets, and refunds.
        </p>
      </section>
    </PageShell>
  );
}
