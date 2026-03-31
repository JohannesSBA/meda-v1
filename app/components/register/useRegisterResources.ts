import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { authClient } from "@/lib/auth/client";
import { browserApi } from "@/lib/browserApi";
import { getErrorMessage } from "@/lib/errorMessage";

type UseRegisterResourcesArgs = {
  selectedEventId: string;
  selectedOccurrenceTickets: number;
  selectedOccurrenceRefundableTicketCount: number;
  selectedOccurrenceRefundableAmountEtb: number;
  soldOutForSelection: boolean;
  isPaid: boolean;
};

type TicketStateResponse = {
  event?: {
    myTickets?: number;
    heldTicketCount?: number;
    refundableTicketCount?: number;
    refundableAmountEtb?: number;
  };
};

type TicketState = {
  heldTicketCount: number;
  refundableTicketCount: number;
  refundableAmountEtb: number;
};

export function useRegisterResources({
  selectedEventId,
  selectedOccurrenceTickets,
  selectedOccurrenceRefundableTicketCount,
  selectedOccurrenceRefundableAmountEtb,
  soldOutForSelection,
  isPaid,
}: UseRegisterResourcesArgs) {
  const [userId, setUserId] = useState<string | null>(null);
  const [myTickets, setMyTickets] = useState<number>(selectedOccurrenceTickets);
  const [refundableTicketCount, setRefundableTicketCount] = useState<number>(
    selectedOccurrenceRefundableTicketCount,
  );
  const [refundableAmountEtb, setRefundableAmountEtb] = useState<number>(
    selectedOccurrenceRefundableAmountEtb,
  );
  const [isSaved, setIsSaved] = useState(false);
  const [shareLoading, setShareLoading] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [remainingClaims, setRemainingClaims] = useState(0);
  const [shareCopied, setShareCopied] = useState(false);
  const [onWaitlist, setOnWaitlist] = useState(false);
  const [userBalance, setUserBalance] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState<"chapa" | "balance">("chapa");

  const applyTicketState = useCallback((state: TicketState) => {
    setMyTickets(state.heldTicketCount);
    setRefundableTicketCount(state.refundableTicketCount);
    setRefundableAmountEtb(state.refundableAmountEtb);
  }, []);

  const fetchTicketState = useCallback(async (uid: string, eventId: string) => {
    try {
      const data = await browserApi.get<TicketStateResponse>(
        `/api/events/${eventId}?userId=${uid}`,
        { cache: "no-store" },
      );
      const nextState = {
        heldTicketCount:
          Number(data.event?.heldTicketCount ?? data.event?.myTickets) || 0,
        refundableTicketCount: Number(data.event?.refundableTicketCount) || 0,
        refundableAmountEtb: Number(data.event?.refundableAmountEtb) || 0,
      } satisfies TicketState;
      applyTicketState(nextState);
      return nextState;
    } catch {
      // Ignore ticket count refresh failures and keep stale UI state.
      return null;
    }
  }, [applyTicketState]);

  const refreshUserBalance = useCallback(async () => {
    if (!userId || !isPaid) return null;
    try {
      const data = await browserApi.get<{ balanceEtb?: number }>(
        "/api/profile/balance",
        { cache: "no-store" },
      );
      const balance = Number(data.balanceEtb) || 0;
      setUserBalance(balance);
      if (balance <= 0) setPaymentMethod("chapa");
      return balance;
    } catch {
      return null;
    }
  }, [isPaid, userId]);

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
      applyTicketState({
        heldTicketCount: selectedOccurrenceTickets,
        refundableTicketCount: selectedOccurrenceRefundableTicketCount,
        refundableAmountEtb: selectedOccurrenceRefundableAmountEtb,
      });
      return;
    }
    void fetchTicketState(userId, selectedEventId);
  }, [
    applyTicketState,
    fetchTicketState,
    selectedEventId,
    selectedOccurrenceRefundableAmountEtb,
    selectedOccurrenceRefundableTicketCount,
    selectedOccurrenceTickets,
    userId,
  ]);

  const generateShareLink = useCallback(
    async (eventId: string) => {
      if (!userId) return;
      setShareLoading(true);
      try {
        const data = await browserApi.post<{
          shareUrl?: string;
          remainingClaims?: number;
        }>("/api/tickets/share/create", { eventId });
        setShareUrl(data.shareUrl ?? null);
        setRemainingClaims(Number(data.remainingClaims) || 0);
      } catch (error) {
        toast.error(getErrorMessage(error) || "Unable to create share link");
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
    const loadWaitlist = async () => {
      try {
        const data = await browserApi.get<{ onWaitlist?: boolean }>(
          `/api/events/${selectedEventId}/waitlist`,
          { cache: "no-store" },
        );
        if (!cancelled) {
          setOnWaitlist(Boolean(data.onWaitlist));
        }
      } catch {
        if (!cancelled) setOnWaitlist(false);
      }
    };

    void loadWaitlist();
    return () => {
      cancelled = true;
    };
  }, [myTickets, selectedEventId, soldOutForSelection, userId]);

  useEffect(() => {
    if (!userId || !isPaid) return;

    let cancelled = false;
    const loadBalance = async () => {
      try {
        const balance = await refreshUserBalance();
        if (cancelled) return;
        if (typeof balance === "number") {
          setUserBalance(balance);
        }
      } catch {
        // Ignore balance lookup failures.
      }
    };

    void loadBalance();
    return () => {
      cancelled = true;
    };
  }, [isPaid, refreshUserBalance, userId]);

  useEffect(() => {
    if (!userId) {
      setIsSaved(false);
      return;
    }

    let cancelled = false;
    const loadSaved = async () => {
      try {
        const data = await browserApi.get<{ items?: Array<{ eventId?: string }> }>(
          "/api/profile/saved-events",
          { cache: "no-store" },
        );
        if (cancelled) return;
        const items = Array.isArray(data.items) ? data.items : [];
        setIsSaved(items.some((item) => item.eventId === selectedEventId));
      } catch {
        // Ignore save-state fetch failures.
      }
    };

    void loadSaved();
    return () => {
      cancelled = true;
    };
  }, [selectedEventId, userId]);

  const handleCopyShareLink = useCallback(async () => {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setShareCopied(true);
      window.setTimeout(() => setShareCopied(false), 1500);
      toast.success("Share link copied");
    } catch {
      toast.error("Unable to copy share link");
    }
  }, [shareUrl]);

  return {
    userId,
    myTickets,
    setMyTickets,
    refundableTicketCount,
    refundableAmountEtb,
    isSaved,
    setIsSaved,
    shareLoading,
    shareUrl,
    remainingClaims,
    shareCopied,
    onWaitlist,
    setOnWaitlist,
    userBalance,
    setUserBalance,
    paymentMethod,
    setPaymentMethod,
    refreshTicketState: async (eventId = selectedEventId) => {
      if (!userId) {
        const fallbackState = {
          heldTicketCount: selectedOccurrenceTickets,
          refundableTicketCount: selectedOccurrenceRefundableTicketCount,
          refundableAmountEtb: selectedOccurrenceRefundableAmountEtb,
        } satisfies TicketState;
        applyTicketState(fallbackState);
        return fallbackState;
      }

      return fetchTicketState(userId, eventId);
    },
    refreshUserBalance,
    generateShareLink,
    handleCopyShareLink,
  };
}
