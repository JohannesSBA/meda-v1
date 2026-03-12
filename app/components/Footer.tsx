/**
 * Footer -- site footer with product links, legal links, and social links.
 */

import Link from "next/link";
import Image from "next/image";

const productLinks = [
  { href: "/events", label: "Browse events" },
  { href: "/create-events", label: "Create an event" },
  { href: "/my-tickets", label: "My tickets" },
  { href: "/profile", label: "Profile" },
];

const companyLinks = [
  { href: "/about", label: "About Meda" },
  { href: "/create-events", label: "Host with us" },
];

const legalLinks = [
  { href: "/privacy", label: "Privacy policy" },
  { href: "/terms", label: "Terms & conditions" },
  { href: "/cookie-policy", label: "Cookie policy" },
  { href: "/site-map", label: "Sitemap" },
];

const supportLinks = [
  { href: "/help", label: "Help center" },
  { href: "mailto:support@meda.app", label: "support@meda.app" },
];

export default function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="relative mt-12 border-t border-[var(--color-border)] bg-[rgba(6,14,25,0.9)] backdrop-blur">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-20 top-0 h-48 w-48 rounded-full bg-[#00e5ff1a] blur-3xl" />
        <div className="absolute right-12 -bottom-10 h-52 w-52 rounded-full bg-[#22ff8820] blur-3xl" />
      </div>

      <div className="page-container relative space-y-8 px-4 py-10 pb-[calc(var(--bottom-nav-height)+1.5rem+env(safe-area-inset-bottom,0px))] md:pb-12">
        <div className="grid gap-8 lg:grid-cols-[1.2fr_1fr]">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <Image src="/logo-White.svg" alt="Meda" width={42} height={42} />
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.14em] text-[var(--color-brand)]">
                  Meda
                </p>
                <p className="text-sm text-[var(--color-text-muted)]">
                  Football, payments, and community in one experience.
                </p>
              </div>
            </div>
            <p className="max-w-xl text-sm leading-relaxed text-[var(--color-text-secondary)]">
              We obsess over reliable pick-up play: clearer commitments for players, safer hosting
              for organizers, and transparent flows for every ETB that moves through the pitch.
            </p>
            <div className="flex flex-wrap gap-3 text-sm text-[var(--color-text-muted)]">
              <span className="rounded-full border border-[var(--color-border)] px-3 py-1.5">
                Addis Ababa, built for Ethiopia
              </span>
              <span className="rounded-full border border-[var(--color-border)] px-3 py-1.5">
                Support: support@meda.app
              </span>
            </div>
          </div>

          <div className="grid gap-6 sm:grid-cols-2">
            <FooterColumn title="Product" links={productLinks} />
            <FooterColumn title="Company" links={companyLinks} />
            <FooterColumn title="Support" links={supportLinks} />
            <FooterColumn title="Legal" links={legalLinks} />
          </div>
        </div>

        <div className="flex flex-col gap-3 border-t border-[var(--color-border)] pt-6 text-sm text-[var(--color-text-muted)] sm:flex-row sm:items-center sm:justify-between">
          <p>(c) {year} Meda. All rights reserved.</p>
          <p className="flex flex-wrap gap-2">
            <span className="rounded-full bg-[var(--color-surface-2)] px-3 py-1 text-xs font-semibold text-[var(--color-brand)]">
              Secure payments
            </span>
            <span className="rounded-full bg-[var(--color-surface-2)] px-3 py-1 text-xs font-semibold text-[var(--color-brand-alt)]">
              Built for night games
            </span>
          </p>
        </div>
      </div>
    </footer>
  );
}

type FooterColumnProps = {
  title: string;
  links: Array<{ href: string; label: string }>;
};

function FooterColumn({ title, links }: FooterColumnProps) {
  return (
    <div className="space-y-3">
      <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[var(--color-brand)]">
        {title}
      </p>
      <ul className="space-y-2 text-sm text-[var(--color-text-secondary)]">
        {links.map((link) => (
          <li key={link.href}>
            {link.href.startsWith("mailto:") ? (
              <a href={link.href} className="transition hover:text-[var(--color-brand)]">
                {link.label}
              </a>
            ) : (
              <Link href={link.href} className="transition hover:text-[var(--color-brand)]">
                {link.label}
              </Link>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
