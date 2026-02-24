"use client";

import { useEffect, useState } from "react";
import axios from "axios";
import { toast } from "sonner";
import { useRouter, useSearchParams } from "next/navigation";
import type { EventOccurrence, EventResponse } from "@/app/types/eventTypes";
import { authClient } from "@/lib/auth/client";
import { Card } from "@/app/components/ui/card";
import { Badge } from "@/app/components/ui/badge";
import { Select } from "@/app/components/ui/select";
import { Input } from "@/app/components/ui/input";
import { Button } from "@/app/components/ui/button";

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
  const occurrenceOptions =
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
        ];
  const [selectedEventId, setSelectedEventId] = useState(
    occurrenceOptions[0]?.eventId ?? event.eventId,
  );
  const [qty, setQty] = useState(1);
  const [loading, setLoading] = useState(false);
  const [confirmingPayment, setConfirmingPayment] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [myTickets, setMyTickets] = useState<number>(
    occurrenceOptions[0]?.myTickets ?? event.myTickets ?? 0,
  );
  const [userId, setUserId] = useState<string | null>(null);
  const router = useRouter();
  const searchParams = useSearchParams();

  const selectedOccurrence =
    occurrenceOptions.find((entry) => entry.eventId === selectedEventId) ??
    occurrenceOptions[0];
  const selectedEndtime =
    selectedOccurrence?.eventEndtime ?? event.eventEndtime;
  const selectedCapacity = selectedOccurrence?.capacity ?? event.capacity;
  const selectedAttendeeCount =
    selectedOccurrence?.attendeeCount ?? event.attendeeCount ?? 0;
  const remaining =
    selectedCapacity != null
      ? Math.max(selectedCapacity - selectedAttendeeCount, 0)
      : Infinity;
  const maxQty = Math.min(20, remaining || 20);
  const soldOutForSelection =
    selectedCapacity != null ? remaining <= 0 : isSoldOut;

  const fetchMyTickets = async (uid: string, targetEventId: string) => {
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
  };

  useEffect(() => {
    authClient.getSession().then((session) => {
      const id = session.data?.user?.id ?? null;
      setUserId(id);
      if (id) {
        fetchMyTickets(id, selectedEventId);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!userId) {
      setMyTickets(selectedOccurrence?.myTickets ?? 0);
      return;
    }
    fetchMyTickets(userId, selectedEventId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedEventId, userId]);

  useEffect(() => {
    if (!userId) {
      setIsSaved(false);
      return;
    }
    const loadSaved = async () => {
      try {
        const res = await fetch("/api/profile/saved-events", { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json();
        const items = Array.isArray(data?.items) ? data.items : [];
        setIsSaved(items.some((item: { eventId?: string }) => item.eventId === selectedEventId));
      } catch {
        // silent
      }
    };
    void loadSaved();
  }, [selectedEventId, userId]);

  useEffect(() => {
    const paymentProvider = searchParams.get("payment");
    const txRef = searchParams.get("tx_ref");
    if (!userId || paymentProvider !== "chapa" || !txRef) return;

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
          router.replace(`/events/${event.eventId}`);
          router.refresh();
        }
      } catch (err) {
        const maybeAxiosError = err as {
          response?: { data?: { error?: string } };
        };
        if (!cancelled) {
          toast.error(
            maybeAxiosError?.response?.data?.error ??
              "Unable to confirm payment",
          );
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
  }, [event.eventId, router, searchParams, userId]);

  const handleRegister = async () => {
    if (!userId) {
      toast.error("Please sign in to register.");
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
      const maybeAxiosError = err as {
        response?: { data?: { error?: string } };
      };
      toast.error(
        maybeAxiosError?.response?.data?.error ?? "Failed to register",
      );
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
      const maybeErr = err as Error;
      toast.error(maybeErr.message || "Save action failed");
    }
  };

  return (
    <Card className="space-y-4 rounded-3xl bg-[#0f2235] p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="heading-kicker">
            Tickets
          </p>
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
            {remaining === Infinity ? "No limit" : `${remaining} seats`}
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
            onChange={(e) =>
              setQty(Math.max(1, Math.min(maxQty, Number(e.target.value))))
            }
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
