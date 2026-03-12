/**
 * Event scan page -- QR code scanner for event check-in.
 *
 * Requires auth; uses QRScanner component.
 */

import { redirect } from "next/navigation";
import { auth } from "@/lib/auth/server";
import { prisma } from "@/lib/prisma";
import QRScannerClient from "@/app/components/tickets/QRScannerClient";

export default async function EventScanPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { data } = await auth.getSession();
  const user = data?.user as { id?: string; role?: string } | undefined;

  const event = await prisma.event.findUnique({
    where: { eventId: id },
    select: { eventId: true, eventName: true, userId: true },
  });

  if (!event) {
    redirect("/events");
  }

  const canScan = user?.role === "admin" || (user?.id != null && event.userId === user.id);
  if (!canScan) {
    redirect(`/events/${id}`);
  }

  return <QRScannerClient eventId={event.eventId} eventName={event.eventName} />;
}
