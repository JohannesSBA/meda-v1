/**
 * EmptyState -- placeholder for empty lists with optional actions.
 */

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
        "flex flex-col items-center justify-center gap-5 px-6 py-14 text-center sm:px-10",
        className,
      )}
    >
      {icon ? (
        <div className="text-[var(--color-text-muted)]">{icon}</div>
      ) : (
        <div
          className="flex h-16 w-16 items-center justify-center rounded-full border border-[var(--color-border-strong)] bg-[rgba(125,211,252,0.08)] text-[var(--color-brand)]"
          aria-hidden
        >
          <svg className="h-7 w-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <path d="M8 15h8M9 9h.01M15 9h.01" />
          </svg>
        </div>
      )}
      <div className="max-w-md space-y-2">
        <h3 className="text-xl font-semibold tracking-[-0.03em] text-[var(--color-text-primary)]">
          {title}
        </h3>
        {description ? (
          <p className="text-sm leading-6 text-[var(--color-text-secondary)]">{description}</p>
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
