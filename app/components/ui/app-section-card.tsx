import type { ReactNode } from "react";
import { Card } from "./card";
import { cn } from "./cn";
import { ResponsiveActionBar } from "./responsive-action-bar";

type Density = "comfortable" | "compact" | "dense";

const densityClasses: Record<Density, string> = {
  comfortable: "p-5 sm:p-6",
  compact: "p-4 sm:p-5",
  dense: "p-3.5 sm:p-4",
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
    <Card className={cn("space-y-4", densityClasses[density], className)}>
      {title || description || headingKicker || actions ? (
        <div className="space-y-2">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-2">
              {headingKicker ? <p className="heading-kicker">{headingKicker}</p> : null}
              {title ? (
                <h2 className="text-xl font-semibold tracking-[-0.03em] text-[var(--color-text-primary)] sm:text-2xl">
                  {title}
                </h2>
              ) : null}
              {description ? (
                <p className="max-w-3xl text-sm leading-7 text-[var(--color-text-secondary)]">
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
