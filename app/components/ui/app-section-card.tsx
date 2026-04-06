import type { ReactNode } from "react";
import { Card } from "./card";
import { cn } from "./cn";
import { ResponsiveActionBar } from "./responsive-action-bar";

type Density = "comfortable" | "compact" | "dense";

const densityClasses: Record<Density, string> = {
  comfortable: "p-4 sm:p-5",
  compact: "p-3.5 sm:p-[18px]",
  dense: "p-3 sm:p-3.5",
};

type AppSectionCardProps = {
  title?: ReactNode;
  description?: ReactNode;
  headingKicker?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  density?: Density;
  className?: string;
};

export function AppSectionCard({
  title,
  description,
  headingKicker,
  actions,
  children,
  density = "comfortable",
  className,
}: AppSectionCardProps) {
  return (
    <Card className={cn("space-y-3.5", densityClasses[density], className)}>
      {title || description || headingKicker || actions ? (
        <div className="space-y-1.5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-1.5">
              {headingKicker ? <p className="heading-kicker">{headingKicker}</p> : null}
              {title ? (
                <h2 className="text-lg font-semibold tracking-[-0.03em] text-[var(--color-text-primary)] sm:text-xl">
                  {title}
                </h2>
              ) : null}
              {description ? (
                <p className="max-w-3xl text-sm leading-6 text-[var(--color-text-secondary)]">
                  {description}
                </p>
              ) : null}
            </div>
            {actions ? <ResponsiveActionBar align="end">{actions}</ResponsiveActionBar> : null}
          </div>
        </div>
      ) : null}
      {children}
    </Card>
  );
}
