/**
 * AdminStatsTab -- Platform statistics cards for admin dashboard.
 */

"use client";

import { AsyncPanelState } from "@/app/components/ui/async-panel-state";
import { StatsCardsSkeleton } from "@/app/components/ui/skeleton";

type AdminStatsTabProps = {
  stats: Record<string, unknown> | null;
  statsLoading: boolean;
  statsError?: string | null;
  onRetry?: () => void;
};

export function AdminStatsTab({
  stats,
  statsLoading,
  statsError,
  onRetry,
}: AdminStatsTabProps) {
  const cards = ((stats?.cards as Record<string, unknown> | undefined) ?? {});
  const cardEntries = Object.entries(cards);

  return (
    <section
      id="admin-tabpanel-stats"
      role="tabpanel"
      aria-label="Platform statistics"
      className="space-y-4 rounded-2xl border border-white/10 bg-[#0c1d2e]/80 p-4 sm:p-5"
    >
      <h2 className="text-lg font-semibold text-white">Platform statistics</h2>
      <AsyncPanelState
        loading={statsLoading}
        error={statsError}
        isEmpty={cardEntries.length === 0}
        loadingFallback={<StatsCardsSkeleton count={4} />}
        emptyTitle="No statistics available"
        emptyDescription="Stats will appear here once the admin dashboard has data to report."
        onRetry={onRetry}
      >
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {cardEntries.map(([label, value]) => (
            <div
              key={label}
              className="rounded-xl border border-white/10 bg-[#0a1927] p-4"
            >
              <p className="text-sm uppercase tracking-widest text-[var(--color-brand)]">
                {label}
              </p>
              <p className="mt-2 text-2xl font-bold text-white">{String(value)}</p>
            </div>
          ))}
        </div>
      </AsyncPanelState>
    </section>
  );
}
