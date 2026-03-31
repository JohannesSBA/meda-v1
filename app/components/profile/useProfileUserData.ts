import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { browserApi } from "@/lib/browserApi";
import { getErrorMessage } from "@/lib/errorMessage";
import type { RegisteredEventItem, SavedEventItem } from "./types";

export function useProfileUserData(isAdmin: boolean) {
  const router = useRouter();
  const [registeredStatus, setRegisteredStatus] = useState("upcoming");
  const [registeredEvents, setRegisteredEvents] = useState<RegisteredEventItem[]>([]);
  const [registeredLoading, setRegisteredLoading] = useState(false);
  const [registeredError, setRegisteredError] = useState<string | null>(null);

  const [savedEvents, setSavedEvents] = useState<SavedEventItem[]>([]);
  const [savedLoading, setSavedLoading] = useState(false);
  const [savedError, setSavedError] = useState<string | null>(null);

  const [copiedEventId, setCopiedEventId] = useState<string | null>(null);
  const [balance, setBalance] = useState<number>(0);
  const [refundingEventId, setRefundingEventId] = useState<string | null>(null);

  const savedIds = useMemo(
    () => new Set(savedEvents.map((event) => event.eventId)),
    [savedEvents],
  );

  const loadRegisteredEvents = useCallback(async () => {
    if (isAdmin) return;
    setRegisteredLoading(true);
    setRegisteredError(null);
    try {
      const data = await browserApi.get<{ items?: RegisteredEventItem[] }>(
        `/api/profile/registered-events?status=${registeredStatus}&scope=related`,
        { cache: "no-store" },
      );
      setRegisteredEvents(data.items ?? []);
    } catch (error) {
      const message = getErrorMessage(error) || "Failed to load registered events";
      setRegisteredError(message);
      toast.error(message);
    } finally {
      setRegisteredLoading(false);
    }
  }, [isAdmin, registeredStatus]);

  const loadSavedEvents = useCallback(async () => {
    if (isAdmin) return;
    setSavedLoading(true);
    setSavedError(null);
    try {
      const data = await browserApi.get<{ items?: SavedEventItem[] }>(
        "/api/profile/saved-events",
        { cache: "no-store" },
      );
      setSavedEvents(data.items ?? []);
    } catch (error) {
      const message = getErrorMessage(error) || "Failed to load saved events";
      setSavedError(message);
      toast.error(message);
    } finally {
      setSavedLoading(false);
    }
  }, [isAdmin]);

  const loadBalance = useCallback(async () => {
    if (isAdmin) return;
    try {
      const data = await browserApi.get<{ balanceEtb?: number }>(
        "/api/profile/balance",
        { cache: "no-store" },
      );
      setBalance(Number(data.balanceEtb) || 0);
    } catch {
      // Ignore balance load failures in the header/dashboard.
    }
  }, [isAdmin]);

  const toggleSavedEvent = useCallback(
    async (eventId: string, isSaved: boolean) => {
      try {
        await (isSaved
          ? browserApi.delete<{ ok: true }>("/api/profile/saved-events", { eventId })
          : browserApi.post<{ ok: true }>("/api/profile/saved-events", { eventId }));
        toast.success(isSaved ? "Event removed from saved list" : "Event saved", {
          id: `save-${eventId}`,
        });
        await loadSavedEvents();
      } catch (error) {
        toast.error(getErrorMessage(error) || "Save action failed");
      }
    },
    [loadSavedEvents],
  );

  const handleShareLink = useCallback(async (eventId: string) => {
    try {
      const data = await browserApi.post<{ shareUrl?: string }>(
        "/api/tickets/share/create",
        { eventId },
      );
      const shareUrl = String(data?.shareUrl ?? "");
      if (!shareUrl) throw new Error("Share link was not returned");
      await navigator.clipboard.writeText(shareUrl);
      setCopiedEventId(eventId);
      window.setTimeout(() => setCopiedEventId(null), 1500);
      toast.success("Share link copied");
    } catch (error) {
      toast.error(getErrorMessage(error) || "Unable to create share link");
    }
  }, []);

  const handleRefundFromProfile = useCallback(
    async (eventId: string) => {
      setRefundingEventId(eventId);
      try {
        const data = await browserApi.post<{ amountEtb?: number; ticketCount?: number }>(
          `/api/events/${eventId}/refund`,
          {},
        );
        const amount = Number(data.amountEtb) || 0;
        const count = Number(data.ticketCount) || 0;
        toast.success(
          amount > 0
            ? `Refund processed. ETB ${amount} credited to your balance.`
            : `${count} ticket${count === 1 ? "" : "s"} cancelled.`,
        );
        await Promise.all([loadRegisteredEvents(), loadBalance()]);
        setTimeout(() => router.refresh(), 5000);
      } catch (error) {
        toast.error(getErrorMessage(error) || "Refund failed");
      } finally {
        setRefundingEventId(null);
      }
    },
    [loadBalance, loadRegisteredEvents, router],
  );

  useEffect(() => {
    if (isAdmin) return;
    void loadBalance();
  }, [isAdmin, loadBalance]);

  useEffect(() => {
    if (isAdmin) return;
    void loadRegisteredEvents();
  }, [isAdmin, loadRegisteredEvents]);

  useEffect(() => {
    if (isAdmin) return;
    void loadSavedEvents();
  }, [isAdmin, loadSavedEvents]);

  return {
    registeredStatus,
    setRegisteredStatus,
    registeredEvents,
    registeredLoading,
    registeredError,
    loadRegisteredEvents,
    savedEvents,
    savedLoading,
    savedError,
    loadSavedEvents,
    copiedEventId,
    balance,
    refundingEventId,
    savedIds,
    toggleSavedEvent,
    handleShareLink,
    handleRefundFromProfile,
  };
}
