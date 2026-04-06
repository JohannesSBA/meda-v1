/**
 * PageShell -- consistent page layout wrapper with optional header.
 */

import type { ReactNode } from "react";
import { cn } from "./cn";

type PageShellProps = {
  children: ReactNode;
  className?: string;
  containerClassName?: string;
};

export function PageShell({ children, className, containerClassName }: PageShellProps) {
  return (
    <main
      className={cn(
        "app-shell relative min-h-screen overflow-x-clip overflow-y-visible pt-[calc(var(--header-height)+env(safe-area-inset-top,0px)+8px)] sm:pt-[calc(var(--header-height)+env(safe-area-inset-top,0px)+12px)]",
        "has-bottom-nav",
        className,
      )}
    >
      <div className="app-glow-bg pointer-events-none absolute inset-0" />
      <div id="main-content" className={cn("page-container relative", containerClassName)}>
        {children}
      </div>
    </main>
  );
}
