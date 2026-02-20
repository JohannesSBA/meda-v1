"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { UserButton } from "@neondatabase/auth/react";

import { authClient } from "@/lib/auth/client";

type SessionPayload = ReturnType<typeof authClient.useSession>["data"];

type HeaderNavProps = {
  initialSession?: SessionPayload | null;
};

const navItems = [
  { href: "/events", label: "Events", requiresAdmin: false },
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
    [isAdmin, isLoggedIn]
  );

  const linkClasses = (href: string) => {
    const isActive = pathname === href;
    return `rounded-lg px-2 py-1 text-sm font-medium transition-colors ${
      isActive
        ? "bg-slate-900 text-white"
        : "text-slate-600 hover:text-slate-900"
    }`;
  };

  return (
    <header className="border-b border-slate-200 bg-white/80 backdrop-blur z-50">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link
          href="/"
          className="flex items-center gap-3 font-semibold text-slate-900"
        >
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-slate-900 text-sm text-white">
            M
          </span>
          <span className="text-base">Meda</span>
        </Link>

        <div className="flex items-center gap-3">
          {linksToShow.length > 0 && (
            <nav className="hidden items-center gap-4 md:flex">
              {linksToShow.map((link) => (
                <Link key={link.href} href={link.href} className={linkClasses(link.href)}>
                  {link.label}
                </Link>
              ))}
            </nav>
          )}

          {linksToShow.length > 0 && (
            <button
              type="button"
              onClick={() => setIsOpen((prev) => !prev)}
              className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 transition-colors hover:border-slate-300 hover:text-slate-900 md:hidden"
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
              ? "max-h-48 border-t border-slate-200 bg-white shadow-sm"
              : "max-h-0 border-t border-transparent"
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
