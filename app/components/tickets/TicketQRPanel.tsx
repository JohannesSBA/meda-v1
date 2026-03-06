"use client";

import { useEffect, useState } from "react";
import { Card } from "../ui/card";
import { cn } from "../ui/cn";

type Props = {
  eventId: string;
  eventName: string;
  ticketCount: number;
};

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

  return (
    <Card className="overflow-hidden rounded-2xl border border-(--color-border) bg-[#0a1927]">
      <div className="border-b border-(--color-border) bg-[#06111c]/80 px-4 py-3">
        <p className="text-sm font-semibold text-white">
          Your ticket{attendeeIds.length > 1 ? "s" : ""}
        </p>
        <p className="mt-0.5 text-xs text-(--color-text-secondary)">
          Show this QR code at the event for check-in.
        </p>
      </div>

      {hasMultiple ? (
        <div className="p-4">
          <div className="mb-3 flex gap-2">
            {attendeeIds.map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setActiveIndex(i)}
                className={cn(
                  "rounded-lg px-3 py-1.5 text-xs font-medium transition",
                  activeIndex === i
                    ? "bg-[var(--color-brand)] text-[var(--color-brand-text)]"
                    : "bg-[#0f1f2d] text-(--color-text-muted) hover:bg-[#15293d] hover:text-(--color-text-secondary)",
                )}
              >
                Ticket {i + 1}
              </button>
            ))}
          </div>
          <div className="flex justify-center rounded-2xl border border-(--color-border) bg-white p-6">
            <img
              src={`/api/tickets/${attendeeIds[activeIndex]}/qr`}
              alt={`Ticket ${activeIndex + 1} for ${eventName}`}
              width={200}
              height={200}
              className="h-48 w-48 object-contain sm:h-56 sm:w-56"
            />
          </div>
          <p className="mt-2 text-center text-xs text-(--color-text-muted)">
            Ticket {activeIndex + 1} of {attendeeIds.length}
          </p>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-3 p-6">
          <div className="rounded-2xl border border-(--color-border) bg-white p-5">
            <img
              src={`/api/tickets/${attendeeIds[0]}/qr`}
              alt={`Ticket QR for ${eventName}`}
              width={200}
              height={200}
              className="h-48 w-48 object-contain sm:h-56 sm:w-56"
            />
          </div>
        </div>
      )}
    </Card>
  );
}
