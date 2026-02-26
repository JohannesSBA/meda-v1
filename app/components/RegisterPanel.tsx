"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import axios, { isAxiosError } from "axios";
import { toast } from "sonner";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { EventOccurrence, EventResponse } from "@/app/types/eventTypes";
import { authClient } from "@/lib/auth/client";
import { Card } from "@/app/components/ui/card";
import { Badge } from "@/app/components/ui/badge";
import { Select } from "@/app/components/ui/select";
import { Input } from "@/app/components/ui/input";
import { Button } from "@/app/components/ui/button";

function getErrorMessage(err: unknown): string {
  if (isAxiosError(err) && typeof err.response?.data?.error === "string") {
    return err.response.data.error;
  }
  if (err instanceof Error) return err.message;
  if (typeof err === "string") return err;
  return "An error occurred";
}

type Props = {
  event: EventResponse;
  isSoldOut: boolean;
  occurrences?: EventOccurrence[];
};

export default function RegisterPanel({
  event,
  isSoldOut,
  occurrences = [],
}: Props) {
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
  const [myTickets, setMyTickets] = useState<number>(
    occurrenceOptions[0]?.myTickets ?? event.myTickets ?? 0,
  );
  const [userId, setUserId] = useState<string | null>(null);

  const selectedOccurrence =
    occurrenceOptions.find((entry) => entry.eventId === selectedEventId) ??
    occurrenceOptions[0];
  const selectedEndtime =
    selectedOccurrence?.eventEndtime ?? event.eventEndtime;
  const selectedCapacity = selectedOccurrence?.capacity ?? event.capacity;
  const remaining =
    selectedCapacity != null ? Math.max(selectedCapacity, 0) : Infinity;
  const maxQty = Math.min(20, remaining || 20);
  const soldOutForSelection =
    selectedCapacity != null ? remaining <= 0 : isSoldOut;
  const canShareTickets = myTickets > 1;

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
    authClient.getSession().then((session) => {
      const id = session.data?.user?.id ?? null;
      setUserId(id);
    });
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
        if (!res.ok) throw new Error(data?.error || "Unable to create share link");
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
    if (!userId) {
      setIsSaved(false);
      return;
    }
    const loadSaved = async () => {
      try {
        const res = await fetch("/api/profile/saved-events", {
          cache: "no-store",
        });
        if (!res.ok) return;
        const data = await res.json();
        const items = Array.isArray(data?.items) ? data.items : [];
        setIsSaved(
          items.some(
            (item: { eventId?: string }) => item.eventId === selectedEventId,
          ),
        );
      } catch (err) {
        console.error("Failed to load saved events:", err);
      }
    };
    void loadSaved();
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
      if ((event.priceField ?? 0) > 0) {
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

  return (
    <Card className="space-y-4 rounded-3xl bg-[#0f2235] border-none p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="heading-kicker">Tickets</p>
          <h3 className="text-lg font-semibold text-white">Register to play</h3>
        </div>
        <Badge className="bg-white/10 text-xs text-[#b9cde4]">
          {event.priceField ? `ETB ${event.priceField}` : "Free"}
        </Badge>
      </div>

      <div className="space-y-2 text-sm text-(--color-text-secondary)">
        {occurrenceOptions.length > 1 ? (
          <div className="flex items-center justify-between gap-4">
            <span>Date</span>
            <Select
              value={selectedEventId}
              onChange={(e) => setSelectedEventId(e.target.value)}
              className="min-w-[220px] bg-[#0a1927] text-right"
            >
              {occurrenceOptions.map((entry) => (
                <option key={entry.eventId} value={entry.eventId}>
                  {new Date(entry.eventDatetime).toLocaleString()}
                </option>
              ))}
            </Select>
          </div>
        ) : null}
        <div className="flex items-center justify-between">
          <span>Available</span>
          <span>
            {soldOutForSelection
              ? "Sold out"
              : remaining === Infinity
                ? "No limit"
                : `${remaining} seats`}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span>Your tickets</span>
          <span className="font-semibold text-white">{myTickets ?? 0}</span>
        </div>
        <div className="flex items-center justify-between">
          <span>Quantity to add</span>
          <Input
            type="number"
            min={1}
            max={maxQty}
            value={qty}
            onChange={(e) => {
              const val = Number(e.target.value);
              setQty(
                Number.isFinite(val) ? Math.max(1, Math.min(maxQty, val)) : 1,
              );
            }}
            className="w-24 bg-[#0a1927] text-right border-none"
          />
        </div>
      </div>

      <div className="grid gap-2">
        <Button
          type="button"
          disabled={loading || confirmingPayment || soldOutForSelection}
          onClick={handleRegister}
          variant="primary"
          className="h-11 w-full rounded-full px-5"
        >
          {soldOutForSelection
            ? "Sold out"
            : confirmingPayment
              ? "Confirming payment…"
              : loading
                ? "Processing…"
                : (event.priceField ?? 0) > 0
                  ? "Pay with Chapa"
                  : "Get tickets"}
        </Button>
      </div>

      {canShareTickets ? (
        <Card className="space-y-3 rounded-2xl border border-(--color-border) bg-[#0a1927] p-4">
          <div>
            <p className="text-sm font-semibold text-white">Share your extra tickets</p>
            <p className="text-xs text-(--color-text-secondary)">
              Friends can claim up to{" "}
              {shareUrl ? remainingClaims : myTickets - 1} ticket
              {(shareUrl ? remainingClaims : myTickets - 1) === 1 ? "" : "s"} from
              this link.
            </p>
          </div>
          {shareLoading ? (
            <p className="text-xs text-(--color-text-secondary)">
              Generating link...
            </p>
          ) : shareUrl ? (
            <div className="space-y-2">
              <Input
                value={shareUrl}
                readOnly
                className="bg-[#06111c] text-xs text-(--color-text-primary)"
              />
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  className="h-9 rounded-full px-4"
                  onClick={handleCopyShareLink}
                >
                  Copy link
                </Button>
                {shareCopied ? (
                  <span className="self-center text-xs text-[#22FF88]">Copied</span>
                ) : null}
                <Button
                  type="button"
                  variant="secondary"
                  className="h-9 rounded-full px-4"
                  onClick={() => void generateShareLink(selectedEventId)}
                >
                  Regenerate
                </Button>
              </div>
            </div>
          ) : (
            <Button
              type="button"
              variant="secondary"
              className="h-9 rounded-full px-4"
              onClick={() => void generateShareLink(selectedEventId)}
            >
              Generate share link
            </Button>
          )}
        </Card>
      ) : null}

      <Button
        type="button"
        onClick={handleToggleSave}
        variant="secondary"
        className="h-11 w-full rounded-full px-5 border-none"
      >
        {isSaved ? "Remove from saved" : "Save event"}
      </Button>

      <p className="text-xs text-(--color-text-muted)">
        All reservations are final.
      </p>
    </Card>
  );
}
