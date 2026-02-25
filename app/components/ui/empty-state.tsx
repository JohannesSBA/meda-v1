import Link from "next/link";
import type { ReactNode } from "react";
import { Card } from "./card";
import { Button } from "./button";
import { cn } from "./cn";

type ActionWithHref = { label: string; href: string };
type ActionWithOnClick = { label: string; onClick: () => void };
type Action = ActionWithHref | ActionWithOnClick;

function isActionWithHref(action: Action): action is ActionWithHref {
  return "href" in action;
}

type EmptyStateProps = {
  title: string;
  description?: string;
  action?: Action;
  icon?: ReactNode;
  className?: string;
};

export function EmptyState({
  title,
  description,
  action,
  icon,
  className,
}: EmptyStateProps) {
  return (
    <Card
      className={cn(
        "flex flex-col items-center justify-center gap-4 px-6 py-10 text-center",
        className,
      )}
    >
      {icon ? (
        <div className="text-[var(--color-text-muted)]">{icon}</div>
      ) : (
        <div
          className="h-12 w-12 rounded-full border-2 border-[var(--color-border)] bg-[var(--color-surface-2)]"
          aria-hidden
        />
      )}
      <div className="space-y-1">
        <h3 className="text-lg font-semibold text-[var(--color-text-primary)]">
          {title}
        </h3>
        {description ? (
          <p className="text-sm text-[var(--color-text-secondary)]">
            {description}
          </p>
        ) : null}
      </div>
      {action ? (
        isActionWithHref(action) ? (
          <Link href={action.href}>
            <Button variant="primary" size="md">
              {action.label}
            </Button>
          </Link>
        ) : (
          <Button variant="primary" size="md" onClick={action.onClick}>
            {action.label}
          </Button>
        )
      ) : null}
    </Card>
  );
}
