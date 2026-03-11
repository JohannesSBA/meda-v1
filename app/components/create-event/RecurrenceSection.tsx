/**
 * RecurrenceSection -- Recurring event configuration (daily, weekly, custom weekdays).
 *
 * Renders frequency select, interval input, weekday toggles for custom, and repeat-until date.
 */

"use client";

import { Input } from "@/app/components/ui/input";
import { Select } from "@/app/components/ui/select";
import { WEEKDAY_OPTIONS } from "./types";

type RecurrenceSectionProps = {
  isRecurring: boolean;
  recurrenceFrequency: string;
  recurrenceInterval: string;
  recurrenceUntil: string;
  recurrenceWeekdays: string;
  onRecurrenceChange: (field: string, value: string | boolean) => void;
};

export function RecurrenceSection({
  isRecurring,
  recurrenceFrequency,
  recurrenceInterval,
  recurrenceUntil,
  recurrenceWeekdays,
  onRecurrenceChange,
}: RecurrenceSectionProps) {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    onRecurrenceChange(name, value);
  };

  return (
    <div className="space-y-4 rounded-xl border border-white/8 bg-[#0f2336] p-4 shadow-inner shadow-black/20">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-white">
            Recurring event
          </p>
          <p className="text-sm text-[var(--color-text-muted)]">
            Repeat this event daily, weekly, or custom weekdays.
          </p>
        </div>
        <label className="inline-flex items-center gap-2 text-sm text-[#c7d9eb]">
          <input
            type="checkbox"
            checked={isRecurring}
            onChange={(e) =>
              onRecurrenceChange("isRecurring", e.target.checked)
            }
          />
          Enable
        </label>
      </div>

      {isRecurring ? (
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-[var(--color-text-secondary)]">
              Frequency
            </label>
            <Select
              name="recurrenceFrequency"
              value={recurrenceFrequency}
              onChange={handleChange}
              className="h-12 bg-[#112030] px-4"
            >
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="custom">Custom weekly days</option>
            </Select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-[var(--color-text-secondary)]">
              Every
            </label>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min={1}
                name="recurrenceInterval"
                value={recurrenceInterval}
                onChange={handleChange}
                className="h-12 w-24 bg-[#112030] px-4"
              />
              <span className="text-sm text-[var(--color-text-secondary)]">
                {recurrenceFrequency === "daily"
                  ? "day(s)"
                  : "week(s)"}
              </span>
            </div>
          </div>

          {recurrenceFrequency === "custom" ? (
            <div className="md:col-span-2">
              <label className="mb-2 block text-sm font-medium text-[var(--color-text-secondary)]">
                On weekdays
              </label>
              <div className="flex flex-wrap gap-2">
                {WEEKDAY_OPTIONS.map((day) => {
                  const selected = new Set(
                    recurrenceWeekdays.split(",").filter(Boolean),
                  );
                  const isSelected = selected.has(day.value);
                  return (
                    <button
                      key={day.value}
                      type="button"
                      onClick={() => {
                        const current = new Set(
                          recurrenceWeekdays.split(",").filter(Boolean),
                        );
                        if (current.has(day.value))
                          current.delete(day.value);
                        else current.add(day.value);
                        const sorted = [...current].sort(
                          (a, b) => Number(a) - Number(b),
                        );
                        onRecurrenceChange("recurrenceWeekdays", sorted.join(","));
                      }}
                      className={`min-h-[44px] min-w-[44px] rounded-full border px-4 py-2 text-sm font-semibold transition ${
                        isSelected
                          ? "border-[#22FF88] bg-[#22FF88]/20 text-[#bfffe0]"
                          : "border-white/15 bg-white/5 text-[var(--color-text-secondary)] hover:border-[#22FF88]/60"
                      }`}
                    >
                      {day.label}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}

          <div>
            <label className="mb-1 block text-sm font-medium text-[var(--color-text-secondary)]">
              Repeat until
            </label>
            <Input
              type="date"
              name="recurrenceUntil"
              value={recurrenceUntil}
              onChange={handleChange}
              className="h-12 bg-[#112030] px-4"
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}
