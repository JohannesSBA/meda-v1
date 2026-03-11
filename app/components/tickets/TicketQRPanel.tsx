/**
 * TicketQRPanel -- displays QR code for a ticket and share/refund actions.
 */

"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { Card } from "../ui/card";
import { cn } from "../ui/cn";

type Props = {
  eventId: string;
  eventName: string;
  ticketCount: number;
};

const TAB_THRESHOLD = 4;

export default function TicketQRPanel({
  eventId,
  eventName,
  ticketCount,
}: Props) {
  const [attendeeIds, setAttendeeIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch(`/api/events/${eventId}/my-attendees`, {
          cache: "no-store",
        });
        if (!res.ok || cancelled) return;
        const data = await res.json();
        setAttendeeIds(data.attendeeIds ?? []);
      } catch {
        if (!cancelled) setAttendeeIds([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [eventId]);

  if (ticketCount === 0 || loading || attendeeIds.length === 0) return null;

  const hasMultiple = attendeeIds.length > 1;
  const useTabs = hasMultiple && attendeeIds.length < TAB_THRESHOLD;
  const useDropdown = hasMultiple && attendeeIds.length >= TAB_THRESHOLD;

  return (
    <Card className="overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[#0a1927]">
      <div className="border-b border-[var(--color-border)] bg-[#06111c]/80 px-4 py-3">
        <p className="text-base font-semibold text-white">
          Your ticket{attendeeIds.length > 1 ? "s" : ""}
        </p>
        <p className="mt-0.5 text-sm text-[var(--color-text-secondary)]">
          Show this QR code at the event for check-in.
        </p>
      </div>

      {hasMultiple ? (
        <div className="p-4">
          {useTabs ? (
            <div className="mb-3 flex gap-2 overflow-x-auto">
              {attendeeIds.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setActiveIndex(i)}
                  className={cn(
                    "h-11 shrink-0 rounded-lg px-4 text-sm font-medium transition",
                    activeIndex === i
                      ? "bg-[var(--color-brand)] text-[var(--color-brand-text)]"
                      : "bg-[#0f1f2d] text-[var(--color-text-muted)] hover:bg-[#15293d]",
                  )}
                >
                  Ticket {i + 1}
                </button>
              ))}
            </div>
          ) : null}

          {useDropdown ? (
            <div className="mb-3 flex items-center gap-3">
              <select
                value={activeIndex}
                onChange={(e) => setActiveIndex(Number(e.target.value))}
                className="h-11 w-full rounded-lg border border-[var(--color-border)] bg-[#0f1f2d] px-3 text-sm font-medium text-white outline-none focus:border-[var(--color-brand)]"
              >
                {attendeeIds.map((_, i) => (
                  <option key={i} value={i}>
                    Ticket {i + 1} of {attendeeIds.length}
                  </option>
                ))}
              </select>
              <div className="flex shrink-0 gap-1">
                <button
                  type="button"
                  disabled={activeIndex === 0}
                  onClick={() => setActiveIndex((i) => i - 1)}
                  className="flex h-11 w-11 items-center justify-center rounded-lg bg-[#0f1f2d] text-[var(--color-text-muted)] transition hover:bg-[#15293d] disabled:opacity-30"
                  aria-label="Previous ticket"
                >
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M15 18l-6-6 6-6" />
                  </svg>
                </button>
                <button
                  type="button"
                  disabled={activeIndex === attendeeIds.length - 1}
                  onClick={() => setActiveIndex((i) => i + 1)}
                  className="flex h-11 w-11 items-center justify-center rounded-lg bg-[#0f1f2d] text-[var(--color-text-muted)] transition hover:bg-[#15293d] disabled:opacity-30"
                  aria-label="Next ticket"
                >
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9 18l6-6-6-6" />
                  </svg>
                </button>
              </div>
            </div>
          ) : null}

          <div className="flex justify-center rounded-2xl border border-[var(--color-border)] bg-white p-6">
            <Image
              src={`/api/tickets/${attendeeIds[activeIndex]}/qr`}
              alt={`Ticket ${activeIndex + 1} for ${eventName}`}
              width={240}
              height={240}
              unoptimized
              className="h-60 w-60 object-contain"
            />
          </div>
          <p className="mt-2 text-center text-sm text-[var(--color-text-muted)]">
            Ticket {activeIndex + 1} of {attendeeIds.length}
          </p>
          <p className="mt-1 text-center text-sm text-[var(--color-text-muted)]">
            Keep your screen on for check-in
          </p>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-3 p-6">
          <div className="rounded-2xl border border-[var(--color-border)] bg-white p-6">
            <Image
              src={`/api/tickets/${attendeeIds[0]}/qr`}
              alt={`Ticket QR for ${eventName}`}
              width={240}
              height={240}
              unoptimized
              className="h-60 w-60 object-contain"
            />
          </div>
          <p className="text-sm text-[var(--color-text-muted)]">
            Keep your screen on for check-in
          </p>
        </div>
      )}
    </Card>
  );
}
