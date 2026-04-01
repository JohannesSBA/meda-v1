import { notFound } from "next/navigation";
import { getPublicSlotById } from "@/services/slots";
import { SlotBookingFlow } from "./slot-booking-flow";

export default async function SlotBookingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  try {
    const slot = await getPublicSlotById(id);
    return <SlotBookingFlow slot={slot} />;
  } catch {
    return notFound();
  }
}
