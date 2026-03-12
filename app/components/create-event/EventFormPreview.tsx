/**
 * EventFormPreview -- Live preview sidebar for event creation form.
 *
 * Shows title, date, location, price, capacity as the user types.
 * Includes tips for creating effective event listings.
 */

"use client";

import { Card } from "@/app/components/ui/card";

type PreviewData = {
  title: string;
  date: string;
  location: string;
  price: string;
  capacity: string;
};

type EventFormPreviewProps = {
  preview: PreviewData;
  timezone: string;
};

export function EventFormPreview({ preview, timezone }: EventFormPreviewProps) {
  return (
    <Card className="relative z-10 space-y-4 rounded-2xl bg-[#0d1d2e]/70 p-6 backdrop-blur">
      <div className="space-y-1">
        <p className="text-sm uppercase tracking-[0.18em] text-[#7ccfff]">
          Live preview
        </p>
        <div className="rounded-2xl border border-white/10 bg-linear-to-br from-[#0f2235] to-[#0b1624] p-5 shadow-lg shadow-black/30">
          <div className="flex items-center justify-between text-sm text-[var(--color-text-secondary)]">
            <span>{preview.date}</span>
            <span className="rounded-full bg-white/10 px-2 py-1 text-sm text-[#22FF88]">
              {preview.price}
            </span>
          </div>
          <h3 className="mt-3 text-lg font-semibold text-white">
            {preview.title}
          </h3>
          <p className="mt-1 text-sm text-[var(--color-text-secondary)]">{preview.location}</p>
          <div className="mt-3 flex items-center gap-2 text-sm text-[var(--color-text-muted)]">
            <span className="rounded-full bg-white/5 px-2 py-1">
              Capacity: {preview.capacity}
            </span>
            <span className="rounded-full bg-white/5 px-2 py-1">
              TZ: {timezone || "local"}
            </span>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-white/8 bg-[#0f2235] p-4 text-sm text-[var(--color-text-secondary)] shadow-inner shadow-black/20">
        <p className="mb-2 text-sm uppercase tracking-[0.12em] text-[#7ccfff]">
          Tips
        </p>
        <ul className="space-y-2 list-disc pl-4">
          <li>Lead with format and level so players self-select.</li>
          <li>
            Add exact pin; we&apos;ll surface it on the map for nearby players.
          </li>
          <li>Images load best at 1200x630, under 6MB.</li>
        </ul>
      </div>
    </Card>
  );
}
