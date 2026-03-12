/**
 * Site map page -- links to all main sections of the site.
 */

import type { Metadata } from "next";
import Link from "next/link";
import { PageShell } from "../components/ui/page-shell";

export const metadata: Metadata = {
  title: "Sitemap | Meda",
  description:
    "Explore Meda's key pages for pickup football: events, hosting, account, help, and legal resources.",
};

type LinkGroup = {
  title: string;
  links: { label: string; href: string; note?: string }[];
};

const groups: LinkGroup[] = [
  {
    title: "Core experience",
    links: [
      { label: "Home", href: "/" },
      { label: "Events", href: "/events", note: "Browse upcoming matches" },
      { label: "Create event", href: "/create-events", note: "For hosts and admins" },
      { label: "My events & tickets", href: "/my-tickets", note: "Manage the matches you joined" },
      { label: "Profile", href: "/profile", note: "Update details and see balances" },
    ],
  },
  {
    title: "Support",
    links: [
      { label: "Help center", href: "/help" },
      { label: "Contact support", href: "mailto:support@meda.app", note: "Email" },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "About Meda", href: "/about" },
      { label: "Sitemap", href: "/site-map" },
    ],
  },
  {
    title: "Legal",
    links: [
      { label: "Terms & conditions", href: "/terms" },
      { label: "Privacy policy", href: "/privacy" },
      { label: "Cookie policy", href: "/cookie-policy" },
    ],
  },
  {
    title: "Authentication",
    links: [
      { label: "Sign in", href: "/auth/sign-in" },
      { label: "Sign up", href: "/auth/sign-up" },
    ],
  },
];

export default function SitemapPage() {
  return (
    <PageShell containerClassName="mx-auto flex max-w-5xl flex-col gap-8 px-4 py-10 sm:py-12">
      <section className="glass-card space-y-3 rounded-3xl border border-[var(--color-border)] bg-[rgba(10,24,38,0.86)] p-6 sm:p-8">
        <p className="heading-kicker">Sitemap</p>
        <h1 className="text-3xl font-bold text-white sm:text-4xl">Everything inside Meda</h1>
        <p className="max-w-3xl text-sm leading-relaxed text-[var(--color-text-secondary)] sm:text-base">
          Quick access to every important page - use this map to jump to events, hosting tools, support, and policies.
        </p>
      </section>

      <section className="grid gap-4 sm:grid-cols-2">
        {groups.map((group) => (
          <article
            key={group.title}
            className="glass-card space-y-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5"
          >
            <h2 className="text-lg font-semibold text-white">{group.title}</h2>
            <ul className="space-y-2 text-sm text-[var(--color-text-secondary)]">
              {group.links.map((link) => (
                <li key={link.href} className="flex flex-col">
                  {link.href.startsWith("mailto:") ? (
                    <a href={link.href} className="text-[var(--color-brand)] underline-offset-4 hover:underline">
                      {link.label}
                    </a>
                  ) : (
                    <Link href={link.href} className="text-[var(--color-brand)] underline-offset-4 hover:underline">
                      {link.label}
                    </Link>
                  )}
                  {link.note ? <span className="text-xs text-[var(--color-text-muted)]">{link.note}</span> : null}
                </li>
              ))}
            </ul>
          </article>
        ))}
      </section>
    </PageShell>
  );
}
