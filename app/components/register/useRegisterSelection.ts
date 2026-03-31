import { useCallback, useMemo, useState } from "react";
import type { EventOccurrence, EventResponse } from "@/app/types/eventTypes";
import { MAX_TICKETS_PER_USER_PER_EVENT } from "@/lib/constants";

type SearchParamsLike = Pick<URLSearchParams, "get">;

type UseRegisterSelectionArgs = {
  event: EventResponse;
  isSoldOut: boolean;
  occurrences: EventOccurrence[];
  searchParams: SearchParamsLike;
};

function clampTicketCount(value: number, maxQty: number) {
  return Math.max(1, Math.min(maxQty, value || 1));
}

export function useRegisterSelection({
  event,
  isSoldOut,
  occurrences,
  searchParams,
}: UseRegisterSelectionArgs) {
  const decodedSelectedFromQuery = useMemo(() => {
    const query = searchParams.get("occurrence");
    if (!query) return null;
    try {
      return decodeURIComponent(query);
    } catch {
      return null;
    }
  }, [searchParams]);

  const occurrenceOptions = useMemo(
    () =>
      occurrences.length > 0
        ? occurrences
        : [
            {
              eventId: event.eventId,
              eventDatetime: event.eventDatetime,
              eventEndtime: event.eventEndtime,
              attendeeCount: event.attendeeCount ?? 0,
              myTickets: event.myTickets ?? 0,
              capacity: event.capacity ?? null,
              occurrenceIndex: event.occurrenceIndex ?? null,
            },
          ],
    [event, occurrences],
  );

  const [manualSelectedEventId, setManualSelectedEventId] = useState<string | null>(
    null,
  );
  const [qtyState, setQtyState] = useState(1);
  const [refundQtyState, setRefundQtyState] = useState(1);
  const [showRefundConfirm, setShowRefundConfirm] = useState(false);

  const selectedEventId = useMemo(() => {
    if (
      manualSelectedEventId &&
      occurrenceOptions.some((option) => option.eventId === manualSelectedEventId)
    ) {
      return manualSelectedEventId;
    }
    if (
      decodedSelectedFromQuery &&
      occurrenceOptions.some((option) => option.eventId === decodedSelectedFromQuery)
    ) {
      return decodedSelectedFromQuery;
    }
    return occurrenceOptions[0]?.eventId ?? event.eventId;
  }, [
    decodedSelectedFromQuery,
    event.eventId,
    manualSelectedEventId,
    occurrenceOptions,
  ]);

  const selectedOccurrence =
    occurrenceOptions.find((entry) => entry.eventId === selectedEventId) ??
    occurrenceOptions[0];
  const selectedEndtime = selectedOccurrence?.eventEndtime ?? event.eventEndtime;
  const selectedCapacity = selectedOccurrence?.capacity ?? event.capacity;
  const remaining =
    selectedCapacity != null ? Math.max(selectedCapacity, 0) : Infinity;
  const maxQty = Math.max(
    1,
    remaining === Infinity
      ? MAX_TICKETS_PER_USER_PER_EVENT
      : Math.min(MAX_TICKETS_PER_USER_PER_EVENT, remaining),
  );
  const soldOutForSelection =
    selectedCapacity != null ? remaining <= 0 : isSoldOut;
  const selectedDatetime =
    selectedOccurrence?.eventDatetime ?? event.eventDatetime;
  const isPaid = (event.priceField ?? 0) > 0;

  const setSelectedEventId = useCallback((nextEventId: string) => {
    setManualSelectedEventId(nextEventId);
  }, []);

  const qty = clampTicketCount(qtyState, maxQty);
  const setQty = useCallback(
    (next: number | ((current: number) => number)) => {
      setQtyState((current) => {
        const currentValue = clampTicketCount(current, maxQty);
        const resolved =
          typeof next === "function" ? next(currentValue) : next;
        return clampTicketCount(resolved, maxQty);
      });
    },
    [maxQty],
  );

  const refundQty = Math.max(1, refundQtyState || 1);
  const setRefundQty = useCallback(
    (next: number | ((current: number) => number)) => {
      setRefundQtyState((current) => {
        const currentValue = Math.max(1, current || 1);
        const resolved =
          typeof next === "function" ? next(currentValue) : next;
        return Math.max(1, resolved || 1);
      });
    },
    [],
  );

  return {
    decodedSelectedFromQuery,
    occurrenceOptions,
    selectedEventId,
    setSelectedEventId,
    selectedOccurrence,
    selectedEndtime,
    selectedCapacity,
    selectedDatetime,
    remaining,
    maxQty,
    soldOutForSelection,
    qty,
    setQty,
    refundQty,
    setRefundQty,
    showRefundConfirm,
    setShowRefundConfirm,
    isPaid,
  };
}
