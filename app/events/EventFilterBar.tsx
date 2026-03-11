/**
 * EventFilterBar -- Search, date, category, sort controls and live stats for events listing.
 *
 * Reads filter state from URL params and calls parent handlers on change.
 */

"use client";

import { Card } from "@/app/components/ui/card";
import { Input } from "@/app/components/ui/input";
import { Select } from "@/app/components/ui/select";

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
    <Card className="flex flex-col gap-6 rounded-3xl bg-gradient-to-br from-[#0f2235]/80 via-[#0c1c2d]/70 to-[#0a1523]/80 p-6 backdrop-blur-lg">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="heading-kicker">Discover • Play • Connect</p>
          <h1 className="text-4xl font-bold leading-tight text-white md:text-5xl">
            Find your next event
          </h1>
          <p className="muted-copy mt-2 text-sm">
            Search, sort, and explore experiences happening around you.
          </p>
        </div>
        <div className="flex gap-3">
          <div className="rounded-2xl bg-[var(--color-surface-2)] px-4 py-3 text-left shadow-inner shadow-black/20">
            <p className="text-xs uppercase tracking-[0.14em] text-[var(--color-brand)]">
              Live events
            </p>
            <p className="text-2xl font-bold text-white">{total}</p>
          </div>
          <div className="rounded-2xl bg-[var(--color-surface-2)] px-4 py-3 text-left shadow-inner shadow-black/20">
            <p className="text-xs uppercase tracking-[0.14em] text-[var(--color-brand-alt)]">
              Radius
            </p>
            <p className="text-2xl font-bold text-white">{radiusKm} km</p>
          </div>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-[2fr_1fr] md:items-center">
        <div className="rounded-2xl bg-[var(--color-surface-2)] px-4 py-3 shadow-inner shadow-black/20">
          <Input
            type="search"
            placeholder="Search events by name, vibe, or location..."
            defaultValue={search}
            onChange={(e) => onSearchChange(e.target.value)}
            className="bg-[#0a1927]"
          />
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Select
            value={datePreset || "all"}
            onChange={(e) => onDateRangeChange(e.target.value)}
            className="min-w-[140px] bg-[#0a1927]"
          >
            <option value="all">Any date</option>
            <option value="week">This week</option>
            <option value="weekend">This weekend</option>
            <option value="month">This month</option>
          </Select>
          <Select
            value={categoryId || "all"}
            onChange={(e) =>
              onCategoryChange(e.target.value === "all" ? "" : e.target.value)
            }
            className="min-w-[160px] bg-[#0a1927]"
          >
            <option value="all">All categories</option>
            {categories.map((c) => (
              <option key={c.categoryId} value={c.categoryId}>
                {c.categoryName}
              </option>
            ))}
          </Select>
          <Select
            value={sortOrder}
            onChange={(e) => onSortChange(e.target.value)}
            className="min-w-[180px] bg-[#0a1927]"
          >
            <option value="date:asc">Soonest first</option>
            <option value="date:desc">Latest first</option>
            <option value="price:asc">Lowest price</option>
            <option value="price:desc">Highest price</option>
          </Select>
        </div>
      </div>
    </Card>
  );
}
