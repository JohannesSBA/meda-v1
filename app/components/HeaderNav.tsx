"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { UserButton } from "@neondatabase/auth/react";
import Image from "next/image";
import { authClient } from "@/lib/auth/client";
import { buttonVariants } from "@/app/components/ui/button";
import { cn } from "@/app/components/ui/cn";

type SessionPayload = ReturnType<typeof authClient.useSession>["data"];

type HeaderNavProps = {
  initialSession?: SessionPayload | null;
};

const navItems = [
  { href: "/events", label: "Events", requiresAdmin: false },
  { href: "/my-events", label: "My Events", requiresAdmin: false },
  { href: "/create-events", label: "Create Event", requiresAdmin: true },
  { href: "/profile", label: "Profile", requiresAdmin: false },
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
      <header className="fixed left-0 right-0 top-0 z-50  bg-[rgba(5,13,23,0.82)] backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link
            href="/"
            className="flex items-center gap-3 font-semibold text-[var(--color-text-primary)]"
          >
            <Image src="/logo.png" alt="Meda" width={50} height={50} />
            <span className="hidden text-sm tracking-wide sm:inline">MEDA</span>
          </Link>

          <div className="flex items-center gap-3">
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
                  buttonVariants("secondary", "md"),
                  "h-10 w-10 rounded-lg border-[var(--color-border)] p-0 md:hidden",
                )}
                aria-expanded={isOpen}
                aria-label="Toggle navigation menu"
              >
                {isOpen ? <CloseIcon /> : <MenuIcon />}
              </button>
            )}

            <UserButton size="icon" />
          </div>
        </div>

        {linksToShow.length > 0 && (
          <div
            className={`md:hidden ${
              isOpen
                ? "max-h-48 border-t border-[var(--color-border)] bg-[rgba(7,20,33,0.95)] shadow-sm"
                : "max-h-0 border-t border-transparent bg-transparent"
            } overflow-hidden transition-all duration-200`}
          >
            <nav className="flex flex-col gap-2 px-4 py-3">
              {linksToShow.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={linkClasses(link.href)}
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
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
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
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M6 6l12 12M18 6l-12 12" />
    </svg>
  );
}
