/**
 * Ticket verification page -- verifies ticket validity and displays attendee details.
 */

import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/tickets/verificationToken";
import { resolveEventLocation } from "@/lib/location";
import { PageShell } from "@/app/components/ui/page-shell";
import { Card } from "@/app/components/ui/card";

async function verifyTicket(token: string) {
  const attendeeId = verifyToken(token);
  if (!attendeeId) return null;

  const attendee = await prisma.eventAttendee.findUnique({
    where: { attendeeId },
    include: { event: true },
  });
  if (!attendee) return null;

  const location = resolveEventLocation(attendee.event);
  return {
    valid: true,
    eventName: attendee.event.eventName,
    eventDatetime: attendee.event.eventDatetime.toISOString(),
    addressLabel: location.addressLabel,
  };
}

export default async function TicketVerifyPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const result = await verifyTicket(token);
  if (!result) return notFound();

  const dateStr = new Date(result.eventDatetime).toLocaleString();

  return (
    <PageShell>
      <div className="mx-auto flex max-w-md flex-col gap-6 py-12">
        <Card className="rounded-3xl bg-[#0d1a27]/80 p-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[#22FF88]/20">
            <svg
              className="h-8 w-8 text-[#22FF88]"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-white">Ticket verified</h1>
          <p className="mt-2 text-[var(--color-text-secondary)]">
            This ticket is valid for entry.
          </p>
          <div className="mt-6 space-y-2 rounded-xl bg-[#0f1f2d] p-4 text-left">
            <p className="font-semibold text-white">{result.eventName}</p>
            <p className="text-sm text-[var(--color-text-muted)]">{dateStr}</p>
            {result.addressLabel ? (
              <p className="text-sm text-[var(--color-text-muted)]">
                {result.addressLabel}
              </p>
            ) : null}
          </div>
        </Card>
      </div>
    </PageShell>
  );
}
