"use client";

import { useMemo, useState } from "react";
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

const navItems = [
  { href: "/events", label: "Events", requiresAdmin: false, public: true },
  { href: "/my-events", label: "My Events", requiresAdmin: false, public: false },
  { href: "/create-events", label: "Create Event", requiresAdmin: true, public: false },
  { href: "/profile", label: "Profile", requiresAdmin: false, public: false },
];

export default function HeaderNav({ initialSession = null }: HeaderNavProps) {
  const { data: clientSession } = authClient.useSession();
  const session = clientSession ?? initialSession ?? null;

  const isLoggedIn = Boolean(session?.user);
  const isAdmin = session?.user?.role === "admin";

  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);

  const linksToShow = useMemo(
    () =>
      navItems.filter((item) => {
        if (item.public) return true;
        if (!isLoggedIn) return false;
        if (item.requiresAdmin && !isAdmin) return false;
        return true;
      }),
    [isAdmin, isLoggedIn],
  );

  const linkClasses = (href: string) => {
    const isActive = pathname === href;
    return `rounded-lg px-3 py-2 text-sm font-medium transition ${
      isActive
        ? "bg-[var(--color-surface-2)] text-[var(--color-text-primary)]"
        : "text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-2)] hover:text-[var(--color-text-primary)]"
    }`;
  };

  return (
    <>
      <a
        href="#main-content"
        className="sr-only z-[60] rounded-md bg-[var(--color-brand)] px-4 py-2 text-sm font-semibold text-[var(--color-brand-text)] focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
      >
        Skip to main content
      </a>
      <header className="fixed left-0 right-0 top-0 z-50 bg-[rgba(5,13,23,0.82)] pt-[env(safe-area-inset-top)] backdrop-blur">
        <div className="mx-auto flex h-14 min-h-[3.5rem] max-w-6xl items-center justify-between px-4 sm:h-16 sm:px-6">
          <Link
            href="/"
            className="flex items-center gap-3 font-semibold text-[var(--color-text-primary)]"
          >
            <Image src="/logo-White.svg" alt="Meda" width={50} height={50} />
            {/* <span className="hidden text-sm tracking-wide sm:inline">MEDA</span> */}
          </Link>

          <div className="flex items-center gap-2 sm:gap-3">
            {linksToShow.length > 0 && (
              <nav className="hidden items-center gap-4 md:flex">
                {linksToShow.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={linkClasses(link.href)}
                  >
                    {link.label}
                  </Link>
                ))}
              </nav>
            )}

            {linksToShow.length > 0 && (
              <button
                type="button"
                onClick={() => setIsOpen((prev) => !prev)}
                className={cn(
                  "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border-2 border-[var(--color-border-strong)] bg-[var(--color-surface-2)] text-[var(--color-text-primary)] transition-all active:scale-95 md:hidden",
                  "hover:border-[var(--color-brand)] hover:bg-[var(--color-surface-2)] hover:text-[var(--color-brand)]",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-bg)]",
                )}
                aria-expanded={isOpen}
                aria-label={isOpen ? "Close navigation menu" : "Open navigation menu"}
              >
                {isOpen ? <CloseIcon /> : <MenuIcon />}
              </button>
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

        {linksToShow.length > 0 && (
          <div
            className={cn(
              "md:hidden overflow-hidden transition-all duration-300 ease-out",
              isOpen
                ? "max-h-64 border-t border-[var(--color-border-strong)] bg-[rgba(7,20,33,0.98)] shadow-[0_8px_24px_rgba(0,0,0,0.4)]"
                : "max-h-0 border-t border-transparent bg-transparent",
            )}
          >
            <nav className="flex flex-col gap-1 px-4 py-4">
              {linksToShow.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={cn(
                    linkClasses(link.href),
                    "rounded-xl px-4 py-3.5 text-base font-medium -tracking-tight active:scale-[0.98]",
                  )}
                  onClick={() => setIsOpen(false)}
                >
                  {link.label}
                </Link>
              ))}
            </nav>
          </div>
        )}
      </header>
    </>
  );
}

function MenuIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-6 w-6"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.25"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-6 w-6"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.25"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M6 6l12 12M18 6l-12 12" />
    </svg>
  );
}
