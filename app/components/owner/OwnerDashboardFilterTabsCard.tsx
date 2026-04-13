"use client";

import { Card } from "@/app/components/ui/card";
import { Input } from "@/app/components/ui/input";
import { Select } from "@/app/components/ui/select";
import type {
  OwnerDashboardPitchOption,
  OwnerDashboardTab,
} from "@/app/components/owner/ownerDashboardWorkspaceTypes";
import { uiCopy } from "@/lib/uiCopy";

const TAB_ORDER: OwnerDashboardTab[] = [
  "overview",
  "bookings",
  "payments",
  "pool_payments",
  "customers",
  "slots",
  "subscription",
  "exports",
];

const TAB_LABELS: Record<OwnerDashboardTab, string> = {
  overview: "Overview",
  bookings: "Bookings",
  payments: "Payouts",
  pool_payments: uiCopy.host.groupPayment,
  customers: "Customers",
  slots: "Calendar",
  subscription: "Host plan",
  exports: "Exports",
};

export type OwnerDashboardFilterTabsCardProps = {
  fromDate: string;
  toDate: string;
  selectedPitchId: string;
  onFromDateChange: (value: string) => void;
  onToDateChange: (value: string) => void;
  onPitchChange: (value: string) => void;
  pitches: OwnerDashboardPitchOption[];
  tab: OwnerDashboardTab;
  onSelectTab: (tab: OwnerDashboardTab) => void;
};

/**
 * Shared filter row (date range + pitch) and dashboard section tabs.
 * Presentational only; state lives in {@link OwnerDashboardWorkspace}.
 */
export function OwnerDashboardFilterTabsCard({
  fromDate,
  toDate,
  selectedPitchId,
  onFromDateChange,
  onToDateChange,
  onPitchChange,
  pitches,
  tab,
  onSelectTab,
}: OwnerDashboardFilterTabsCardProps) {
  return (
    <Card className="space-y-4 p-5 sm:p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-2">
          <p className="heading-kicker">Host overview</p>
          <h2 className="section-title">
            Bookings, payouts, group payments, customers, calendar, host plan, and exports.
          </h2>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <label className="block">
            <span className="field-label">From</span>
            <Input type="date" value={fromDate} onChange={(event) => onFromDateChange(event.target.value)} />
          </label>
          <label className="block">
            <span className="field-label">To</span>
            <Input type="date" value={toDate} onChange={(event) => onToDateChange(event.target.value)} />
          </label>
          <label className="block">
            <span className="field-label">Pitch</span>
            <Select value={selectedPitchId} onChange={(event) => onPitchChange(event.target.value)}>
              <option value="">All pitches</option>
              {pitches.map((pitch) => (
                <option key={pitch.id} value={pitch.id}>
                  {pitch.name}
                </option>
              ))}
            </Select>
          </label>
        </div>
      </div>

      <div role="tablist" aria-label="Owner dashboard sections" className="grid gap-2 md:grid-cols-4 xl:grid-cols-8">
        {TAB_ORDER.map((value) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={tab === value}
            onClick={() => onSelectTab(value)}
            className={`rounded-[var(--radius-md)] px-4 py-3 text-sm font-semibold transition ${
              tab === value
                ? "bg-[rgba(125,211,252,0.12)] text-[var(--color-text-primary)]"
                : "text-[var(--color-text-secondary)] hover:bg-white/[0.04] hover:text-[var(--color-text-primary)]"
            }`}
          >
            {TAB_LABELS[value]}
          </button>
        ))}
      </div>
    </Card>
  );
}
