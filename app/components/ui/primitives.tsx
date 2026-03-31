import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "./cn";

const stackGapClasses = {
  xs: "gap-2",
  sm: "gap-3",
  md: "gap-4",
  lg: "gap-5 sm:gap-6",
  xl: "gap-6 sm:gap-7",
  "2xl": "gap-8 sm:gap-10",
} as const;

const sectionSizeClasses = {
  sm: "py-5 sm:py-6 lg:py-8",
  md: "py-6 sm:py-8 lg:py-10",
  lg: "py-8 sm:py-10 lg:py-12",
  xl: "py-9 sm:py-12 lg:py-16",
} as const;

const gridClasses = {
  two: "grid-cols-1 md:grid-cols-2",
  three: "grid-cols-1 md:grid-cols-2 xl:grid-cols-3",
  four: "grid-cols-1 sm:grid-cols-2 xl:grid-cols-4",
  auto: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
} as const;

type Gap = keyof typeof stackGapClasses;
type SectionSize = keyof typeof sectionSizeClasses;
type GridColumns = keyof typeof gridClasses;

type BaseProps = {
  children: ReactNode;
  className?: string;
};

export function Container({ children, className }: BaseProps) {
  return <div className={cn("page-container", className)}>{children}</div>;
}

export function Section({
  children,
  className,
  size = "lg",
}: BaseProps & { size?: SectionSize }) {
  return (
    <section className={cn(sectionSizeClasses[size], className)}>{children}</section>
  );
}

export function Stack({
  children,
  className,
  gap = "lg",
}: BaseProps & { gap?: Gap }) {
  return <div className={cn("flex flex-col", stackGapClasses[gap], className)}>{children}</div>;
}

export function Cluster({
  children,
  className,
  gap = "sm",
}: BaseProps & { gap?: Gap }) {
  return (
    <div className={cn("flex flex-wrap items-center", stackGapClasses[gap], className)}>
      {children}
    </div>
  );
}

export function ResponsiveGrid({
  children,
  className,
  cols = "three",
  gap = "lg",
}: BaseProps & { cols?: GridColumns; gap?: Gap }) {
  return (
    <div className={cn("grid", gridClasses[cols], stackGapClasses[gap], className)}>
      {children}
    </div>
  );
}

type PageIntroProps = {
  kicker?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  meta?: ReactNode;
  align?: "left" | "center";
  className?: string;
};

export function PageIntro({
  kicker,
  title,
  description,
  actions,
  meta,
  align = "left",
  className,
}: PageIntroProps) {
  const centered = align === "center";

  return (
    <div
      className={cn(
        "flex flex-col",
        centered ? "items-center text-center" : "items-start text-left",
        "gap-3 sm:gap-4",
        className,
      )}
    >
      {kicker ? <div className="heading-kicker">{kicker}</div> : null}
      <div className={cn("max-w-4xl space-y-3", centered && "mx-auto")}>
        <h1
          className={cn(
            "text-balance text-[var(--text-h1)] font-semibold tracking-[-0.04em] text-[var(--color-text-primary)] leading-[1.02] sm:text-[var(--text-display)] sm:leading-[0.95]",
          )}
        >
          {title}
        </h1>
        {description ? (
          <p className="body-lead max-w-3xl">{description}</p>
        ) : null}
      </div>
      {actions ? (
        <Cluster
          gap="sm"
          className={cn(
            "w-full [&>*]:w-full sm:w-auto sm:[&>*]:w-auto",
            centered && "justify-center",
          )}
        >
          {actions}
        </Cluster>
      ) : null}
      {meta ? (
        <Cluster gap="sm" className={cn("w-full", centered && "justify-center")}>
          {meta}
        </Cluster>
      ) : null}
    </div>
  );
}

type SurfacePanelProps = HTMLAttributes<HTMLDivElement> & {
  children: ReactNode;
};

export function SurfacePanel({ children, className, ...props }: SurfacePanelProps) {
  return (
    <div
      className={cn("surface-card rounded-[var(--radius-lg)] p-4 sm:p-6", className)}
      {...props}
    >
      {children}
    </div>
  );
}
