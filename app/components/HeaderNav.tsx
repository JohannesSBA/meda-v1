/**
 * HeaderNav -- main navigation bar with logo, links, and auth state.
 */

"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { UserButton, SignedIn, SignedOut } from "@neondatabase/auth/react";
import Image from "next/image";
import { authClient } from "@/lib/auth/client";
import { buttonVariants } from "@/app/components/ui/button";
import { cn } from "@/app/components/ui/cn";
import { browserApi } from "@/lib/browserApi";
import {
  appRoutes,
  filterNavItems,
  isNavPathActive,
  primaryDesktopNav,
  primaryMobileNav,
} from "@/lib/navigation";

type SessionPayload = ReturnType<typeof authClient.useSession>["data"];

type HeaderNavProps = {
  initialSession?: SessionPayload | null;
};

type BottomTab = {
  href: string;
  label: string;
  icon: (props: { className?: string }) => React.JSX.Element;
};

const bottomTabIcons: Record<string, BottomTab["icon"]> = {
  [appRoutes.play]: SearchIcon,
  [appRoutes.tickets]: TicketIcon,
  [appRoutes.host]: PlusIcon,
  [appRoutes.profile]: UserIcon,
};

export default function HeaderNav({ initialSession = null }: HeaderNavProps) {
  const { data: clientSession } = authClient.useSession();
  const session = clientSession ?? initialSession ?? null;

  const isLoggedIn = Boolean(session?.user);
  const isPitchOwner = session?.user?.role === "pitch_owner";
  const isAdmin = session?.user?.role === "admin";
  const pathname = usePathname();
  const [balance, setBalance] = useState<number | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    if (!isLoggedIn) return;
    const load = async () => {
      try {
        const data = await browserApi.get<{ balanceEtb?: number }>("/api/profile/balance", {
          cache: "no-store",
        });
        const nextBalance = Number(data.balanceEtb) || 0;
        setBalance(nextBalance > 0 ? nextBalance : null);
      } catch {
        // Ignore balance failures silently.
      }
    };
    void load();
  }, [isLoggedIn]);

  useEffect(() => {
    if (!mobileMenuOpen) return;
    const orig = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = orig; };
  }, [mobileMenuOpen]);

  const desktopLinks = useMemo(
    () => filterNavItems(primaryDesktopNav, { isLoggedIn, isPitchOwner }),
    [isLoggedIn, isPitchOwner],
  );

  const mobileTabs = useMemo(
    () =>
      filterNavItems(primaryMobileNav, { isLoggedIn, isPitchOwner }).map((tab) => ({
        ...tab,
        icon: bottomTabIcons[tab.href] ?? SearchIcon,
      })),
    [isLoggedIn, isPitchOwner],
  );
  const showBottomNav = mobileTabs.length > 1;

  const isTabActive = (href: string) => isNavPathActive(pathname, href);

  const desktopLinkClass = (href: string) => {
    const active = isTabActive(href);
    return cn(
      "rounded-full px-4 py-2 text-sm font-medium tracking-[-0.01em] transition",
      active
        ? "border border-[rgba(74,222,128,0.3)] bg-[var(--color-accent-soft)] text-[var(--color-text-primary)]"
        : "text-[var(--color-text-secondary)] hover:bg-[var(--color-control-bg-hover)] hover:text-[var(--color-text-primary)]",
    );
  };

  return (
    <>
      {/* Skip link */}
      <a
        href="#main-content"
        className="sr-only z-[80] rounded-md bg-[var(--color-brand)] px-4 py-2 text-sm font-semibold text-[var(--color-brand-text)] focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
      >
        Skip to main content
      </a>

      {/* ── Header bar ──────────────────────────────── */}
      <header className="fixed inset-x-0 top-0 z-50 pt-[calc(env(safe-area-inset-top,0px)+8px)]">
        <div className="site-container">
          <div className="surface-card flex min-h-[58px] items-center justify-between gap-3 rounded-[28px] px-2.5 py-2 sm:min-h-[62px] sm:gap-4 sm:px-3.5">
            {/* Logo + desktop nav */}
            <div className="flex min-w-0 items-center gap-2 sm:gap-4">
              <Link
                href="/"
                className="flex items-center gap-2.5 text-[var(--color-text-primary)] sm:gap-3"
              >
                <Image
                  src="/logo-White.svg"
                  alt="Meda"
                  width={40}
                  height={40}
                  className="h-8 w-8 shrink-0 sm:h-9 sm:w-9"
                />
                <div className="hidden min-w-0 md:block">
                  <p className="text-sm font-bold tracking-[-0.03em]">Meda</p>
                  <p className="text-[0.72rem] text-[var(--color-text-muted)]">
                    Play, tickets & hosting
                  </p>
                </div>
              </Link>

              <nav className="hidden items-center gap-0.5 lg:flex">
                {desktopLinks.map((link) => (
                  <Link key={link.href} href={link.href} className={desktopLinkClass(link.href)}>
                    {link.label}
                  </Link>
                ))}
              </nav>
            </div>

            {/* Right side */}
            <div className="flex items-center gap-2 sm:gap-2.5">
              {balance != null ? (
                <Link
                  href="/profile"
                  className="hidden items-center gap-1.5 rounded-full border border-[rgba(74,222,128,0.3)] bg-[var(--color-accent-soft)] px-3 py-2 text-xs font-bold text-[var(--color-text-primary)] transition hover:border-[rgba(74,222,128,0.5)] hover:bg-[rgba(74,222,128,0.18)] md:inline-flex"
                >
                  <WalletIcon className="h-3.5 w-3.5 text-[var(--color-brand)]" />
                  ETB {balance.toFixed(2)}
                </Link>
              ) : null}

              {/* Mobile menu trigger */}
              <button
                type="button"
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[var(--color-border)] bg-[var(--color-control-bg)] text-[var(--color-text-primary)] transition hover:bg-[var(--color-control-bg-hover)] lg:hidden"
                onClick={() => setMobileMenuOpen(true)}
                aria-label="Open menu"
                aria-expanded={mobileMenuOpen}
                aria-controls="mobile-menu-sheet"
              >
                <MenuIcon className="h-4.5 w-4.5" />
              </button>

              <SignedIn>
                <div className="hidden rounded-full border border-[var(--color-border-strong)] bg-[var(--color-control-bg)] p-1 lg:block">
                  <UserButton size="icon" className="text-[var(--color-text-primary)]" />
                </div>
              </SignedIn>
              <SignedOut>
                <Link
                  href="/auth/sign-in"
                  className={cn(
                    buttonVariants("primary", "md"),
                    "hidden rounded-full px-5 sm:inline-flex",
                  )}
                >
                  Sign in
                </Link>
              </SignedOut>
            </div>
          </div>
        </div>
      </header>

      {/* ── Mobile full-screen menu ──────────────────── */}
      {mobileMenuOpen ? (
        <div className="fixed inset-0 z-[70] lg:hidden">
          {/* Backdrop */}
          <button
            type="button"
            className="absolute inset-0 bg-[rgba(2,5,14,0.76)] backdrop-blur-lg"
            onClick={() => setMobileMenuOpen(false)}
            aria-label="Close menu"
          />

          <div
            id="mobile-menu-sheet"
            className="mobile-sheet absolute inset-x-0 bottom-0 top-[max(74px,env(safe-area-inset-top,0px)+70px)] overflow-y-auto px-5 pb-[calc(28px+env(safe-area-inset-bottom,0px))] pt-6"
          >
            <div className="mx-auto flex max-w-lg flex-col gap-4">
              {/* Header row */}
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-0.5">
                  <p className="heading-kicker">Menu</p>
                  <p className="text-lg font-bold tracking-[-0.04em] text-[var(--color-text-primary)]">
                    Where do you want to go?
                  </p>
                </div>
                <button
                  type="button"
                  className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[var(--color-border)] bg-[var(--color-control-bg)] text-[var(--color-text-primary)] transition hover:bg-[var(--color-control-bg-hover)]"
                  onClick={() => setMobileMenuOpen(false)}
                  aria-label="Close menu"
                >
                  <CloseIcon className="h-4 w-4" />
                </button>
              </div>

              {/* Auth / balance strip */}
              <div className="surface-card-muted rounded-[18px] p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm text-[var(--color-text-secondary)]">
                    {isLoggedIn
                      ? "Open tickets, host tools, and your balance from here."
                      : "Sign in to see your tickets, bookings, and hosting tools."}
                  </p>
                  {balance != null ? (
                    <span className="shrink-0 rounded-full border border-[rgba(74,222,128,0.3)] bg-[var(--color-accent-soft)] px-3 py-1.5 text-sm font-bold text-[var(--color-text-primary)]">
                      ETB {balance.toFixed(0)}
                    </span>
                  ) : null}
                </div>
              </div>

              {/* Quick tools for owners/admins */}
              {(isPitchOwner || isAdmin) ? (
                <div className="rounded-[18px] border border-[var(--color-border)] bg-[var(--color-control-bg)] p-4">
                  <p className="mb-3 text-sm font-bold text-[var(--color-text-primary)]">
                    Quick tools
                  </p>
                  <div className="grid gap-2">
                    {isPitchOwner ? (
                      <MenuRow
                        href={appRoutes.host}
                        label="Host"
                        sub="Pitches, booking times, people, and money"
                        onClose={() => setMobileMenuOpen(false)}
                      />
                    ) : null}
                    {isAdmin ? (
                      <MenuRow
                        href={appRoutes.admin}
                        label="Admin"
                        sub="Users, billing, stats, and moderation"
                        onClose={() => setMobileMenuOpen(false)}
                      />
                    ) : null}
                  </div>
                </div>
              ) : null}

              {/* Main nav links */}
              <nav className="grid gap-2" aria-label="Mobile navigation">
                {desktopLinks.map((link) => {
                  const active = isTabActive(link.href);
                  return (
                    <Link
                      key={link.href}
                      href={link.href}
                      onClick={() => setMobileMenuOpen(false)}
                      className={cn(
                        "flex min-h-[52px] items-center justify-between rounded-[18px] border px-4 py-3 text-left transition",
                        active
                          ? "border-[rgba(74,222,128,0.35)] bg-[var(--color-accent-soft)] text-[var(--color-text-primary)]"
                          : "border-[var(--color-border)] bg-[var(--color-control-bg)] text-[var(--color-text-secondary)] hover:border-[rgba(74,222,128,0.2)] hover:text-[var(--color-text-primary)]",
                      )}
                    >
                      <span className="text-[0.95rem] font-semibold">{link.label}</span>
                      <ChevronRightIcon className="h-4 w-4 opacity-50" />
                    </Link>
                  );
                })}
                {isPitchOwner ? (
                  <Link
                    href={appRoutes.createMatch}
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex min-h-[52px] items-center justify-between rounded-[18px] border border-[var(--color-border)] bg-[var(--color-control-bg)] px-4 py-3 text-left transition hover:border-[rgba(74,222,128,0.2)] hover:text-[var(--color-text-primary)]"
                  >
                    <span>
                      <span className="block text-[0.95rem] font-semibold text-[var(--color-text-primary)]">
                        Create match
                      </span>
                      <span className="block text-xs text-[var(--color-text-muted)]">
                        Optional event flow for hosts
                      </span>
                    </span>
                    <ChevronRightIcon className="h-4 w-4 opacity-50" />
                  </Link>
                ) : null}
              </nav>

              {/* Support links */}
              <div className="rounded-[18px] border border-[var(--color-border)] bg-[var(--color-control-bg)] p-4">
                <p className="mb-2.5 text-xs font-bold uppercase tracking-[0.15em] text-[var(--color-text-muted)]">
                  Support
                </p>
                <div className="grid gap-2.5 text-sm font-medium text-[var(--color-text-primary)]">
                  <Link href="/help" className="transition hover:text-[var(--color-brand)]">
                    Help center
                  </Link>
                  <Link
                    href="/site-map"
                    onClick={() => setMobileMenuOpen(false)}
                    className="transition hover:text-[var(--color-brand)]"
                  >
                    Browse all pages
                  </Link>
                  <a
                    href="mailto:support@meda.app"
                    className="transition hover:text-[var(--color-brand)]"
                  >
                    support@meda.app
                  </a>
                </div>
              </div>

              <SignedOut>
                <Link
                  href="/auth/sign-in"
                  onClick={() => setMobileMenuOpen(false)}
                  className={cn(buttonVariants("primary", "lg"), "w-full rounded-full")}
                >
                  Sign in
                </Link>
              </SignedOut>
              <SignedIn>
                <div className="surface-card-muted rounded-[18px] p-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm text-[var(--color-text-secondary)]">
                      Open your account menu for profile and sign-out.
                    </p>
                    <div className="rounded-full border border-[var(--color-border-strong)] bg-[var(--color-control-bg)] p-1">
                      <UserButton size="icon" className="text-[var(--color-text-primary)]" />
                    </div>
                  </div>
                </div>
              </SignedIn>
            </div>
          </div>
        </div>
      ) : null}

      {/* ── Mobile bottom tab bar ────────────────────── */}
      {showBottomNav ? (
        <nav
          className="fixed bottom-[max(10px,env(safe-area-inset-bottom,0px))] left-1/2 z-50 w-[calc(100%-24px)] max-w-sm -translate-x-1/2 md:hidden"
          aria-label="Primary"
        >
          <div
            className="surface-card grid items-stretch rounded-[24px] px-1.5 py-1.5"
            style={{ gridTemplateColumns: `repeat(${mobileTabs.length}, minmax(0, 1fr))` }}
          >
            {mobileTabs.map((tab) => {
              const active = isTabActive(tab.href);
              const Icon = tab.icon;
              return (
                <Link
                  key={tab.href}
                  href={tab.href}
                  className={cn(
                    "relative flex min-w-0 flex-col items-center justify-center gap-1 rounded-[18px] px-2 py-2.5 text-[0.68rem] font-semibold transition",
                    active
                      ? "bg-[var(--color-accent-soft)] text-[var(--color-text-primary)]"
                      : "text-[var(--color-text-secondary)] hover:bg-[var(--color-control-bg-hover)] hover:text-[var(--color-text-primary)]",
                  )}
                >
                  <Icon
                    className={cn("h-[18px] w-[18px]", active && "text-[var(--color-brand)]")}
                  />
                  <span className="truncate">{tab.label}</span>
                  {active ? (
                    <span className="absolute inset-x-4 bottom-0.5 h-0.5 rounded-full bg-[var(--color-brand)]" />
                  ) : null}
                </Link>
              );
            })}
          </div>
        </nav>
      ) : null}
    </>
  );
}

/* ── Helper components ──────────────────────────────────── */

function MenuRow({
  href,
  label,
  sub,
  onClose,
}: {
  href: string;
  label: string;
  sub: string;
  onClose: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onClose}
      className="flex min-h-[52px] items-center justify-between rounded-[16px] border border-[var(--color-border)] bg-white/[0.03] px-4 py-3 text-left transition hover:border-[rgba(74,222,128,0.25)]"
    >
      <span>
        <span className="block text-[0.95rem] font-semibold text-[var(--color-text-primary)]">
          {label}
        </span>
        <span className="block text-xs text-[var(--color-text-secondary)]">{sub}</span>
      </span>
      <ChevronRightIcon className="h-4 w-4 text-[var(--color-text-secondary)]" />
    </Link>
  );
}

/* ── Icons ──────────────────────────────────────────────── */

function SearchIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}

function PlusIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

function TicketIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 9a3 3 0 0 1 3-3h14a3 3 0 0 1 3 3v0a3 3 0 0 1-3 3v0a3 3 0 0 1-3 3H5a3 3 0 0 1-3-3v0z" />
      <path d="M13 6v12" />
    </svg>
  );
}

function UserIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

function WalletIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 7.5A2.5 2.5 0 0 1 5.5 5H19a2 2 0 0 1 2 2v2H5.5A2.5 2.5 0 0 0 3 11.5v-4Z" />
      <path d="M3 11.5A2.5 2.5 0 0 1 5.5 9H21v8a2 2 0 0 1-2 2H5.5A2.5 2.5 0 0 1 3 16.5v-5Z" />
      <circle cx="16" cy="14" r="1" />
    </svg>
  );
}

function MenuIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="4" y1="7" x2="20" y2="7" />
      <line x1="4" y1="12" x2="20" y2="12" />
      <line x1="4" y1="17" x2="20" y2="17" />
    </svg>
  );
}

function CloseIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

function ChevronRightIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}
