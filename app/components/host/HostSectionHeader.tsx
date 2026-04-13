import { cn } from "@/app/components/ui/cn";
import type { ReactNode } from "react";

type HostSectionHeaderProps = {
  kicker: string;
  title: ReactNode;
  description?: ReactNode;
  /** Badges, buttons, or other trailing controls. */
  actions?: ReactNode;
  className?: string;
};

/**
 * Shared kicker + title (+ optional description / actions) stack for host workbench cards.
 */
export function HostSectionHeader({
  kicker,
  title,
  description,
  actions,
  className,
}: HostSectionHeaderProps) {
  const heading = (
    <div className={cn("min-w-0", description ? "space-y-2" : "space-y-1")}>
      <p className="heading-kicker">{kicker}</p>
      <h2 className="section-title">{title}</h2>
      {description ? (
        <p className="text-sm leading-7 text-[var(--color-text-secondary)]">{description}</p>
      ) : null}
    </div>
  );

  if (actions) {
    return (
      <div
        className={cn(
          "flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between",
          className,
        )}
      >
        {heading}
        <div className="flex shrink-0 flex-wrap items-center justify-start gap-2 sm:justify-end">
          {actions}
        </div>
      </div>
    );
  }

  return <div className={cn(className)}>{heading}</div>;
}
