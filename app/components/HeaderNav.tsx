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

type SessionPayload = ReturnType<typeof authClient.useSession>["data"];

type HeaderNavProps = {
  initialSession?: SessionPayload | null;
};

type DesktopNavItem = {
  href: string;
  label: string;
  public?: boolean;
  requiresAuth?: boolean;
};

const desktopNavItems: DesktopNavItem[] = [
  { href: "/events", label: "Events", public: true },
  { href: "/my-tickets", label: "My Tickets", requiresAuth: true },
  { href: "/create-events", label: "Create Event", requiresAuth: true },
  { href: "/profile", label: "Profile", requiresAuth: true },
];

type BottomTab = {
  href: string;
  label: string;
  icon: (props: { className?: string }) => React.JSX.Element;
  requiresAuth?: boolean;
};

const bottomTabs: BottomTab[] = [
  { href: "/", label: "Home", icon: HomeIcon },
  { href: "/events", label: "Events", icon: SearchIcon },
  { href: "/create-events", label: "Create", icon: PlusIcon, requiresAuth: true },
  { href: "/my-tickets", label: "Tickets", icon: TicketIcon, requiresAuth: true },
  { href: "/profile", label: "Profile", icon: UserIcon, requiresAuth: true },
];

export default function HeaderNav({ initialSession = null }: HeaderNavProps) {
  const { data: clientSession } = authClient.useSession();
  const session = clientSession ?? initialSession ?? null;

  const isLoggedIn = Boolean(session?.user);
  const pathname = usePathname();
  const [balance, setBalance] = useState<number | null>(null);

  useEffect(() => {
    if (!isLoggedIn) return;
    const load = async () => {
      try {
        const data = await browserApi.get<{ balanceEtb?: number }>(
          "/api/profile/balance",
          { cache: "no-store" },
        );
        const nextBalance = Number(data.balanceEtb) || 0;
        setBalance(nextBalance > 0 ? nextBalance : null);
      } catch {
        // Ignore balance failures in chrome.
      }
    };

    void load();
  }, [isLoggedIn]);

  const desktopLinks = useMemo(
    () =>
      desktopNavItems.filter((item) => {
        if (item.public) return true;
        if (item.requiresAuth && !isLoggedIn) return false;
        return true;
      }),
    [isLoggedIn],
  );

  const mobileTabs = useMemo(
    () => bottomTabs.filter((tab) => !tab.requiresAuth || isLoggedIn),
    [isLoggedIn],
  );

  const isTabActive = (href: string) => {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
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
          <div className="surface-card flex min-h-[60px] items-center justify-between gap-4 rounded-[28px] px-3 py-2 sm:px-4">
            <div className="flex min-w-0 items-center gap-3 sm:gap-5">
              <Link href="/" className="flex items-center gap-3 text-[var(--color-text-primary)]">
                <Image src="/logo-White.svg" alt="Meda" width={42} height={42} className="h-10 w-10 shrink-0" />
                <div className="hidden min-w-0 sm:block">
                  <p className="text-sm font-semibold tracking-[-0.02em]">Meda</p>
                  <p className="text-xs text-[var(--color-text-muted)]">Football community platform</p>
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
                  className="hidden items-center gap-1.5 rounded-full border border-[rgba(125,211,252,0.24)] bg-[var(--color-accent-soft)] px-3 py-2 text-xs font-semibold text-[var(--color-text-primary)] sm:inline-flex"
                >
                  <WalletIcon className="h-4 w-4 text-[var(--color-brand)]" />
                  <span>ETB {balance.toFixed(2)}</span>
                </Link>
              ) : null}

              <SignedIn>
                <div className="rounded-full border border-[var(--color-border-strong)] bg-[var(--color-control-bg)] p-1">
                  <UserButton size="icon" className="text-[var(--color-text-primary)]" />
                </div>
              </SignedIn>
              <SignedOut>
                <Link href="/auth/sign-in" className={cn(buttonVariants("primary", "md"), "rounded-full px-5")}>
                  Sign in
                </Link>
              </SignedOut>
            </div>
          </div>
        </div>
      </header>

      <nav
        className="fixed bottom-[max(12px,env(safe-area-inset-bottom,0px))] left-1/2 z-50 w-[calc(100%-24px)] max-w-md -translate-x-1/2 md:hidden"
        aria-label="Primary"
      >
        <div className="surface-card flex items-stretch rounded-[24px] px-1.5 py-1.5">
          {mobileTabs.map((tab) => {
            const active = isTabActive(tab.href);
            const Icon = tab.icon;
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={cn(
                  "relative flex min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-[18px] px-2 py-2.5 text-[0.68rem] font-semibold transition",
                  active
                    ? "bg-[var(--color-accent-soft)] text-[var(--color-text-primary)]"
                    : "text-[var(--color-text-secondary)] hover:bg-[var(--color-control-bg-hover)] hover:text-[var(--color-text-primary)]",
                )}
              >
                <Icon className={cn("h-5 w-5", active && "text-[var(--color-brand)]")} />
                <span className="truncate">{tab.label}</span>
                {active ? (
                  <span className="absolute inset-x-4 bottom-0 h-0.5 rounded-full bg-[var(--color-brand)]" />
                ) : null}
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}

function HomeIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  );
}

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
      <rect x="2" y="5" width="20" height="14" rx="2" />
      <path d="M16 14a2 2 0 1 0 0-4 2 2 0 0 0 0 4z" />
    </svg>
  );
}
