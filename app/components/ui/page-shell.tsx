import type { ReactNode } from "react";
import { cn } from "./cn";

type PageShellProps = {
  children: ReactNode;
  className?: string;
  containerClassName?: string;
};

export function PageShell({
  children,
  className,
  containerClassName,
}: PageShellProps) {
  return (
    <main
      className={cn(
        "app-shell relative min-h-screen overflow-hidden",
        "mt-[calc(4rem+env(safe-area-inset-top,0px))]",
        className,
      )}
    >
      <div className="app-glow-bg pointer-events-none absolute inset-0" />
      <div
        id="main-content"
        className={cn("page-container relative", containerClassName)}
      >
        {children}
      </div>
    </main>
  );
}
