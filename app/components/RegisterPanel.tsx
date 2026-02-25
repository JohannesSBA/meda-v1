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
    if (decodedSelectedFromQuery && occurrenceOptions.some((o) => o.eventId === decodedSelectedFromQuery))
      return decodedSelectedFromQuery;
    return occurrenceOptions[0]?.eventId ?? event.eventId;
  });
  const [qty, setQty] = useState(1);
  const [loading, setLoading] = useState(false);
  const [confirmingPayment, setConfirmingPayment] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
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
    if (!userId) {
      setMyTickets(selectedOccurrence?.myTickets ?? 0);
      return;
    }
    fetchMyTickets(userId, selectedEventId);
  }, [selectedEventId, userId, fetchMyTickets, selectedOccurrence?.myTickets]);

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
    () =>
      searchParams.get("payment") ?? searchParams.get("amp;payment"),
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
          setMyTickets((prev) => prev + addedTickets);
        }
        if (!cancelled) {
          toast.success("Payment confirmed. Ticket added.");
          const returnEventId =
            decodedSelectedFromQuery && occurrenceOptions.some(
              (entry) => entry.eventId === decodedSelectedFromQuery,
            )
              ? decodedSelectedFromQuery
              : selectedEventId;
          const encodedOccurrence = encodeURIComponent(returnEventId);
          router.replace(`/events/${returnEventId}?occurrence=${encodedOccurrence}`);
          router.refresh();
        }
      } catch (err) {
        if (!cancelled) {
          toast.error(getErrorMessage(err) || "Unable to confirm payment");
        }
      } finally {
        if (!cancelled) {
          setConfirmingPayment(false);
        }
      }
    };

    confirmPayment();
    return () => {
      cancelled = true;
    };
  }, [
    decodedSelectedFromQuery,
    occurrenceOptions,
    router,
    paymentProvider,
    txRef,
    selectedEventId,
    userId,
  ]);

  const handleRegister = async () => {
    if (!userId) {
      const redirect =
        pathname + (searchParams.toString() ? `?${searchParams.toString()}` : "");
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
      setMyTickets((prev) => prev + qty);
      router.refresh();
    } catch (err) {
      toast.error(getErrorMessage(err) || "Failed to register");
    } finally {
      setLoading(false);
    }
  };

  const handleToggleSave = async () => {
    if (!userId) {
      toast.error("Please sign in to save events.");
      return;
    }
    try {
      const res = await fetch("/api/profile/saved-events", {
        method: isSaved ? "DELETE" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ eventId: selectedEventId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Save action failed");
      setIsSaved(!isSaved);
      toast.success(isSaved ? "Event removed from saved list" : "Event saved");
    } catch (err) {
      toast.error(getErrorMessage(err) || "Save action failed");
    }
  };

  return (
    <Card className="space-y-4 rounded-3xl bg-[#0f2235] p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="heading-kicker">Tickets</p>
          <h3 className="text-lg font-semibold text-white">Register to play</h3>
        </div>
        <Badge className="bg-white/10 text-xs text-[#b9cde4]">
          {event.priceField ? `ETB ${event.priceField}` : "Free"}
        </Badge>
      </div>

      <div className="space-y-2 text-sm text-[var(--color-text-secondary)]">
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
            className="w-24 bg-[#0a1927] text-right"
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

      <Button
        type="button"
        onClick={handleToggleSave}
        variant="secondary"
        className="h-11 w-full rounded-full px-5"
      >
        {isSaved ? "Remove from saved" : "Save event"}
      </Button>

      <p className="text-xs text-[var(--color-text-muted)]">
        All reservations are final.
      </p>
    </Card>
  );
}
