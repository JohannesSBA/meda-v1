/**
 * Host workspace IA — maps HOST_UX_REDESIGN primary nav to existing `/host?view=` routes.
 * Single source for labels and hrefs (REFACTOR_PLAN: avoid drift).
 */

import { appRoutes } from "@/lib/navigation";

export const HOST_PATH = appRoutes.host;

/** Operational views backed by `app/host/page.tsx` (search param `view`). */
export type HostOperationalView =
  | "overview"
  | "calendar"
  | "places"
  | "bookings"
  | "people"
  | "money"
  | "analytics"
  | "settings";

export function hostViewHref(view: HostOperationalView): string {
  return `${HOST_PATH}?view=${view}`;
}

/** Valid `view` query values for `/host` (single source for parsing + tests). */
export const HOST_VIEW_ORDER: HostOperationalView[] = [
  "overview",
  "calendar",
  "places",
  "bookings",
  "people",
  "money",
  "analytics",
  "settings",
];

export function parseHostViewParam(value: string | undefined): HostOperationalView {
  return HOST_VIEW_ORDER.includes(value as HostOperationalView)
    ? (value as HostOperationalView)
    : "overview";
}

/** Pitch owner facilitators / scan team — lives on Profile until `/host/team` exists. */
export const HOST_TEAM_PROFILE_HASH = "host-facilitators";

export function hostTeamProfileHref(): string {
  return `${appRoutes.profile}#${HOST_TEAM_PROFILE_HASH}`;
}

export type HostPrimaryNavId =
  | "overview"
  | "events"
  | "bookings"
  | "customers"
  | "team"
  | "payouts"
  | "analytics"
  | "settings";

export type HostPrimaryNavItem = {
  id: HostPrimaryNavId;
  label: string;
  /** Where the nav link goes */
  href: string;
  /** Whether this item is active for the current operational view */
  isActive: (view: HostOperationalView) => boolean;
};

export const hostPrimaryNavItems: HostPrimaryNavItem[] = [
  {
    id: "overview",
    label: "Overview",
    href: hostViewHref("overview"),
    isActive: (view) => view === "overview",
  },
  {
    id: "events",
    label: "Events",
    href: hostViewHref("calendar"),
    isActive: (view) => view === "calendar" || view === "places",
  },
  {
    id: "bookings",
    label: "Bookings",
    href: hostViewHref("bookings"),
    isActive: (view) => view === "bookings",
  },
  {
    id: "customers",
    label: "Customers",
    href: hostViewHref("people"),
    isActive: (view) => view === "people",
  },
  {
    id: "team",
    label: "Team",
    href: hostTeamProfileHref(),
    isActive: () => false,
  },
  {
    id: "payouts",
    label: "Payouts",
    href: hostViewHref("money"),
    isActive: (view) => view === "money",
  },
  {
    id: "analytics",
    label: "Analytics",
    href: hostViewHref("analytics"),
    isActive: (view) => view === "analytics",
  },
  {
    id: "settings",
    label: "Settings",
    href: hostViewHref("settings"),
    isActive: (view) => view === "settings",
  },
];

export type HostEventsSubNavItem = {
  label: string;
  view: "calendar" | "places";
};

export const hostEventsSubNavItems: HostEventsSubNavItem[] = [
  { label: "Calendar", view: "calendar" },
  { label: "Places", view: "places" },
];

/** Shared shell for primary host nav (HostPrimaryNav). Keeps visual rhythm in one place. */
export const HOST_NAV_PRIMARY_SHELL =
  "inline-flex w-full flex-wrap gap-2 rounded-[24px] border border-[rgba(125,211,252,0.14)] bg-[rgba(255,255,255,0.04)] p-2";

/**
 * Contextual primary CTA in the host page header — avoids redundant "Open overview" on Overview.
 */
export function hostPrimaryHeaderCta(view: HostOperationalView): {
  href: string;
  label: string;
} {
  if (view === "overview") {
    return { href: hostViewHref("calendar"), label: "Open Events" };
  }
  if (view === "calendar" || view === "places") {
    return { href: hostViewHref("overview"), label: "Overview" };
  }
  return { href: hostViewHref("overview"), label: "Overview" };
}

/**
 * Floating action: alternate between calendar and places on Events views; otherwise jump to calendar ops.
 */
export function hostFabTarget(view: HostOperationalView): {
  href: string;
  ariaLabel: string;
  title: string;
} {
  if (view === "places") {
    return {
      href: hostViewHref("calendar"),
      ariaLabel: "Open calendar to add or manage booking times",
      title: "Open calendar",
    };
  }
  if (view === "calendar") {
    return {
      href: hostViewHref("places"),
      ariaLabel: "Open places to add or edit a venue",
      title: "Open places",
    };
  }
  return {
    href: hostViewHref("calendar"),
    ariaLabel: "Open Events — calendar",
    title: "Open Events calendar",
  };
}
