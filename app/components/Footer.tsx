/**
 * Footer -- site footer with product links, legal links, and support links.
 */

import Link from "next/link";
import Image from "next/image";

const productLinks = [
  { href: "/play",    label: "Play" },
  { href: "/tickets", label: "Tickets" },
  { href: "/host",    label: "Host" },
  { href: "/profile", label: "Profile" },
];

const companyLinks = [
  { href: "/about",         label: "About Meda" },
  { href: "/create-events", label: "Create a match" },
];

const legalLinks = [
  { href: "/privacy",       label: "Privacy policy" },
  { href: "/terms",         label: "Terms & conditions" },
  { href: "/cookie-policy", label: "Cookie policy" },
  { href: "/site-map",      label: "Sitemap" },
];

const supportLinks = [
  { href: "/help",                  label: "Help center" },
  { href: "mailto:support@meda.app", label: "support@meda.app" },
];

export default function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="relative mt-16 border-t border-[var(--color-border)]" style={{ background: "var(--footer-bg)" }}>
      {/* Subtle glows */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute left-0 top-0 h-52 w-52 rounded-full bg-[rgba(74,222,128,0.08)] blur-3xl" />
        <div className="absolute bottom-0 right-10 h-60 w-60 rounded-full bg-[rgba(56,189,248,0.06)] blur-3xl" />
      </div>

      <div className="page-container relative space-y-8 pb-[calc(var(--bottom-nav-height)+var(--space-6)+env(safe-area-inset-bottom,0px))] pt-10 md:space-y-10 md:pb-12 md:pt-16">
        <div className="grid gap-8 lg:grid-cols-[1.15fr_1fr] lg:gap-12">
          {/* Brand column */}
          <div className="space-y-5">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-[rgba(74,222,128,0.2)] bg-[rgba(74,222,128,0.08)]">
                <Image
                  src="/logo-White.svg"
                  alt="Meda"
                  width={32}
                  height={32}
                  className="h-7 w-7"
                />
              </div>
              <div>
                <p className="text-base font-bold tracking-[-0.03em] text-[var(--color-text-primary)]">
                  Meda
                </p>
                <p className="text-xs text-[var(--color-text-muted)]">
                  Play, tickets, and hosting in one place.
                </p>
              </div>
            </div>

            <p className="max-w-2xl text-sm leading-[1.8] text-[var(--color-text-secondary)]">
              Built for pickup football in Ethiopia — easier match discovery, clearer ticket
              flows, simpler hosting tools, and payments that make sense the first time you use them.
            </p>

            <div className="flex flex-wrap gap-2 text-xs text-[var(--color-text-muted)]">
              <span className="rounded-full border border-[var(--color-border)] bg-[var(--color-control-bg)] px-3 py-1.5">
                Addis Ababa, built for Ethiopia
              </span>
              <span className="rounded-full border border-[var(--color-border)] bg-[var(--color-control-bg)] px-3 py-1.5">
                support@meda.app
              </span>
            </div>
          </div>

          {/* Links grid */}
          <div className="grid gap-6 sm:grid-cols-2 sm:gap-8">
            <FooterColumn title="Product" links={productLinks} />
            <FooterColumn title="Company" links={companyLinks} />
            <FooterColumn title="Support" links={supportLinks} />
            <FooterColumn title="Legal" links={legalLinks} />
          </div>
        </div>

        <div className="soft-divider" />

        <div className="flex flex-col gap-4 text-xs text-[var(--color-text-muted)] md:flex-row md:items-center md:justify-between">
          <p>&copy; {year} Meda. All rights reserved.</p>
          <div className="flex flex-wrap gap-2">
            <span className="rounded-full border border-[rgba(74,222,128,0.22)] bg-[rgba(74,222,128,0.08)] px-3 py-1 font-semibold text-[var(--color-brand)]">
              Secure payments
            </span>
            <span className="rounded-full border border-[rgba(125,211,252,0.2)] bg-[rgba(125,211,252,0.07)] px-3 py-1 font-semibold text-[var(--color-brand-alt)]">
              Built for night games
            </span>
          </div>
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
      <p className="heading-kicker">{title}</p>
      <ul className="space-y-2.5 text-sm text-[var(--color-text-secondary)]">
        {links.map((link) => (
          <li key={link.href}>
            {link.href.startsWith("mailto:") ? (
              <a
                href={link.href}
                className="transition hover:text-[var(--color-brand)]"
              >
                {link.label}
              </a>
            ) : (
              <Link
                href={link.href}
                className="transition hover:text-[var(--color-brand)]"
              >
                {link.label}
              </Link>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
