/**
 * EventFormPreview -- Live preview sidebar for event creation form.
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
    <div className="xl:sticky xl:top-[calc(var(--header-height)+32px)]">
      <Card className="space-y-5 p-6 sm:p-8">
        <div className="space-y-3">
          <p className="heading-kicker">Live preview</p>
          <div className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[linear-gradient(160deg,#102033,#0b1724)] p-5 shadow-[0_18px_36px_rgba(2,6,23,0.24)]">
            <div className="flex items-center justify-between gap-3 text-sm text-[var(--color-text-secondary)]">
              <span>{preview.date}</span>
              <span className="rounded-full bg-[rgba(52,211,153,0.12)] px-3 py-1 text-xs font-semibold text-[var(--color-brand-alt)]">
                {preview.price}
              </span>
            </div>
            <h3 className="mt-4 text-2xl font-semibold tracking-[-0.04em] text-[var(--color-text-primary)]">{preview.title}</h3>
            <p className="mt-2 text-sm leading-6 text-[var(--color-text-secondary)]">{preview.location}</p>
            <div className="mt-4 flex flex-wrap gap-2 text-sm text-[var(--color-text-muted)]">
              <span className="rounded-full border border-[var(--color-border)] bg-white/[0.04] px-3 py-1.5">Capacity: {preview.capacity}</span>
              <span className="rounded-full border border-[var(--color-border)] bg-white/[0.04] px-3 py-1.5">TZ: {timezone || "local"}</span>
            </div>
          </div>
        </div>

        <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-white/[0.03] p-5 text-sm text-[var(--color-text-secondary)]">
          <p className="heading-kicker">Writing tips</p>
          <ul className="mt-4 list-disc space-y-2 pl-5 leading-6">
            <li>Lead with format and level so players self-select.</li>
            <li>Add the exact pin. It improves discovery and trust.</li>
            <li>Images work best at 1200x630 and under 6MB.</li>
          </ul>
        </div>
      </Card>
    </div>
  );
}
