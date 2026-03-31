import { listOwnerSlots } from "@/services/slots";

export type CalendarView = "month" | "week" | "day";

function toDayKey(value: string) {
  return value.slice(0, 10);
}

export async function getOwnerCalendar(args: {
  ownerId: string;
  from: Date;
  to: Date;
  view: CalendarView;
  pitchId?: string;
}) {
  const slots = await listOwnerSlots({
    ownerId: args.ownerId,
    from: args.from,
    to: args.to,
    pitchId: args.pitchId,
  });

  const dailyMap = new Map<
    string,
    {
      date: string;
      slotCount: number;
      bookingCount: number;
      assignedTicketCount: number;
      checkedInCount: number;
      utilization: number;
      revenueSummaryEtb: number;
    }
  >();

  for (const slot of slots) {
    const dayKey = toDayKey(slot.startsAt);
    const current = dailyMap.get(dayKey) ?? {
      date: dayKey,
      slotCount: 0,
      bookingCount: 0,
      assignedTicketCount: 0,
      checkedInCount: 0,
      utilization: 0,
      revenueSummaryEtb: 0,
    };

    current.slotCount += 1;
    current.bookingCount += slot.bookingCount;
    current.assignedTicketCount += slot.assignedTicketCount;
    current.checkedInCount += slot.checkedInCount;
    current.revenueSummaryEtb += slot.revenueSummaryEtb;
    current.utilization += slot.utilization;

    dailyMap.set(dayKey, current);
  }

  const days = Array.from(dailyMap.values())
    .map((day) => ({
      ...day,
      utilization:
        day.slotCount > 0 ? Number((day.utilization / day.slotCount).toFixed(4)) : 0,
    }))
    .sort((left, right) => left.date.localeCompare(right.date));

  const totals = slots.reduce(
    (summary, slot) => {
      summary.slotCount += 1;
      summary.bookingCount += slot.bookingCount;
      summary.assignedTicketCount += slot.assignedTicketCount;
      summary.checkedInCount += slot.checkedInCount;
      summary.revenueSummaryEtb += slot.revenueSummaryEtb;
      summary.utilization += slot.utilization;
      return summary;
    },
    {
      slotCount: 0,
      bookingCount: 0,
      assignedTicketCount: 0,
      checkedInCount: 0,
      revenueSummaryEtb: 0,
      utilization: 0,
    },
  );

  return {
    view: args.view,
    from: args.from.toISOString(),
    to: args.to.toISOString(),
    slots,
    days,
    totals: {
      ...totals,
      utilization:
        totals.slotCount > 0 ? Number((totals.utilization / totals.slotCount).toFixed(4)) : 0,
    },
  };
}
