/**
 * useRegisterPanel -- Composes focused register hooks for selection, resource state, and mutations.
 */

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { EventOccurrence, EventResponse } from "@/app/types/eventTypes";
import { browserApi } from "@/lib/browserApi";
import { REFUND_CUTOFF_HOURS } from "@/lib/constants";
import { useRegisterSelection } from "./useRegisterSelection";
import { useRegisterResources } from "./useRegisterResources";
import { useRegisterActions } from "./useRegisterActions";
import { useRegisterPaymentConfirmation } from "./useRegisterPaymentConfirmation";

type RegisterPanelProps = {
  event: EventResponse;
  isSoldOut: boolean;
  occurrences?: EventOccurrence[];
};

export function useRegisterPanel({
  event,
  isSoldOut,
  occurrences = [],
}: RegisterPanelProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const selection = useRegisterSelection({
    event,
    isSoldOut,
    occurrences,
    searchParams,
  });

  const resources = useRegisterResources({
    selectedEventId: selection.selectedEventId,
    selectedOccurrenceTickets: selection.selectedOccurrence?.myTickets ?? event.myTickets ?? 0,
    selectedOccurrenceRefundableTicketCount:
      selection.selectedOccurrence?.refundableTicketCount ??
      event.refundableTicketCount ??
      0,
    selectedOccurrenceRefundableAmountEtb:
      selection.selectedOccurrence?.refundableAmountEtb ??
      event.refundableAmountEtb ??
      0,
    soldOutForSelection: selection.soldOutForSelection,
    isPaid: selection.isPaid,
  });

  const actions = useRegisterActions({
    router,
    pathname,
    searchParams,
    selectedEventId: selection.selectedEventId,
    selectedEndtime: selection.selectedEndtime,
    selectedCapacity: selection.selectedCapacity,
    qty: selection.qty,
    remaining: selection.remaining,
    isPaid: selection.isPaid,
    paymentMethod: resources.paymentMethod,
    myTickets: resources.myTickets,
    refundQty: selection.refundQty,
    userId: resources.userId,
    isSaved: resources.isSaved,
    onWaitlist: resources.onWaitlist,
    setMyTickets: resources.setMyTickets,
    setUserBalance: resources.setUserBalance,
    setIsSaved: resources.setIsSaved,
    setOnWaitlist: resources.setOnWaitlist,
    setShowRefundConfirm: selection.setShowRefundConfirm,
    setRefundQty: selection.setRefundQty,
    refreshTicketState: resources.refreshTicketState,
    refreshUserBalance: resources.refreshUserBalance,
    generateShareLink: resources.generateShareLink,
  });

  const { confirmingPayment } = useRegisterPaymentConfirmation({
    router,
    searchParams,
    userId: resources.userId,
    selectedEventId: selection.selectedEventId,
    decodedSelectedFromQuery: selection.decodedSelectedFromQuery,
    occurrenceOptions: selection.occurrenceOptions,
    myTickets: resources.myTickets,
    setMyTickets: resources.setMyTickets,
    refreshTicketState: resources.refreshTicketState,
    generateShareLink: resources.generateShareLink,
  });

  const [comparisonNow, setComparisonNow] = useState(() => Date.now());
  const [refundQuoteAmountEtb, setRefundQuoteAmountEtb] = useState<number>(0);
  const [refundQuoteLoading, setRefundQuoteLoading] = useState(false);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setComparisonNow(Date.now());
    }, 60_000);
    return () => {
      window.clearInterval(intervalId);
    };
  }, []);

  const canShareTickets = resources.myTickets > 1;
  const hoursUntilEvent = useMemo(
    () =>
      (new Date(selection.selectedDatetime).getTime() - comparisonNow) /
      (1000 * 60 * 60),
    [comparisonNow, selection.selectedDatetime],
  );
  const refundEligible =
    resources.refundableTicketCount > 0 && hoursUntilEvent >= REFUND_CUTOFF_HOURS;
  const holdsTransferredTickets =
    resources.myTickets > 0 && resources.refundableTicketCount === 0;

  useEffect(() => {
    if (!selection.showRefundConfirm || !resources.userId || !refundEligible) return;

    let cancelled = false;
    const loadRefundQuote = async () => {
      setRefundQuoteLoading(true);
      try {
        const data = await browserApi.get<{ amountEtb?: number }>(
          `/api/events/${selection.selectedEventId}/refund?ticketCount=${selection.refundQty}`,
          { cache: "no-store" },
        );
        if (!cancelled) {
          setRefundQuoteAmountEtb(Number(data.amountEtb) || 0);
        }
      } catch {
        if (!cancelled) {
          setRefundQuoteAmountEtb(0);
        }
      } finally {
        if (!cancelled) {
          setRefundQuoteLoading(false);
        }
      }
    };

    void loadRefundQuote();

    return () => {
      cancelled = true;
    };
  }, [
    refundEligible,
    resources.userId,
    selection.refundQty,
    selection.selectedEventId,
    selection.showRefundConfirm,
  ]);

  const activeRefundQuoteAmountEtb =
    selection.showRefundConfirm && refundEligible ? refundQuoteAmountEtb : 0;
  const activeRefundQuoteLoading =
    selection.showRefundConfirm && refundEligible ? refundQuoteLoading : false;

  return {
    event,
    occurrenceOptions: selection.occurrenceOptions,
    selectedEventId: selection.selectedEventId,
    setSelectedEventId: selection.setSelectedEventId,
    qty: selection.qty,
    setQty: selection.setQty,
    maxQty: selection.maxQty,
    loading: actions.loading,
    confirmingPayment,
    isSaved: resources.isSaved,
    shareLoading: resources.shareLoading,
    shareUrl: resources.shareUrl,
    remainingClaims: resources.remainingClaims,
    shareCopied: resources.shareCopied,
    onWaitlist: resources.onWaitlist,
    waitlistLoading: actions.waitlistLoading,
    myTickets: resources.myTickets,
    refundableTicketCount: resources.refundableTicketCount,
    refundableAmountEtb: resources.refundableAmountEtb,
    refundQuoteAmountEtb: activeRefundQuoteAmountEtb,
    refundQuoteLoading: activeRefundQuoteLoading,
    holdsTransferredTickets,
    userId: resources.userId,
    refundLoading: actions.refundLoading,
    refundQty: selection.refundQty,
    setRefundQty: selection.setRefundQty,
    showRefundConfirm: selection.showRefundConfirm,
    setShowRefundConfirm: selection.setShowRefundConfirm,
    userBalance: resources.userBalance,
    paymentMethod: resources.paymentMethod,
    setPaymentMethod: resources.setPaymentMethod,
    soldOutForSelection: selection.soldOutForSelection,
    remaining: selection.remaining,
    canShareTickets,
    refundEligible,
    isPaid: selection.isPaid,
    handleRegister: actions.handleRegister,
    handleCopyShareLink: resources.handleCopyShareLink,
    handleToggleSave: actions.handleToggleSave,
    handleRefund: actions.handleRefund,
    handleWaitlistToggle: actions.handleWaitlistToggle,
    generateShareLink: resources.generateShareLink,
  };
}
