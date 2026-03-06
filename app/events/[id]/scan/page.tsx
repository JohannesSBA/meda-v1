import { redirect } from "next/navigation";
import { auth } from "@/lib/auth/server";
import { prisma } from "@/lib/prisma";
import QRScanner from "@/app/components/tickets/QRScanner";

export default async function EventScanPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { data } = await auth.getSession();
  const user = data?.user as { role?: string } | undefined;

  if (user?.role !== "admin") {
    redirect(`/events/${id}`);
  }

  const event = await prisma.event.findUnique({
    where: { eventId: id },
    select: { eventId: true, eventName: true },
  });

  if (!event) {
    redirect("/events");
  }

  return <QRScanner eventId={event.eventId} eventName={event.eventName} />;
}
