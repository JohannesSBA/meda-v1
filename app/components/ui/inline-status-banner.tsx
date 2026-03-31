import type { ReactNode } from "react";
import { cn } from "./cn";

type BannerTone = "info" | "success" | "warning" | "danger";

const toneClasses: Record<BannerTone, string> = {
  info: "border-[rgba(125,211,252,0.26)] bg-[rgba(125,211,252,0.12)] text-[var(--color-text-secondary)]",
  success:
    "border-[rgba(52,211,153,0.26)] bg-[rgba(52,211,153,0.12)] text-[var(--color-text-secondary)]",
  warning:
    "border-[rgba(251,191,36,0.28)] bg-[rgba(251,191,36,0.12)] text-[var(--color-text-secondary)]",
  danger:
    "border-[rgba(251,113,133,0.28)] bg-[rgba(251,113,133,0.12)] text-[var(--color-text-secondary)]",
};

type InlineStatusBannerProps = {
  title: ReactNode;
  description?: ReactNode;
  tone?: BannerTone;
  action?: ReactNode;
  className?: string;
};

export function InlineStatusBanner({
  title,
  description,
  tone = "info",
  action,
  className,
}: InlineStatusBannerProps) {
  return (
    <div
      className={cn(
        "rounded-[var(--radius-md)] border px-4 py-3",
        toneClasses[tone],
        className,
      )}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <p className="text-sm font-semibold text-[var(--color-text-primary)]">{title}</p>
          {description ? (
            <p className="text-sm leading-6 text-[var(--color-text-secondary)]">{description}</p>
          ) : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
    </div>
  );
}
