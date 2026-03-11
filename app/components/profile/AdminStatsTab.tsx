/**
 * AdminStatsTab -- Platform statistics cards for admin dashboard.
 */

"use client";

import { StatsCardsSkeleton } from "@/app/components/ui/skeleton";

type AdminStatsTabProps = {
  stats: Record<string, unknown> | null;
  statsLoading: boolean;
};

export function AdminStatsTab({ stats, statsLoading }: AdminStatsTabProps) {
  return (
    <section
      id="admin-tabpanel-stats"
      role="tabpanel"
      aria-label="Platform statistics"
      className="space-y-4 rounded-2xl border border-white/10 bg-[#0c1d2e]/80 p-4 sm:p-5"
    >
      <h2 className="text-lg font-semibold text-white">Platform statistics</h2>
      {statsLoading ? (
        <StatsCardsSkeleton count={4} />
      ) : stats ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Object.entries((stats.cards as Record<string, unknown>) ?? {}).map(
            ([label, value]) => (
              <div
                key={label}
                className="rounded-xl border border-white/10 bg-[#0a1927] p-4"
              >
                <p className="text-sm uppercase tracking-widest text-[var(--color-brand)]">
                  {label}
                </p>
                <p className="mt-2 text-2xl font-bold text-white">{String(value)}</p>
              </div>
            ),
          )}
        </div>
      ) : (
        <p className="text-sm text-[var(--color-text-secondary)]">
          No statistics available.
        </p>
      )}
    </section>
  );
}
