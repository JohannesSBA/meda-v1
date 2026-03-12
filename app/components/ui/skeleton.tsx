/**
 * Skeleton -- loading placeholders (Skeleton, SkeletonText, EventCardSkeleton).
 */

import type { HTMLAttributes } from "react";
import { cn } from "./cn";

type SkeletonProps = HTMLAttributes<HTMLDivElement>;

export function Skeleton({ className, ...props }: SkeletonProps) {
  return (
    <div
      className={cn(
        "animate-pulse rounded-xl bg-[linear-gradient(90deg,rgba(255,255,255,0.02),rgba(255,255,255,0.08),rgba(255,255,255,0.02))] bg-[length:200%_100%]",
        className,
      )}
      {...props}
    />
  );
}

export function SkeletonText({
  className,
  lines = 1,
  ...props
}: SkeletonProps & { lines?: number }) {
  return (
    <div className={cn("space-y-2.5", className)} {...props}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          className={cn("h-4", i === lines - 1 && lines > 1 ? "w-3/4" : "w-full")}
        />
      ))}
    </div>
  );
}

export function SkeletonAvatar({ className, ...props }: SkeletonProps) {
  return <Skeleton className={cn("h-10 w-10 shrink-0 rounded-full", className)} {...props} />;
}

export function SkeletonImage({
  className,
  aspectRatio = "aspect-video",
  ...props
}: SkeletonProps & { aspectRatio?: string }) {
  return <Skeleton className={cn("w-full", aspectRatio, className)} {...props} />;
}

export function SkeletonCard({ className, ...props }: SkeletonProps) {
  return (
    <div className={cn("surface-card rounded-[var(--radius-lg)] p-5", className)} {...props} />
  );
}

export function TableSkeleton({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <div className="overflow-x-auto rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[rgba(255,255,255,0.02)] p-4">
      <table className="table-shell w-full">
        <thead>
          <tr>
            {Array.from({ length: cols }).map((_, i) => (
              <th key={i} className="py-2 pr-4">
                <Skeleton className="h-4 w-20" />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rows }).map((_, rowIdx) => (
            <tr key={rowIdx} className="border-t border-[var(--color-border)]">
              {Array.from({ length: cols }).map((_, colIdx) => (
                <td key={colIdx} className="py-4 pr-4">
                  <Skeleton className={cn("h-4", colIdx === 0 ? "w-32" : "w-24")} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function EventListItemSkeleton() {
  return (
    <div className="surface-card rounded-[var(--radius-lg)] p-4">
      <div className="flex gap-4">
        <Skeleton className="h-20 w-20 shrink-0 rounded-2xl" />
        <div className="flex flex-1 flex-col justify-center gap-2.5">
          <Skeleton className="h-5 w-3/4" />
          <Skeleton className="h-4 w-44" />
          <Skeleton className="h-4 w-32" />
        </div>
      </div>
    </div>
  );
}

export function StatsCardsSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="surface-card rounded-[var(--radius-lg)] p-5">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="mt-3 h-8 w-20" />
        </div>
      ))}
    </div>
  );
}

export function EventCardSkeleton() {
  return (
    <div className="surface-card flex h-full flex-col overflow-hidden rounded-[var(--radius-lg)]">
      <Skeleton className="aspect-[16/10] w-full rounded-none" />
      <div className="flex flex-1 flex-col gap-3 p-5">
        <div className="flex items-center justify-between gap-3">
          <Skeleton className="h-6 w-24 rounded-full" />
          <Skeleton className="h-10 w-10 rounded-full" />
        </div>
        <Skeleton className="h-6 w-4/5" />
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-4 w-44" />
        <div className="mt-auto flex items-center justify-between pt-2">
          <Skeleton className="h-5 w-24" />
          <Skeleton className="h-6 w-20 rounded-full" />
        </div>
      </div>
    </div>
  );
}
