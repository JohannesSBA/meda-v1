import type { ReactNode } from "react";
import { cn } from "./cn";

type ResponsiveActionBarProps = {
  children: ReactNode;
  className?: string;
  align?: "start" | "center" | "end";
};

const alignClasses = {
  start: "sm:justify-start",
  center: "sm:justify-center",
  end: "sm:justify-end",
} as const;

export function ResponsiveActionBar({
  children,
  className,
  align = "start",
}: ResponsiveActionBarProps) {
  return (
    <div
      className={cn(
        "flex w-full flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center",
        alignClasses[align],
        "[&>*]:w-full sm:[&>*]:w-auto",
        className,
      )}
    >
      {children}
    </div>
  );
}
