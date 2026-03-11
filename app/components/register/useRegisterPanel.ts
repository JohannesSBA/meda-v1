/**
 * useRegisterPanel -- Custom hook for event registration panel state and logic.
 *
 * Manages occurrence selection, quantity, payment confirmation, share link,
 * waitlist, refund flow, and all registration/payment handlers.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { EventOccurrence, EventResponse } from "@/app/types/eventTypes";
import { authClient } from "@/lib/auth/client";
import { MAX_TICKETS_PER_USER_PER_EVENT, REFUND_CUTOFF_HOURS } from "@/lib/constants";
import { getErrorMessage } from "@/lib/errorMessage";
import { toast } from "sonner";

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

  const decodedSelectedFromQuery = useMemo(() => {
    const q = searchParams.get("occurrence");
    if (!q) return null;
    try {
      return decodeURIComponent(q);
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

  const [selectedEventId, setSelectedEventId] = useState(() => {
    if (
      decodedSelectedFromQuery &&
      occurrenceOptions.some((o) => o.eventId === decodedSelectedFromQuery)
    )
      return decodedSelectedFromQuery;
    return occurrenceOptions[0]?.eventId ?? event.eventId;
  });
  const [qty, setQty] = useState(1);
  const [loading, setLoading] = useState(false);
  const [confirmingPayment, setConfirmingPayment] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [shareLoading, setShareLoading] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [remainingClaims, setRemainingClaims] = useState<number>(0);
  const [shareCopied, setShareCopied] = useState(false);
  const [onWaitlist, setOnWaitlist] = useState(false);
  const [waitlistLoading, setWaitlistLoading] = useState(false);
  const [myTickets, setMyTickets] = useState<number>(
    occurrenceOptions[0]?.myTickets ?? event.myTickets ?? 0,
  );
  const [userId, setUserId] = useState<string | null>(null);
  const [refundLoading, setRefundLoading] = useState(false);
  const [refundQty, setRefundQty] = useState(1);
  const [showRefundConfirm, setShowRefundConfirm] = useState(false);
  const [userBalance, setUserBalance] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState<"chapa" | "balance">("chapa");

  const selectedOccurrence =
    occurrenceOptions.find((entry) => entry.eventId === selectedEventId) ??
    occurrenceOptions[0];
  const selectedEndtime =
    selectedOccurrence?.eventEndtime ?? event.eventEndtime;
  const selectedCapacity = selectedOccurrence?.capacity ?? event.capacity;
  const remaining =
    selectedCapacity != null ? Math.max(selectedCapacity, 0) : Infinity;
  const maxQty = Math.min(
    MAX_TICKETS_PER_USER_PER_EVENT,
    remaining || MAX_TICKETS_PER_USER_PER_EVENT,
  );
  const soldOutForSelection =
    selectedCapacity != null ? remaining <= 0 : isSoldOut;
  const canShareTickets = myTickets > 1;
  const selectedDatetime =
    selectedOccurrence?.eventDatetime ?? event.eventDatetime;
  const hoursUntilEvent =
    (new Date(selectedDatetime).getTime() - Date.now()) / (1000 * 60 * 60);
  const refundEligible = myTickets > 0 && hoursUntilEvent >= REFUND_CUTOFF_HOURS;
  const isPaid = (event.priceField ?? 0) > 0;

  useEffect(() => {
    if (!decodedSelectedFromQuery) return;
    const exists = occurrenceOptions.some(
      (entry) => entry.eventId === decodedSelectedFromQuery,
    );
    if (!exists) return;
    setSelectedEventId(decodedSelectedFromQuery);
  }, [decodedSelectedFromQuery, occurrenceOptions]);

  const fetchMyTickets = useCallback(
    async (uid: string, targetEventId: string) => {
      try {
        const res = await fetch(`/api/events/${targetEventId}?userId=${uid}`, {
          cache: "no-store",
        });
        if (!res.ok) return;
        const data = await res.json();
        setMyTickets(data.event?.myTickets ?? 0);
      } catch (err) {
        console.error(err);
      }
    },
    [],
  );

  useEffect(() => {
    let cancelled = false;
    authClient.getSession().then((session) => {
      if (!cancelled) {
        setUserId(session.data?.user?.id ?? null);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    setShareUrl(null);
    setRemainingClaims(0);
    setShareCopied(false);
  }, [selectedEventId]);

  useEffect(() => {
    if (!userId) {
      setMyTickets(selectedOccurrence?.myTickets ?? 0);
      return;
    }
    fetchMyTickets(userId, selectedEventId);
  }, [selectedEventId, userId, fetchMyTickets, selectedOccurrence?.myTickets]);

  const generateShareLink = useCallback(
    async (targetEventId: string) => {
      if (!userId) return;
      setShareLoading(true);
      try {
        const res = await fetch("/api/tickets/share/create", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ eventId: targetEventId }),
        });
        const data = await res.json();
        if (!res.ok)
          throw new Error(data?.error || "Unable to create share link");
        setShareUrl(data.shareUrl ?? null);
        setRemainingClaims(Number(data.remainingClaims) || 0);
      } catch (err) {
        toast.error(getErrorMessage(err) || "Unable to create share link");
      } finally {
        setShareLoading(false);
      }
    },
    [userId],
  );

  useEffect(() => {
    if (!userId || !soldOutForSelection || myTickets > 0) {
      setOnWaitlist(false);
      return;
    }
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch(`/api/events/${selectedEventId}/waitlist`, {
          cache: "no-store",
        });
        if (cancelled || !res.ok) return;
        const data = await res.json();
        if (!cancelled) setOnWaitlist(data.onWaitlist ?? false);
      } catch {
        if (!cancelled) setOnWaitlist(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [selectedEventId, userId, soldOutForSelection, myTickets]);

  useEffect(() => {
    if (!userId || !isPaid) return;
    let cancelled = false;
    const loadBalance = async () => {
      try {
        const res = await fetch("/api/profile/balance", { cache: "no-store" });
        if (cancelled || !res.ok) return;
        const data = await res.json();
        if (cancelled) return;
        const bal = Number(data.balanceEtb) || 0;
        setUserBalance(bal);
        if (bal <= 0) setPaymentMethod("chapa");
      } catch {
        // silently ignore
      }
    };
    void loadBalance();
    return () => {
      cancelled = true;
    };
  }, [userId, isPaid]);

  useEffect(() => {
    if (!userId) {
      setIsSaved(false);
      return;
    }
    let cancelled = false;
    const loadSaved = async () => {
      try {
        const res = await fetch("/api/profile/saved-events", {
          cache: "no-store",
        });
        if (cancelled || !res.ok) return;
        const data = await res.json();
        if (cancelled) return;
        const items = Array.isArray(data?.items) ? data.items : [];
        setIsSaved(
          items.some(
            (item: { eventId?: string }) => item.eventId === selectedEventId,
          ),
        );
      } catch {
        // silently ignore
      }
    };
    void loadSaved();
    return () => {
      cancelled = true;
    };
  }, [selectedEventId, userId]);

  const paymentProvider = useMemo(
    () => searchParams.get("payment") ?? searchParams.get("amp;payment"),
    [searchParams],
  );
  const txRef = useMemo(
    () =>
      searchParams.get("tx_ref") ??
      searchParams.get("txRef") ??
      searchParams.get("amp;tx_ref") ??
      searchParams.get("amp%3Btx_ref"),
    [searchParams],
  );

  const confirmedTxRefRef = useRef<string | null>(null);
  const registerSubmittingRef = useRef(false);
  const saveSubmittingRef = useRef(false);

  useEffect(() => {
    if (!userId || paymentProvider !== "chapa" || !txRef) {
      setConfirmingPayment(false);
      confirmedTxRefRef.current = null;
      return;
    }
    if (confirmedTxRefRef.current === txRef) return;
    confirmedTxRefRef.current = txRef;

    let cancelled = false;
    const confirmPayment = async () => {
      setConfirmingPayment(true);
      try {
        const response = await axios.post("/api/payments/chapa/confirm", {
          txRef,
        });
        const addedTickets = Number(response.data?.quantity) || 0;
        if (!cancelled && addedTickets > 0) {
          const nextTicketCount = myTickets + addedTickets;
          setMyTickets(nextTicketCount);
          if (nextTicketCount > 1) {
            const targetEventId =
              decodedSelectedFromQuery &&
              occurrenceOptions.some(
                (entry) => entry.eventId === decodedSelectedFromQuery,
              )
                ? decodedSelectedFromQuery
                : selectedEventId;
            void generateShareLink(targetEventId);
          }
        }
        if (!cancelled) {
          toast.success("Payment confirmed. Ticket added.", {
            id: `payment-${txRef}`,
          });
          const returnEventId =
            decodedSelectedFromQuery &&
            occurrenceOptions.some(
              (entry) => entry.eventId === decodedSelectedFromQuery,
            )
              ? decodedSelectedFromQuery
              : selectedEventId;
          const encodedOccurrence = encodeURIComponent(returnEventId);
          router.replace(
            `/events/${returnEventId}?occurrence=${encodedOccurrence}`,
          );
          router.refresh();
        }
      } catch (err) {
        if (!cancelled) {
          toast.error(getErrorMessage(err) || "Unable to confirm payment", {
            id: `payment-error-${txRef}`,
          });
        }
      } finally {
        setConfirmingPayment(false);
      }
    };

    confirmPayment();
    return () => {
      cancelled = true;
    };
  }, [
    decodedSelectedFromQuery,
    generateShareLink,
    myTickets,
    occurrenceOptions,
    router,
    paymentProvider,
    txRef,
    selectedEventId,
    userId,
  ]);

  const handleRegister = async () => {
    if (registerSubmittingRef.current) return;
    if (!userId) {
      const redirect =
        pathname +
        (searchParams.toString() ? `?${searchParams.toString()}` : "");
      router.push(`/auth/sign-in?redirect=${encodeURIComponent(redirect)}`);
      return;
    }
    if (selectedEndtime && new Date(selectedEndtime) <= new Date()) {
      toast.error("This event has ended");
      return;
    }
    if (selectedCapacity != null && qty > remaining) {
      toast.error("Not enough seats left");
      return;
    }
    registerSubmittingRef.current = true;
    setLoading(true);
    try {
      if (isPaid) {
        if (paymentMethod === "balance") {
          const response = await axios.post("/api/payments/balance", {
            eventId: selectedEventId,
            quantity: qty,
          });
          const addedTickets = Number(response.data?.quantity) || qty;
          toast.success("Payment confirmed from your Meda balance.");
          const nextTicketCount = myTickets + addedTickets;
          setMyTickets(nextTicketCount);
          setUserBalance(Number(response.data?.newBalance) ?? 0);
          if (nextTicketCount > 1) {
            void generateShareLink(selectedEventId);
          }
          router.refresh();
          setLoading(false);
          registerSubmittingRef.current = false;
          return;
        }

        const response = await axios.post("/api/payments/chapa/checkout", {
          eventId: selectedEventId,
          quantity: qty,
        });
        const checkoutUrl = response.data?.checkoutUrl;
        if (!checkoutUrl) {
          throw new Error("Checkout URL was not returned");
        }
        setLoading(false);
        window.location.href = checkoutUrl;
        return;
      }

      await axios.post(`/api/events/${selectedEventId}`, {
        quantity: qty,
        userId,
      });
      toast.success("Registered!");
      const nextTicketCount = myTickets + qty;
      setMyTickets(nextTicketCount);
      if (nextTicketCount > 1) {
        void generateShareLink(selectedEventId);
      }
      router.refresh();
    } catch (err) {
      toast.error(getErrorMessage(err) || "Failed to register");
    } finally {
      setLoading(false);
      registerSubmittingRef.current = false;
    }
  };

  const handleCopyShareLink = async () => {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setShareCopied(true);
      window.setTimeout(() => setShareCopied(false), 1500);
      toast.success("Share link copied");
    } catch {
      toast.error("Unable to copy share link");
    }
  };

  const handleToggleSave = async () => {
    if (saveSubmittingRef.current) return;
    if (!userId) {
      toast.error("Please sign in to save events.");
      return;
    }
    saveSubmittingRef.current = true;
    try {
      const res = await fetch("/api/profile/saved-events", {
        method: isSaved ? "DELETE" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ eventId: selectedEventId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Save action failed");
      setIsSaved(!isSaved);
      toast.success(isSaved ? "Event removed from saved list" : "Event saved", {
        id: `save-${selectedEventId}`,
      });
    } catch (err) {
      toast.error(getErrorMessage(err) || "Save action failed");
    } finally {
      saveSubmittingRef.current = false;
    }
  };

  const handleRefund = async () => {
    if (!userId || refundLoading) return;
    setRefundLoading(true);
    try {
      const res = await fetch(`/api/events/${selectedEventId}/refund`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ticketCount: refundQty }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to process refund");
      const refunded = Number(data.ticketCount) || refundQty;
      const amount = Number(data.amountEtb) || 0;
      setMyTickets((prev) => Math.max(0, prev - refunded));
      setShowRefundConfirm(false);
      setRefundQty(1);
      toast.success(
        amount > 0
          ? `Refund processed. ETB ${amount} credited to your balance.`
          : `${refunded} ticket${refunded === 1 ? "" : "s"} cancelled.`,
      );
      router.refresh();
      setTimeout(() => router.refresh(), 5000);
    } catch (err) {
      toast.error(getErrorMessage(err) || "Failed to process refund");
    } finally {
      setRefundLoading(false);
    }
  };

  const handleWaitlistToggle = async () => {
    setWaitlistLoading(true);
    try {
      const method = onWaitlist ? "DELETE" : "POST";
      const res = await fetch(`/api/events/${selectedEventId}/waitlist`, {
        method,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed");
      setOnWaitlist(!onWaitlist);
      toast.success(
        onWaitlist ? "Left waitlist" : "You're on the waitlist!",
      );
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setWaitlistLoading(false);
    }
  };

  return {
    event,
    occurrenceOptions,
    selectedEventId,
    setSelectedEventId,
    qty,
    setQty,
    maxQty,
    loading,
    confirmingPayment,
    isSaved,
    shareLoading,
    shareUrl,
    remainingClaims,
    shareCopied,
    onWaitlist,
    waitlistLoading,
    myTickets,
    userId,
    refundLoading,
    refundQty,
    setRefundQty,
    showRefundConfirm,
    setShowRefundConfirm,
    userBalance,
    paymentMethod,
    setPaymentMethod,
    soldOutForSelection,
    remaining,
    canShareTickets,
    refundEligible,
    isPaid,
    handleRegister,
    handleCopyShareLink,
    handleToggleSave,
    handleRefund,
    handleWaitlistToggle,
    generateShareLink,
  };
}
