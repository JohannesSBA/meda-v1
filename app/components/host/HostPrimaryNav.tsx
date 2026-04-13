"use client";

import Link from "next/link";
import { cn } from "@/app/components/ui/cn";
import {
  HOST_NAV_PRIMARY_SHELL,
  hostEventsSubNavItems,
  hostPrimaryNavItems,
  hostViewHref,
  type HostOperationalView,
} from "@/lib/hostNavigation";

type HostPrimaryNavProps = {
  currentView: HostOperationalView;
};

export function HostPrimaryNav({ currentView }: HostPrimaryNavProps) {
  const showEventsSubNav =
    currentView === "calendar" || currentView === "places";

  return (
    <div className="space-y-3">
      <div role="tablist" aria-label="Host sections" className={HOST_NAV_PRIMARY_SHELL}>
        {hostPrimaryNavItems.map((item) => {
          const active = item.isActive(currentView);
          const isTeam = item.id === "team";
          return (
            <Link
              key={item.id}
              href={item.href}
              role="tab"
              aria-selected={active}
              className={cn(
                "min-h-11 rounded-full px-4 py-2 text-sm font-semibold transition",
                active
                  ? "bg-[var(--color-accent-soft)] text-[var(--color-text-primary)]"
                  : "text-[var(--color-text-secondary)] hover:bg-[var(--color-control-bg-hover)] hover:text-[var(--color-text-primary)]",
              )}
            >
              {item.label}
              {isTeam ? (
                <span className="sr-only"> (opens Profile)</span>
              ) : null}
            </Link>
          );
        })}
      </div>

      {showEventsSubNav ? (
        <div
          role="tablist"
          aria-label="Events — calendar or places"
          className="flex flex-wrap gap-2 pl-1"
        >
          {hostEventsSubNavItems.map((sub) => {
            const active = currentView === sub.view;
            return (
              <Link
                key={sub.view}
                href={hostViewHref(sub.view)}
                role="tab"
                aria-selected={active}
                className={cn(
                  "rounded-full px-3 py-1.5 text-xs font-semibold uppercase tracking-wide transition",
                  active
                    ? "bg-[var(--color-control-bg)] text-[var(--color-text-primary)] ring-1 ring-[var(--color-border)]"
                    : "text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]",
                )}
              >
                {sub.label}
              </Link>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
