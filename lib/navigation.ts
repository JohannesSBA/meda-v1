import { uiCopy } from "@/lib/uiCopy";

export const appRoutes = {
  home: "/",
  play: "/play",
  tickets: "/tickets",
  host: "/host",
  profile: "/profile",
  admin: "/admin",
  accountSettings: "/account/settings",
  accountSecurity: "/account/security",
  createMatch: "/create-events",
} as const;

export const legacyRouteAliases = {
  events: "/events",
  slots: "/slots",
  bookings: "/bookings",
  myTickets: "/my-tickets",
  accountOwner: "/account/owner",
} as const;

export type AppNavItem = {
  href: string;
  label: string;
  requiresAuth?: boolean;
  pitchOwnerOnly?: boolean;
};

export const primaryDesktopNav: AppNavItem[] = [
  { href: appRoutes.play, label: uiCopy.nav.play },
  { href: appRoutes.tickets, label: uiCopy.nav.tickets, requiresAuth: true },
  { href: appRoutes.host, label: uiCopy.nav.host, requiresAuth: true, pitchOwnerOnly: true },
  { href: appRoutes.profile, label: uiCopy.nav.profile, requiresAuth: true },
];

export const primaryMobileNav: AppNavItem[] = [
  { href: appRoutes.play, label: uiCopy.nav.play },
  { href: appRoutes.tickets, label: uiCopy.nav.tickets, requiresAuth: true },
  { href: appRoutes.host, label: uiCopy.nav.host, requiresAuth: true, pitchOwnerOnly: true },
  { href: appRoutes.profile, label: uiCopy.nav.profile, requiresAuth: true },
];

export function filterNavItems(
  items: AppNavItem[],
  options: { isLoggedIn: boolean; isPitchOwner: boolean },
) {
  return items.filter((item) => {
    if (item.requiresAuth && !options.isLoggedIn) return false;
    if (item.pitchOwnerOnly && !options.isPitchOwner) return false;
    return true;
  });
}

export function isNavPathActive(pathname: string, href: string) {
  if (href === appRoutes.home) return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function searchParamsToQueryString(
  params: Record<string, string | string[] | undefined>,
) {
  const next = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (Array.isArray(value)) {
      for (const entry of value) {
        next.append(key, entry);
      }
      continue;
    }

    if (typeof value === "string" && value.length > 0) {
      next.set(key, value);
    }
  }

  return next.toString();
}
