"use client";

import { useEffect, useState } from "react";
import axios from "axios";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import type { EventResponse } from "@/app/types/eventTypes";
import { authClient } from "@/lib/auth/client";

type Props = {
  event: EventResponse;
  isSoldOut: boolean;
};

export default function RegisterPanel({ event, isSoldOut }: Props) {
  const [qty, setQty] = useState(1);
  const [loading, setLoading] = useState(false);
  const [myTickets, setMyTickets] = useState<number>(event.myTickets ?? 0);
  const [userId, setUserId] = useState<string | null>(null);
  const router = useRouter();

  const remaining = event.capacity != null ? Math.max(event.capacity - (event.attendeeCount ?? 0), 0) : Infinity;
  const maxQty = Math.min(20, remaining || 20);

  const fetchMyTickets = async (uid: string) => {
    try {
      const res = await fetch(`/api/events/${event.eventId}?userId=${uid}`, { cache: "no-store" });
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
        fetchMyTickets(id);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleRegister = async () => {
    if (!userId) {
      toast.error("Please sign in to register.");
      return;
    }
    if (event.eventEndtime && new Date(event.eventEndtime) <= new Date()) {
      toast.error("This event has ended");
      return;
    }
    if (event.capacity != null && qty > remaining) {
      toast.error("Not enough seats left");
      return;
    }
    setLoading(true);
    try {
      await axios.post(`/api/events/${event.eventId}`, {
        quantity: qty,
        userId,
      });
      toast.success("Registered!");
      setMyTickets((prev) => prev + qty);
      router.refresh();
    } catch (err) {
      const maybeAxiosError = err as { response?: { data?: { error?: string } } };
      toast.error(maybeAxiosError?.response?.data?.error ?? "Failed to register");
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async () => {
    if (!userId) {
      toast.error("Please sign in first.");
      return;
    }
    setLoading(true);
    try {
      await axios.delete(`/api/events/${event.eventId}`, { data: { quantity: myTickets || 1, userId } });
      toast.success("Reservation cancelled");
      setMyTickets(0);
      router.refresh();
    } catch (err) {
      const maybeAxiosError = err as { response?: { data?: { error?: string } } };
      toast.error(maybeAxiosError?.response?.data?.error ?? "Unable to cancel");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4 rounded-3xl border border-white/8 bg-[#0f2235] p-6 shadow-xl shadow-black/30">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-[#7ccfff]">Tickets</p>
          <h3 className="text-lg font-semibold text-white">Register to play</h3>
        </div>
        <span className="rounded-full bg-white/10 px-3 py-1 text-xs text-[#b9cde4]">
          {event.priceField ? `ETB ${event.priceField}` : "Free"}
        </span>
      </div>

      <div className="space-y-2 text-sm text-[#c5d7ec]">
        <div className="flex items-center justify-between">
          <span>Available</span>
          <span>{remaining === Infinity ? "No limit" : `${remaining} seats`}</span>
        </div>
        <div className="flex items-center justify-between">
          <span>Your tickets</span>
          <span className="font-semibold text-white">{myTickets ?? 0}</span>
        </div>
        <div className="flex items-center justify-between">
          <span>Quantity to add</span>
          <input
            type="number"
            min={1}
            max={maxQty}
            value={qty}
            onChange={(e) => setQty(Math.max(1, Math.min(maxQty, Number(e.target.value))))}
            className="w-24 rounded-lg border border-white/10 bg-[#0a1927] px-3 py-2 text-right text-white focus:outline-none focus:ring-2 focus:ring-[#22FF88]"
          />
        </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        <button
          type="button"
          disabled={loading || isSoldOut}
          onClick={handleRegister}
          className="w-full rounded-full bg-linear-to-r from-[#00E5FF] to-[#22FF88] px-5 py-3 text-sm font-semibold text-[#001021] shadow-lg shadow-[#00e5ff33] transition hover:from-[#22FF88] hover:to-[#00E5FF] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isSoldOut ? "Sold out" : loading ? "Registering…" : "Get tickets"}
        </button>
        <button
          type="button"
          disabled={loading || myTickets === 0}
          onClick={handleCancel}
          className="w-full rounded-full border border-white/15 px-5 py-3 text-sm font-semibold text-white transition hover:border-[#ffb4b4] hover:text-[#ffb4b4] disabled:cursor-not-allowed disabled:opacity-40"
        >
          Cancel reservation
        </button>
      </div>

      <p className="text-xs text-[#9fc4e4]">Cancellations are disabled within 24 hours of the event start.</p>
    </div>
  );
}
