/**
 * EventFilterBar -- Search, date, category, sort controls and live stats for events listing.
 */

"use client";

import { useState } from "react";
import { Card } from "@/app/components/ui/card";
import { Input } from "@/app/components/ui/input";
import { Select } from "@/app/components/ui/select";
import { Cluster } from "@/app/components/ui/primitives";
import { Button } from "@/app/components/ui/button";

type CategoryItem = { categoryId: string; categoryName: string };

type EventFilterBarProps = {
  search: string;
  datePreset: string;
  categoryId: string;
  sortOrder: string;
  total: number;
  radiusKm: number;
  categories: CategoryItem[];
  kicker?: string;
  title?: string;
  description?: string;
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
  kicker = "Find a match",
  title = "Find the right match without fighting the interface.",
  description = "Search by name, tighten the date, and pick the match that fits your time, place, and price.",
  onSearchChange,
  onDateRangeChange,
  onCategoryChange,
  onSortChange,
}: EventFilterBarProps) {
  const [showMoreFilters, setShowMoreFilters] = useState(false);

  return (
    <Card className="overflow-hidden p-4 sm:p-6">
      <div className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr] xl:items-end">
        <div className="space-y-4">
          <div className="space-y-3">
            <p className="heading-kicker">{kicker}</p>
            <h1 className="text-balance text-[var(--text-h1)] font-semibold tracking-[-0.05em] text-[var(--color-text-primary)]">
              {title}
            </h1>
            <p className="max-w-2xl text-sm leading-7 text-[var(--color-text-secondary)] sm:text-base">
              {description}
            </p>
          </div>

          <div className="grid gap-3 md:grid-cols-[minmax(0,1.4fr)_minmax(180px,1fr)_auto]">
            <label className="block">
              <span className="field-label">Search</span>
              <div className="relative">
                <Input
                  type="search"
                  placeholder="Search by match name or place"
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

            <div className="flex items-end">
              <Button
                type="button"
                variant="secondary"
                size="md"
                className="w-full rounded-full md:w-auto"
                onClick={() => setShowMoreFilters((current) => !current)}
              >
                {showMoreFilters ? "Hide filters" : "More filters"}
              </Button>
            </div>
          </div>

          {showMoreFilters ? (
            <div className="grid gap-3 md:grid-cols-2">
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
                <span className="field-label">Show first</span>
                <Select value={sortOrder} onChange={(e) => onSortChange(e.target.value)}>
                  <option value="date:asc">Soonest first</option>
                  <option value="date:desc">Latest first</option>
                  <option value="price:asc">Lowest price</option>
                  <option value="price:desc">Highest price</option>
                </Select>
              </label>
            </div>
          ) : null}

          <Cluster gap="sm" className="text-sm text-[var(--color-text-secondary)]">
            <span className="rounded-full border border-[var(--color-border-strong)] bg-white/[0.05] px-3 py-1.5">
              {total} matches in view
            </span>
            <span className="rounded-full border border-[var(--color-border-strong)] bg-white/[0.05] px-3 py-1.5">
              Radius {radiusKm} km
            </span>
            {categoryId ? (
              <span className="rounded-full border border-[var(--color-border-strong)] bg-white/[0.05] px-3 py-1.5">
                Category filtered
              </span>
            ) : null}
          </Cluster>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
          <StatBox label="Matches" value={`${total}`} hint="Current results in this search." />
          <StatBox label="Radius" value={`${radiusKm} km`} hint="Search map radius around the selected area." />
        </div>
      </div>

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
