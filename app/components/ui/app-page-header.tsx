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
        "relative overflow-hidden border-[rgba(74,222,128,0.18)] bg-[radial-gradient(ellipse_55%_50%_at_5%_0%,rgba(74,222,128,0.13),transparent),radial-gradient(ellipse_35%_40%_at_90%_10%,rgba(56,189,248,0.09),transparent),linear-gradient(150deg,#0e2016,#0b1724)] p-4 sm:p-6 lg:p-7",
        className,
      )}
    >
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(175deg,rgba(255,255,255,0.025),transparent_30%,rgba(0,0,0,0.1))]" />
      <div className="relative space-y-4 sm:space-y-5">
        <div className="space-y-2.5">
          {kicker ? <p className="heading-kicker">{kicker}</p> : null}
          <div className="max-w-4xl space-y-2.5">
            <h1 className="text-balance text-[var(--text-h1)] font-bold leading-[1.02] tracking-[-0.045em] text-[var(--color-text-primary)] sm:text-[var(--text-display)] sm:leading-[0.94]">
              {title}
            </h1>
            {description ? (
              <p className="max-w-3xl text-sm leading-6 text-[var(--color-text-secondary)]">
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

        {stats ? <div className="flex flex-wrap gap-2">{stats}</div> : null}
      </div>
    </Card>
  );
}
