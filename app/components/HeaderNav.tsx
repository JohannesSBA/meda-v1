"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { UserButton, SignedIn, SignedOut } from "@neondatabase/auth/react";
import Image from "next/image";
import { authClient } from "@/lib/auth/client";
import { buttonVariants } from "@/app/components/ui/button";
import { cn } from "@/app/components/ui/cn";

type SessionPayload = ReturnType<typeof authClient.useSession>["data"];

type HeaderNavProps = {
  initialSession?: SessionPayload | null;
};

const desktopNavItems = [
  { href: "/events", label: "Events", requiresAdmin: false, public: true },
  { href: "/my-events", label: "My Events", requiresAdmin: false, public: false },
  { href: "/create-events", label: "Create Event", requiresAdmin: true, public: false },
  { href: "/profile", label: "Profile", requiresAdmin: false, public: false },
];

type BottomTab = {
  href: string;
  label: string;
  icon: (props: { className?: string }) => React.JSX.Element;
  requiresAuth?: boolean;
  requiresAdmin?: boolean;
};

const bottomTabs: BottomTab[] = [
  { href: "/", label: "Home", icon: HomeIcon },
  { href: "/events", label: "Events", icon: SearchIcon },
  { href: "/create-events", label: "Create", icon: PlusIcon, requiresAdmin: true },
  { href: "/my-events", label: "My Events", icon: TicketIcon, requiresAuth: true },
  { href: "/profile", label: "Profile", icon: UserIcon, requiresAuth: true },
];

export default function HeaderNav({ initialSession = null }: HeaderNavProps) {
  const { data: clientSession } = authClient.useSession();
  const session = clientSession ?? initialSession ?? null;

  const isLoggedIn = Boolean(session?.user);
  const isAdmin = session?.user?.role === "admin";

  const pathname = usePathname();
  const [balance, setBalance] = useState<number | null>(null);

  useEffect(() => {
    if (!isLoggedIn) return;
    const load = async () => {
      try {
        const res = await fetch("/api/profile/balance", { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json();
        const bal = Number(data.balanceEtb) || 0;
        setBalance(bal > 0 ? bal : null);
      } catch {
        // silently ignore
      }
    };
    void load();
  }, [isLoggedIn]);

  const desktopLinks = useMemo(
    () =>
      desktopNavItems.filter((item) => {
        if (item.public) return true;
        if (!isLoggedIn) return false;
        if (item.requiresAdmin && !isAdmin) return false;
        return true;
      }),
    [isAdmin, isLoggedIn],
  );

  const mobileTabs = useMemo(
    () =>
      bottomTabs.filter((tab) => {
        if (tab.requiresAdmin && !isAdmin) return false;
        if (tab.requiresAuth && !isLoggedIn) return false;
        return true;
      }),
    [isLoggedIn, isAdmin],
  );

  const desktopLinkClasses = (href: string) => {
    const isActive = pathname === href;
    return `rounded-lg px-3 py-2 text-sm font-medium transition ${
      isActive
        ? "bg-[var(--color-surface-2)] text-[var(--color-text-primary)]"
        : "text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-2)] hover:text-[var(--color-text-primary)]"
    }`;
  };

  const isTabActive = (href: string) => {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  };

  return (
    <>
      <a
        href="#main-content"
        className="sr-only z-[60] rounded-md bg-[var(--color-brand)] px-4 py-2 text-sm font-semibold text-[var(--color-brand-text)] focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
      >
        Skip to main content
      </a>

      {/* Top header bar */}
      <header className="fixed left-0 right-0 top-0 z-50 bg-[rgba(5,13,23,0.82)] pt-[env(safe-area-inset-top)] backdrop-blur">
        <div className="mx-auto flex h-14 min-h-[3.5rem] max-w-6xl items-center justify-between px-4 sm:h-16 sm:px-6">
          <Link
            href="/"
            className="flex items-center gap-3 font-semibold text-[var(--color-text-primary)]"
          >
            <Image src="/logo-White.svg" alt="Meda" width={50} height={50} />
          </Link>

          <div className="flex items-center gap-2 sm:gap-3">
            {desktopLinks.length > 0 && (
              <nav className="hidden items-center gap-4 md:flex">
                {desktopLinks.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={desktopLinkClasses(link.href)}
                  >
                    {link.label}
                  </Link>
                ))}
              </nav>
            )}

            {balance != null && (
              <Link
                href="/profile"
                className="flex items-center gap-1.5 rounded-full bg-[var(--color-brand)]/10 px-2.5 py-1.5 text-xs font-semibold text-[var(--color-brand)] transition hover:bg-[var(--color-brand)]/20 sm:text-sm md:px-3"
              >
                <WalletIcon className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                <span>ETB {balance.toFixed(2)}</span>
              </Link>
            )}

            <SignedIn>
              <UserButton size="icon" className="text-white" />
            </SignedIn>
            <SignedOut>
              <Link
                href="/auth/sign-in"
                className={cn(
                  buttonVariants("primary", "md"),
                  "flex h-10 items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold",
                )}
              >
                Sign in
              </Link>
            </SignedOut>
          </div>
        </div>
      </header>

      {/* Mobile bottom tab bar */}
      <nav
        className="fixed bottom-0 left-0 right-0 z-50 border-t border-[var(--color-border)] bg-[rgba(5,13,23,0.95)] backdrop-blur-lg md:hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
      >
        <div className="flex h-14 items-stretch">
          {mobileTabs.map((tab) => {
            const active = isTabActive(tab.href);
            const Icon = tab.icon;
            const isCreate = tab.href === "/create-events";
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={cn(
                  "relative flex flex-1 flex-col items-center justify-center gap-0.5 transition-colors",
                  isCreate
                    ? "text-[var(--color-brand-alt)]"
                    : active
                      ? "text-[var(--color-brand)]"
                      : "text-[var(--color-text-muted)] active:text-[var(--color-text-secondary)]",
                )}
              >
                {active && !isCreate && (
                  <span className="absolute left-1/2 top-0 h-0.5 w-8 -translate-x-1/2 rounded-full bg-[var(--color-brand)]" />
                )}
                {isCreate ? (
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--color-brand-alt)]/20">
                    <Icon className="h-5 w-5" />
                  </span>
                ) : (
                  <Icon className="h-6 w-6" />
                )}
                <span
                  className={cn(
                    "text-[0.625rem] leading-tight",
                    active || isCreate ? "font-bold" : "font-medium",
                  )}
                >
                  {tab.label}
                </span>
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
      <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
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
      <path d="M2 9a3 3 0 013-3h14a3 3 0 013 3v0a3 3 0 01-3 3v0a3 3 0 01-3 3H5a3 3 0 01-3-3v0z" />
      <path d="M13 6v12" />
    </svg>
  );
}

function UserIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

function WalletIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="5" width="20" height="14" rx="2" />
      <path d="M16 14a2 2 0 100-4 2 2 0 000 4z" />
    </svg>
  );
}
