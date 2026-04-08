/**
 * TicketClaimPanel -- UI for claiming a shared ticket via token.
 *
 * Validates token and creates attendee record on claim.
 */

"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Card } from "@/app/components/ui/card";
import { Button } from "@/app/components/ui/button";
import { browserApi } from "@/lib/browserApi";
import { getErrorMessage } from "@/lib/errorMessage";

type TicketClaimPanelProps = {
  token: string;
};

type ShareDetails = {
  kind?: "event_attendee" | "booking_ticket" | "booking_pool";
  status: "Active" | "Expired" | "Revoked" | "Claimed";
  remainingClaims: number;
  event?: {
    eventId: string;
    eventName: string;
    eventDatetime: string;
    pictureUrl?: string | null;
    addressLabel?: string | null;
  };
  booking?: {
    ticketId: string;
    pitchName: string;
    startsAt: string;
    endsAt: string;
    addressLabel?: string | null;
  };
};

export default function TicketClaimPanel({ token }: TicketClaimPanelProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState(false);
  const [details, setDetails] = useState<ShareDetails | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await browserApi.get<ShareDetails>(
          `/api/tickets/share/${encodeURIComponent(token)}`,
          { cache: "no-store" },
        );
        if (!cancelled) setDetails(data);
      } catch (err) {
        if (!cancelled) setError(getErrorMessage(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [token]);

  const claimDisabled = useMemo(() => {
    if (!details) return true;
    if (details.status !== "Active") return true;
    return details.remainingClaims <= 0;
  }, [details]);

  const handleClaim = async () => {
    setClaiming(true);
    try {
      const data = await browserApi.post<{ eventId?: string; redirectPath?: string }>(
        `/api/tickets/share/${encodeURIComponent(token)}/claim`,
        undefined,
      );
      toast.success("Ticket claimed successfully");
      if (data.redirectPath) {
        router.push(data.redirectPath);
      } else if (data.eventId) {
        router.push(`/events/${data.eventId}`);
      } else {
        router.push("/tickets");
      }
      router.refresh();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setClaiming(false);
    }
  };

  if (loading) {
    return (
      <Card className="rounded-3xl bg-[#0f2235] p-6 text-sm text-[var(--color-text-secondary)]">
        Loading share link...
      </Card>
    );
  }

  if (error || !details) {
    return (
      <Card className="space-y-2 rounded-3xl bg-[#0f2235] p-6">
        <h1 className="text-xl font-semibold text-white">Invalid share link</h1>
        <p className="text-sm text-[var(--color-text-secondary)]">
          {error ?? "This ticket sharing link is not available."}
        </p>
      </Card>
    );
  }

  const title = details.event?.eventName ?? details.booking?.pitchName ?? "Ticket share";
  const subtitle = details.event
    ? `${new Date(details.event.eventDatetime).toLocaleString()} • ${details.event.addressLabel ?? "Location pending"}`
    : details.booking
      ? `${new Date(details.booking.startsAt).toLocaleString()} • ${details.booking.addressLabel ?? "Location pending"}`
      : "Open this link to claim the ticket.";

  return (
    <Card className="space-y-4 rounded-3xl bg-[#0f2235] p-6">
      <div>
        <p className="heading-kicker">Ticket share</p>
        <h1 className="text-2xl font-semibold text-white">{title}</h1>
        <p className="text-sm text-[var(--color-text-secondary)]">{subtitle}</p>
      </div>
      <div className="space-y-1 text-sm text-[var(--color-text-secondary)]">
        <p>Status: {details.status}</p>
        <p>
          {details.kind === "booking_ticket"
            ? details.status === "Active"
              ? "This claim link is ready to use."
              : "This claim link is no longer available."
            : details.kind === "booking_pool"
              ? details.status === "Active"
                ? `Open group spots left on this link: ${details.remainingClaims}`
                : "This pool claim link is no longer available."
            : `Tickets remaining on this link: ${details.remainingClaims}`}
        </p>
      </div>
      <Button
        type="button"
        onClick={handleClaim}
        disabled={claiming || claimDisabled}
        className="h-11 rounded-full px-5"
      >
        {claiming ? "Claiming..." : "Claim ticket"}
      </Button>
    </Card>
  );
}
