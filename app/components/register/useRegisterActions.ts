import {
  type Dispatch,
  type SetStateAction,
  useCallback,
  useRef,
  useState,
} from "react";
import { toast } from "sonner";
import { browserApi } from "@/lib/browserApi";
import { getErrorMessage } from "@/lib/errorMessage";

type SearchParamsLike = Pick<URLSearchParams, "toString">;
type RegisterRouter = {
  push: (href: string) => void;
  refresh: () => void;
};

type UseRegisterActionsArgs = {
  router: RegisterRouter;
  pathname: string;
  searchParams: SearchParamsLike;
  selectedEventId: string;
  selectedEndtime: string;
  selectedCapacity: number | null | undefined;
  qty: number;
  remaining: number;
  isPaid: boolean;
  paymentMethod: "chapa" | "balance";
  myTickets: number;
  refundQty: number;
  userId: string | null;
  isSaved: boolean;
  onWaitlist: boolean;
  setMyTickets: Dispatch<SetStateAction<number>>;
  setUserBalance: Dispatch<SetStateAction<number>>;
  setIsSaved: Dispatch<SetStateAction<boolean>>;
  setOnWaitlist: Dispatch<SetStateAction<boolean>>;
  setShowRefundConfirm: Dispatch<SetStateAction<boolean>>;
  setRefundQty: Dispatch<SetStateAction<number>>;
  generateShareLink: (eventId: string) => Promise<void>;
};

export function useRegisterActions({
  router,
  pathname,
  searchParams,
  selectedEventId,
  selectedEndtime,
  selectedCapacity,
  qty,
  remaining,
  isPaid,
  paymentMethod,
  myTickets,
  refundQty,
  userId,
  isSaved,
  onWaitlist,
  setMyTickets,
  setUserBalance,
  setIsSaved,
  setOnWaitlist,
  setShowRefundConfirm,
  setRefundQty,
  generateShareLink,
}: UseRegisterActionsArgs) {
  const [loading, setLoading] = useState(false);
  const [waitlistLoading, setWaitlistLoading] = useState(false);
  const [refundLoading, setRefundLoading] = useState(false);
  const registerSubmittingRef = useRef(false);
  const saveSubmittingRef = useRef(false);

  const handleRegister = useCallback(async () => {
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
          const response = await browserApi.post<{
            quantity?: number;
            newBalance?: number;
          }>("/api/payments/balance", {
            eventId: selectedEventId,
            quantity: qty,
          });
          const addedTickets = Number(response.quantity) || qty;
          toast.success("Payment confirmed from your Meda balance.");
          const nextTicketCount = myTickets + addedTickets;
          setMyTickets(nextTicketCount);
          setUserBalance(Number(response.newBalance) ?? 0);
          if (nextTicketCount > 1) {
            await generateShareLink(selectedEventId);
          }
          router.refresh();
          return;
        }

        const response = await browserApi.post<{ checkoutUrl?: string }>(
          "/api/payments/chapa/checkout",
          {
            eventId: selectedEventId,
            quantity: qty,
          },
        );
        if (!response.checkoutUrl) {
          throw new Error("Checkout URL was not returned");
        }
        window.location.href = response.checkoutUrl;
        return;
      }

      await browserApi.post(`/api/events/${selectedEventId}`, {
        quantity: qty,
        userId,
      });
      toast.success("Registered!");
      const nextTicketCount = myTickets + qty;
      setMyTickets(nextTicketCount);
      if (nextTicketCount > 1) {
        await generateShareLink(selectedEventId);
      }
      router.refresh();
    } catch (error) {
      toast.error(getErrorMessage(error) || "Failed to register");
    } finally {
      setLoading(false);
      registerSubmittingRef.current = false;
    }
  }, [
    generateShareLink,
    isPaid,
    myTickets,
    pathname,
    paymentMethod,
    qty,
    remaining,
    router,
    searchParams,
    selectedCapacity,
    selectedEndtime,
    selectedEventId,
    setMyTickets,
    setUserBalance,
    userId,
  ]);

  const handleToggleSave = useCallback(async () => {
    if (saveSubmittingRef.current) return;
    if (!userId) {
      toast.error("Please sign in to save events.");
      return;
    }

    saveSubmittingRef.current = true;
    try {
      await (isSaved
        ? browserApi.delete("/api/profile/saved-events", { eventId: selectedEventId })
        : browserApi.post("/api/profile/saved-events", { eventId: selectedEventId }));
      setIsSaved(!isSaved);
      toast.success(isSaved ? "Event removed from saved list" : "Event saved", {
        id: `save-${selectedEventId}`,
      });
    } catch (error) {
      toast.error(getErrorMessage(error) || "Save action failed");
    } finally {
      saveSubmittingRef.current = false;
    }
  }, [isSaved, selectedEventId, setIsSaved, userId]);

  const handleRefund = useCallback(async () => {
    if (!userId || refundLoading) return;
    setRefundLoading(true);
    try {
      const data = await browserApi.post<{ amountEtb?: number; ticketCount?: number }>(
        `/api/events/${selectedEventId}/refund`,
        { ticketCount: refundQty },
      );
      const refunded = Number(data.ticketCount) || refundQty;
      const amount = Number(data.amountEtb) || 0;
      setMyTickets((current) => Math.max(0, current - refunded));
      setShowRefundConfirm(false);
      setRefundQty(1);
      toast.success(
        amount > 0
          ? `Refund processed. ETB ${amount} credited to your balance.`
          : `${refunded} ticket${refunded === 1 ? "" : "s"} cancelled.`,
      );
      router.refresh();
      setTimeout(() => router.refresh(), 5000);
    } catch (error) {
      toast.error(getErrorMessage(error) || "Failed to process refund");
    } finally {
      setRefundLoading(false);
    }
  }, [
    refundLoading,
    refundQty,
    router,
    selectedEventId,
    setMyTickets,
    setRefundQty,
    setShowRefundConfirm,
    userId,
  ]);

  const handleWaitlistToggle = useCallback(async () => {
    setWaitlistLoading(true);
    try {
      if (onWaitlist) {
        await browserApi.delete(`/api/events/${selectedEventId}/waitlist`);
        setOnWaitlist(false);
        toast.success("Left waitlist");
      } else {
        await browserApi.post(`/api/events/${selectedEventId}/waitlist`);
        setOnWaitlist(true);
        toast.success("You're on the waitlist!");
      }
    } catch (error) {
      toast.error(getErrorMessage(error) || "Failed");
    } finally {
      setWaitlistLoading(false);
    }
  }, [onWaitlist, selectedEventId, setOnWaitlist]);

  return {
    loading,
    waitlistLoading,
    refundLoading,
    handleRegister,
    handleToggleSave,
    handleRefund,
    handleWaitlistToggle,
  };
}
