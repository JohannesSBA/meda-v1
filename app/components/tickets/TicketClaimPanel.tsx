"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Card } from "@/app/components/ui/card";
import { Button } from "@/app/components/ui/button";

type TicketClaimPanelProps = {
  token: string;
};

type ShareDetails = {
  status: "Active" | "Expired" | "Revoked";
  remainingClaims: number;
  event: {
    eventId: string;
    eventName: string;
    eventDatetime: string;
    pictureUrl?: string | null;
    addressLabel?: string | null;
  };
};

function getErrorMessage(value: unknown) {
  if (value instanceof Error) return value.message;
  if (typeof value === "string") return value;
  return "Something went wrong";
}

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
        const res = await fetch(`/api/tickets/share/${encodeURIComponent(token)}`, {
          cache: "no-store",
        });
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data?.error || "Share link not found");
        }
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
      const res = await fetch(
        `/api/tickets/share/${encodeURIComponent(token)}/claim`,
        { method: "POST" },
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Unable to claim ticket");
      toast.success("Ticket claimed successfully");
      router.push(`/events/${data.eventId}`);
      router.refresh();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setClaiming(false);
    }
  };

  if (loading) {
    return (
      <Card className="rounded-3xl bg-[#0f2235] p-6 text-sm text-(--color-text-secondary)">
        Loading share link...
      </Card>
    );
  }

  if (error || !details) {
    return (
      <Card className="space-y-2 rounded-3xl bg-[#0f2235] p-6">
        <h1 className="text-xl font-semibold text-white">Invalid share link</h1>
        <p className="text-sm text-(--color-text-secondary)">
          {error ?? "This ticket sharing link is not available."}
        </p>
      </Card>
    );
  }

  return (
    <Card className="space-y-4 rounded-3xl bg-[#0f2235] p-6">
      <div>
        <p className="heading-kicker">Ticket share</p>
        <h1 className="text-2xl font-semibold text-white">{details.event.eventName}</h1>
        <p className="text-sm text-(--color-text-secondary)">
          {new Date(details.event.eventDatetime).toLocaleString()} •{" "}
          {details.event.addressLabel ?? "Location pending"}
        </p>
      </div>
      <div className="space-y-1 text-sm text-(--color-text-secondary)">
        <p>Status: {details.status}</p>
        <p>Tickets remaining on this link: {details.remainingClaims}</p>
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
