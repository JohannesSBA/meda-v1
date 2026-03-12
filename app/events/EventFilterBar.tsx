/**
 * EventFilterBar -- Search, date, category, sort controls and live stats for events listing.
 */

"use client";

import { Card } from "@/app/components/ui/card";
import { Input } from "@/app/components/ui/input";
import { Select } from "@/app/components/ui/select";
import { Cluster } from "@/app/components/ui/primitives";

type CategoryItem = { categoryId: string; categoryName: string };

type EventFilterBarProps = {
  search: string;
  datePreset: string;
  categoryId: string;
  sortOrder: string;
  total: number;
  radiusKm: number;
  categories: CategoryItem[];
  onSearchChange: (value: string) => void;
  onDateRangeChange: (value: string) => void;
  onCategoryChange: (value: string) => void;
  onSortChange: (value: string) => void;
};

export function EventFilterBar({
  search,
  datePreset,
  categoryId,
  sortOrder,
  total,
  radiusKm,
  categories,
  onSearchChange,
  onDateRangeChange,
  onCategoryChange,
  onSortChange,
}: EventFilterBarProps) {
  return (
    <Card className="overflow-hidden p-5 sm:p-6">
      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr] xl:items-end">
        <div className="space-y-4">
          <div className="space-y-3">
            <p className="heading-kicker">Discover matches</p>
            <h1 className="text-balance text-[var(--text-h1)] font-semibold tracking-[-0.05em] text-[var(--color-text-primary)]">
              Find the right event without fighting the interface.
            </h1>
            <p className="max-w-2xl text-sm leading-7 text-[var(--color-text-secondary)] sm:text-base">
              Search by name, tighten the date window, and sort by what matters before you commit.
            </p>
          </div>

          <div className="grid gap-3 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
            <label className="block">
              <span className="field-label">Search</span>
              <div className="relative">
                <Input
                  type="search"
                  placeholder="Search by name, location, or vibe"
                  defaultValue={search}
                  onChange={(e) => onSearchChange(e.target.value)}
                  className="pl-11"
                />
                <SearchIcon className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-text-muted)]" />
              </div>
            </label>

            <label className="block">
              <span className="field-label">Date</span>
              <Select value={datePreset || "all"} onChange={(e) => onDateRangeChange(e.target.value)}>
                <option value="all">Any date</option>
                <option value="week">This week</option>
                <option value="weekend">This weekend</option>
                <option value="month">This month</option>
              </Select>
            </label>

            <label className="block">
              <span className="field-label">Category</span>
              <Select
                value={categoryId || "all"}
                onChange={(e) => onCategoryChange(e.target.value === "all" ? "" : e.target.value)}
              >
                <option value="all">All categories</option>
                {categories.map((category) => (
                  <option key={category.categoryId} value={category.categoryId}>
                    {category.categoryName}
                  </option>
                ))}
              </Select>
            </label>

            <label className="block">
              <span className="field-label">Sort</span>
              <Select value={sortOrder} onChange={(e) => onSortChange(e.target.value)}>
                <option value="date:asc">Soonest first</option>
                <option value="date:desc">Latest first</option>
                <option value="price:asc">Lowest price</option>
                <option value="price:desc">Highest price</option>
              </Select>
            </label>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
          <StatBox label="Live events" value={`${total}`} hint="Current results in this discovery window." />
          <StatBox label="Radius" value={`${radiusKm} km`} hint="Search map radius around the selected area." />
        </div>
      </div>

      <Cluster gap="sm" className="mt-5 border-t border-[var(--color-border)] pt-4 text-sm text-[var(--color-text-secondary)]">
        <span className="rounded-full border border-[var(--color-border-strong)] bg-white/[0.05] px-3 py-1.5">
          {total} events available
        </span>
        <span className="rounded-full border border-[var(--color-border-strong)] bg-white/[0.05] px-3 py-1.5">
          Radius {radiusKm} km
        </span>
        <span className="rounded-full border border-[var(--color-border-strong)] bg-white/[0.05] px-3 py-1.5">
          Sort by date or price
        </span>
      </Cluster>
    </Card>
  );
}

function StatBox({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="surface-card-muted rounded-[var(--radius-md)] p-4">
      <p className="heading-kicker">{label}</p>
      <p className="mt-2 text-3xl font-semibold tracking-[-0.05em] text-[var(--color-text-primary)]">{value}</p>
      <p className="mt-2 text-sm leading-6 text-[var(--color-text-secondary)]">{hint}</p>
    </div>
  );
}

function SearchIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}
