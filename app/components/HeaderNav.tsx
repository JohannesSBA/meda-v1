/**
 * HeaderNav -- main navigation bar with logo, links, and auth state.
 *
 * Shows UserButton when signed in; sign-in when signed out.
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
        // Ignore balance failures in chrome.
      }
    };

    void load();
  }, [isLoggedIn]);

  useEffect(() => {
    if (!mobileMenuOpen) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [mobileMenuOpen]);

  const desktopLinks = useMemo(() => {
    return filterNavItems(primaryDesktopNav, { isLoggedIn, isPitchOwner });
  }, [isLoggedIn, isPitchOwner]);

  const mobileTabs = useMemo(
    () =>
      filterNavItems(primaryMobileNav, { isLoggedIn, isPitchOwner }).map((tab) => ({
        ...tab,
        icon: bottomTabIcons[tab.href] ?? SearchIcon,
      })),
    [isLoggedIn, isPitchOwner],
  );
  const showBottomNav = mobileTabs.length > 1;

  const isTabActive = (href: string) => {
    return isNavPathActive(pathname, href);
  };

  const desktopLinkClasses = (href: string) => {
    const active = isTabActive(href);
    return cn(
      "rounded-full px-4 py-2 text-sm font-medium tracking-[-0.01em] transition",
      active
        ? "border border-[rgba(125,211,252,0.22)] bg-[var(--color-accent-soft)] text-[var(--color-text-primary)]"
        : "text-[var(--color-text-secondary)] hover:bg-[var(--color-control-bg-hover)] hover:text-[var(--color-text-primary)]",
    );
  };

  return (
    <>
      <a
        href="#main-content"
        className="sr-only z-[80] rounded-md bg-[var(--color-brand)] px-4 py-2 text-sm font-semibold text-[var(--color-brand-text)] focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
      >
        Skip to main content
      </a>

      <header className="fixed inset-x-0 top-0 z-50 pt-[calc(env(safe-area-inset-top,0px)+8px)]">
        <div className="site-container">
          <div className="surface-card flex min-h-[56px] items-center justify-between gap-3 rounded-[26px] px-2.5 py-2 sm:min-h-[60px] sm:gap-4 sm:px-4">
            <div className="flex min-w-0 items-center gap-3 sm:gap-5">
              <Link href="/" className="flex items-center gap-3 text-[var(--color-text-primary)]">
                <Image
                  src="/logo-White.svg"
                  alt="Meda"
                  width={42}
                  height={42}
                  className="h-9 w-9 shrink-0 sm:h-10 sm:w-10"
                />
                <div className="hidden min-w-0 md:block">
                  <p className="text-sm font-semibold tracking-[-0.02em]">Meda</p>
                  <p className="text-xs text-[var(--color-text-muted)]">Play, tickets, and hosting</p>
                </div>
              </Link>

              <nav className="hidden items-center gap-1 lg:flex">
                {desktopLinks.map((link) => (
                  <Link key={link.href} href={link.href} className={desktopLinkClasses(link.href)}>
                    {link.label}
                  </Link>
                ))}
              </nav>
            </div>

            <div className="flex items-center gap-2 sm:gap-3">
              {balance != null ? (
                <Link
                  href="/profile"
                  className="hidden items-center gap-1.5 rounded-full border border-[rgba(125,211,252,0.24)] bg-[var(--color-accent-soft)] px-3 py-2 text-xs font-semibold text-[var(--color-text-primary)] md:inline-flex"
                >
                  <WalletIcon className="h-4 w-4 text-[var(--color-brand)]" />
                  <span>ETB {balance.toFixed(2)}</span>
                </Link>
              ) : null}

              <button
                type="button"
                className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-[var(--color-border)] bg-[var(--color-control-bg)] text-[var(--color-text-primary)] lg:hidden"
                onClick={() => setMobileMenuOpen(true)}
                aria-label="Open menu"
                aria-expanded={mobileMenuOpen}
                aria-controls="mobile-menu-sheet"
              >
                <MenuIcon className="h-5 w-5" />
              </button>

              <SignedIn>
                <div className="hidden rounded-full border border-[var(--color-border-strong)] bg-[var(--color-control-bg)] p-1 lg:block">
                  <UserButton size="icon" className="text-[var(--color-text-primary)]" />
                </div>
              </SignedIn>
              <SignedOut>
                <Link
                  href="/auth/sign-in"
                  className={cn(buttonVariants("primary", "md"), "hidden rounded-full px-5 sm:inline-flex")}
                >
                  Sign in
                </Link>
              </SignedOut>
            </div>
          </div>
        </div>
      </header>

      {mobileMenuOpen ? (
        <div className="fixed inset-0 z-[70] lg:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-[rgba(2,6,23,0.72)] backdrop-blur-md"
            onClick={() => setMobileMenuOpen(false)}
            aria-label="Close menu"
          />
          <div
            id="mobile-menu-sheet"
            className="mobile-sheet absolute inset-x-0 bottom-0 top-[max(72px,env(safe-area-inset-top,0px)+68px)] overflow-y-auto px-5 pb-[calc(24px+env(safe-area-inset-bottom,0px))] pt-5"
          >
            <div className="mx-auto flex max-w-lg flex-col gap-5">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <p className="heading-kicker">Menu</p>
                  <p className="text-lg font-semibold tracking-[-0.03em] text-[var(--color-text-primary)]">
                    Move around the app without hunting for things.
                  </p>
                </div>
                <button
                  type="button"
                  className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-[var(--color-border)] bg-[var(--color-control-bg)] text-[var(--color-text-primary)]"
                  onClick={() => setMobileMenuOpen(false)}
                  aria-label="Close menu"
                >
                  <CloseIcon className="h-5 w-5" />
                </button>
              </div>

              <div className="surface-card-muted rounded-[24px] p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-[var(--color-text-primary)]">
                      {isLoggedIn ? "Signed in" : "Welcome"}
                    </p>
                    <p className="text-sm text-[var(--color-text-secondary)]">
                      {isLoggedIn
                        ? "Open tickets, host tools, and your balance from here."
                        : "Sign in to see your tickets, bookings, and hosting tools."}
                    </p>
                  </div>
                  {balance != null ? (
                    <span className="rounded-full border border-[rgba(125,211,252,0.24)] bg-[var(--color-accent-soft)] px-3 py-1.5 text-sm font-semibold text-[var(--color-text-primary)]">
                      ETB {balance.toFixed(0)}
                    </span>
                  ) : null}
                </div>
              </div>

              {(isPitchOwner || isAdmin) ? (
                <div className="grid gap-3 rounded-[24px] border border-[var(--color-border)] bg-[var(--color-control-bg)] p-4">
                  <div>
                    <p className="text-sm font-semibold text-[var(--color-text-primary)]">
                      Quick tools
                    </p>
                    <p className="text-sm text-[var(--color-text-secondary)]">
                      Open the workspace that matches what you are trying to do.
                    </p>
                  </div>
                  <div className="grid gap-2">
                    {isPitchOwner ? (
                      <Link
                        href={appRoutes.host}
                        onClick={() => setMobileMenuOpen(false)}
                        className="flex min-h-14 items-center justify-between rounded-[20px] border border-[var(--color-border)] bg-white/[0.03] px-4 py-3 text-left"
                      >
                        <span>
                          <span className="block text-base font-semibold text-[var(--color-text-primary)]">
                            Host
                          </span>
                          <span className="block text-sm text-[var(--color-text-secondary)]">
                            Places, booking times, people, and money
                          </span>
                        </span>
                        <ChevronRightIcon className="h-5 w-5 text-[var(--color-text-secondary)]" />
                      </Link>
                    ) : null}
                    {isAdmin ? (
                      <Link
                        href={appRoutes.admin}
                        onClick={() => setMobileMenuOpen(false)}
                        className="flex min-h-14 items-center justify-between rounded-[20px] border border-[var(--color-border)] bg-white/[0.03] px-4 py-3 text-left"
                      >
                        <span>
                          <span className="block text-base font-semibold text-[var(--color-text-primary)]">
                            Admin
                          </span>
                          <span className="block text-sm text-[var(--color-text-secondary)]">
                            Users, billing, stats, and moderation
                          </span>
                        </span>
                        <ChevronRightIcon className="h-5 w-5 text-[var(--color-text-secondary)]" />
                      </Link>
                    ) : null}
                  </div>
                </div>
              ) : null}

              <nav className="grid gap-3" aria-label="Mobile menu">
                {desktopLinks.map((link) => {
                  const active = isTabActive(link.href);
                  return (
                    <Link
                      key={link.href}
                      href={link.href}
                      onClick={() => setMobileMenuOpen(false)}
                      className={cn(
                        "flex min-h-14 items-center justify-between rounded-[22px] border px-4 py-3 text-left",
                        active
                          ? "border-[rgba(125,211,252,0.3)] bg-[var(--color-accent-soft)] text-[var(--color-text-primary)]"
                          : "border-[var(--color-border)] bg-[var(--color-control-bg)] text-[var(--color-text-secondary)]",
                      )}
                    >
                      <span className="text-base font-semibold">{link.label}</span>
                      <ChevronRightIcon className="h-5 w-5" />
                    </Link>
                  );
                })}
                {isPitchOwner ? (
                  <Link
                    href={appRoutes.createMatch}
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex min-h-14 items-center justify-between rounded-[22px] border border-[var(--color-border)] bg-[var(--color-control-bg)] px-4 py-3 text-left text-[var(--color-text-secondary)]"
                  >
                    <span>
                      <span className="block text-base font-semibold text-[var(--color-text-primary)]">
                        Create match
                      </span>
                      <span className="block text-sm">Optional event flow for hosts</span>
                    </span>
                    <ChevronRightIcon className="h-5 w-5" />
                  </Link>
                ) : null}
              </nav>

              <div className="grid gap-3 rounded-[24px] border border-[var(--color-border)] bg-[var(--color-control-bg)] p-4 text-sm text-[var(--color-text-secondary)]">
                <Link href="/help" className="font-medium text-[var(--color-text-primary)]">
                  Help center
                </Link>
                <Link
                  href="/site-map"
                  onClick={() => setMobileMenuOpen(false)}
                  className="font-medium text-[var(--color-text-primary)]"
                >
                  Browse all pages
                </Link>
                <a href="mailto:support@meda.app" className="font-medium text-[var(--color-text-primary)]">
                  support@meda.app
                </a>
              </div>

              <SignedOut>
                <Link
                  href="/auth/sign-in"
                  onClick={() => setMobileMenuOpen(false)}
                  className={cn(buttonVariants("primary", "md"), "w-full rounded-full")}
                >
                  Sign in
                </Link>
              </SignedOut>
              <SignedIn>
                <div className="surface-card-muted rounded-[24px] p-3">
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

      {showBottomNav ? (
        <nav
          className="fixed bottom-[max(10px,env(safe-area-inset-bottom,0px))] left-1/2 z-50 w-[calc(100%-20px)] max-w-sm -translate-x-1/2 md:hidden"
          aria-label="Primary"
        >
          <div
            className="surface-card grid items-stretch rounded-[22px] px-1.5 py-1.5"
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
                    "relative flex min-w-0 flex-col items-center justify-center gap-1 rounded-[16px] px-2 py-2.5 text-[0.7rem] font-semibold transition",
                    active
                      ? "bg-[var(--color-accent-soft)] text-[var(--color-text-primary)]"
                      : "text-[var(--color-text-secondary)] hover:bg-[var(--color-control-bg-hover)] hover:text-[var(--color-text-primary)]",
                  )}
                >
                  <Icon className={cn("h-5 w-5", active && "text-[var(--color-brand)]")} />
                  <span className="truncate">{tab.label}</span>
                  {active ? (
                    <span className="absolute inset-x-3 bottom-0 h-0.5 rounded-full bg-[var(--color-brand)]" />
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

function SearchIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}

function PlusIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

function TicketIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M2 9a3 3 0 0 1 3-3h14a3 3 0 0 1 3 3v0a3 3 0 0 1-3 3v0a3 3 0 0 1-3 3H5a3 3 0 0 1-3-3v0z" />
      <path d="M13 6v12" />
    </svg>
  );
}

function UserIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

function WalletIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 7.5A2.5 2.5 0 0 1 5.5 5H19a2 2 0 0 1 2 2v2H5.5A2.5 2.5 0 0 0 3 11.5v-4Z" />
      <path d="M3 11.5A2.5 2.5 0 0 1 5.5 9H21v8a2 2 0 0 1-2 2H5.5A2.5 2.5 0 0 1 3 16.5v-5Z" />
      <circle cx="16" cy="14" r="1" />
    </svg>
  );
}

function MenuIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="4" y1="7" x2="20" y2="7" />
      <line x1="4" y1="12" x2="20" y2="12" />
      <line x1="4" y1="17" x2="20" y2="17" />
    </svg>
  );
}

function CloseIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

function ChevronRightIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}
