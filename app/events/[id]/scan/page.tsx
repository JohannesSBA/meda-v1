/**
 * Event scan page -- QR code scanner for event check-in.
 *
 * Requires auth; uses QRScanner component.
 */

import { redirect } from "next/navigation";
import { auth } from "@/lib/auth/server";
import { canScanEvent } from "@/lib/auth/roles";
import { prisma } from "@/lib/prisma";
import QRScannerClient from "@/app/components/tickets/QRScannerClient";

export default async function EventScanPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { data } = await auth.getSession();
  const user = data?.user as
    | { id?: string; role?: string; parentPitchOwnerUserId?: string | null }
    | undefined;

  const event = await prisma.event.findUnique({
    where: { eventId: id },
    select: { eventId: true, eventName: true, userId: true },
  });

  if (!event) {
    redirect("/play?mode=events");
  }

  const canScan = canScanEvent(user ?? null, event.userId);
  if (!canScan) {
    redirect(`/events/${id}`);
  }

  return <QRScannerClient eventId={event.eventId} eventName={event.eventName} />;
}
