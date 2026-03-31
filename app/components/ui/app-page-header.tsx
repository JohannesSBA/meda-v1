import type { ReactNode } from "react";
import { Card } from "./card";
import { cn } from "./cn";
import { ResponsiveActionBar } from "./responsive-action-bar";

type AppPageHeaderProps = {
  kicker?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  primaryAction?: ReactNode;
  secondaryActions?: ReactNode;
  stats?: ReactNode;
  className?: string;
};

export function AppPageHeader({
  kicker,
  title,
  description,
  primaryAction,
  secondaryActions,
  stats,
  className,
}: AppPageHeaderProps) {
  return (
    <Card
      className={cn(
        "relative overflow-hidden border-[rgba(125,211,252,0.18)] bg-[radial-gradient(circle_at_top_left,rgba(125,211,252,0.16),transparent_34%),radial-gradient(circle_at_88%_12%,rgba(52,211,153,0.12),transparent_28%),linear-gradient(145deg,#102033,#0b1724)] p-5 sm:p-7 lg:p-8",
        className,
      )}
    >
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.02),transparent_32%,rgba(0,0,0,0.12))]" />
      <div className="relative space-y-5 sm:space-y-6">
        <div className="space-y-3">
          {kicker ? <p className="heading-kicker">{kicker}</p> : null}
          <div className="max-w-4xl space-y-3">
            <h1 className="text-balance text-[var(--text-h1)] font-semibold leading-[1.02] tracking-[-0.04em] text-[var(--color-text-primary)] sm:text-[var(--text-display)] sm:leading-[0.95]">
              {title}
            </h1>
            {description ? (
              <p className="max-w-3xl text-sm leading-7 text-[var(--color-text-secondary)] sm:text-base">
                {description}
              </p>
            ) : null}
          </div>
        </div>

        {primaryAction || secondaryActions ? (
          <ResponsiveActionBar align="start">
            {primaryAction}
            {secondaryActions}
          </ResponsiveActionBar>
        ) : null}

        {stats ? (
          <div className="flex flex-wrap gap-2.5">
            {stats}
          </div>
        ) : null}
      </div>
    </Card>
  );
}
