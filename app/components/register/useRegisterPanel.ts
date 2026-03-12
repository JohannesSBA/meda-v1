/**
 * useRegisterPanel -- Composes focused register hooks for selection, resource state, and mutations.
 */

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { EventOccurrence, EventResponse } from "@/app/types/eventTypes";
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
    generateShareLink: resources.generateShareLink,
  });

  const [comparisonNow, setComparisonNow] = useState(() => Date.now());

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
    resources.myTickets > 0 && hoursUntilEvent >= REFUND_CUTOFF_HOURS;

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
