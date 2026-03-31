import { BookingStatus, Prisma, SlotStatus } from "@/generated/prisma/client";
import { ACTIVE_CAPACITY_BOOKING_STATUSES } from "@/services/bookingDomain";

type TransactionClient = Prisma.TransactionClient;

export async function getRemainingCapacityTx(args: {
  tx: TransactionClient;
  slotId: string;
  capacity: number;
  now: Date;
  excludeBookingId?: string;
}) {
  const aggregate = await args.tx.booking.aggregate({
    where: {
      slotId: args.slotId,
      id: args.excludeBookingId ? { not: args.excludeBookingId } : undefined,
      OR: [
        {
          status: {
            in: [...ACTIVE_CAPACITY_BOOKING_STATUSES],
          },
        },
        {
          status: BookingStatus.PENDING,
          expiresAt: {
            gt: args.now,
          },
        },
      ],
    },
    _sum: {
      quantity: true,
    },
  });

  const reservedQuantity = aggregate._sum.quantity ?? 0;
  return Math.max(0, args.capacity - reservedQuantity);
}

export async function recomputeSlotStatusTx(
  tx: TransactionClient,
  slotId: string,
  now = new Date(),
) {
  const slot = await tx.bookableSlot.findUnique({
    where: { id: slotId },
    select: {
      id: true,
      capacity: true,
      status: true,
    },
  });

  if (!slot) return null;
  if (slot.status === SlotStatus.BLOCKED || slot.status === SlotStatus.CANCELLED) {
    return slot.status;
  }

  const remainingCapacity = await getRemainingCapacityTx({
    tx,
    slotId,
    capacity: slot.capacity,
    now,
  });

  let nextStatus: SlotStatus = SlotStatus.OPEN;
  if (remainingCapacity <= 0) {
    nextStatus = SlotStatus.BOOKED;
  } else if (remainingCapacity < slot.capacity) {
    nextStatus = SlotStatus.RESERVED;
  }

  if (slot.status !== nextStatus) {
    await tx.bookableSlot.update({
      where: { id: slot.id },
      data: { status: nextStatus },
    });
  }

  return nextStatus;
}
