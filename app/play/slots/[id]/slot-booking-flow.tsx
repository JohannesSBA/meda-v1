"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import StaticEventMapClient from "@/app/components/StaticEventMapClient";
import { Button } from "@/app/components/ui/button";
import { Card } from "@/app/components/ui/card";
import { Input } from "@/app/components/ui/input";
import { Textarea } from "@/app/components/ui/textarea";
import { Select } from "@/app/components/ui/select";
import { Badge } from "@/app/components/ui/badge";
import { browserApi } from "@/lib/browserApi";
import { getErrorMessage } from "@/lib/errorMessage";

type SlotPayload = {
  id: string;
  pitchName: string;
  addressLabel: string | null;
  latitude: number | null;
  longitude: number | null;
  startsAt: string;
  endsAt: string;
  capacity: number;
  remainingCapacity: number;
  currency: string;
  price: number;
  productType: "DAILY" | "MONTHLY";
  hostAverageRating: number;
  hostReviewCount: number;
  hostTrustBadge: string;
};

function stars(value: number) {
  const rounded = Math.max(0, Math.min(5, Math.round(value)));
  return "★★★★★".slice(0, rounded) + "☆☆☆☆☆".slice(0, 5 - rounded);
}

export function SlotBookingFlow({ slot }: { slot: SlotPayload }) {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [submitting, setSubmitting] = useState(false);
  const [quantity, setQuantity] = useState("1");
  const [paymentMethod, setPaymentMethod] = useState<"balance" | "chapa">("chapa");
  const [groupName, setGroupName] = useState("");
  const [memberEmails, setMemberEmails] = useState("");

  const normalizedEmails = useMemo(
    () =>
      [...new Set(memberEmails.split(/[\n,]/).map((entry) => entry.trim().toLowerCase()).filter(Boolean))],
    [memberEmails],
  );

  async function submitBooking() {
    setSubmitting(true);
    try {
      if (slot.productType === "DAILY") {
        const response = await browserApi.post<{ checkoutUrl?: string | null }>("/api/bookings/daily", {
          slotId: slot.id,
          quantity: Math.max(1, Number(quantity) || 1),
          paymentMethod,
        });
        if (response.checkoutUrl) {
          window.location.href = response.checkoutUrl;
          return;
        }
      } else {
        await browserApi.post("/api/bookings/monthly", {
          slotId: slot.id,
          partyName: groupName || undefined,
          memberEmails: normalizedEmails,
        });
      }

      toast.success("Booking created.");
      router.push("/tickets");
    } catch (error) {
      toast.error(getErrorMessage(error) || "Failed to create booking");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 px-4 py-5 sm:gap-6 sm:px-6">
      <div className="flex items-center justify-between gap-3">
        <Link href="/play?mode=slots" className="text-sm text-[var(--color-text-secondary)]">← Back to pitches</Link>
        <div className="text-xs text-[var(--color-text-muted)]">Step {step} of 3</div>
      </div>

      <Card className="overflow-hidden p-0">
        <div className="relative h-44 bg-[radial-gradient(circle_at_20%_20%,rgba(125,211,252,0.28),transparent_35%),linear-gradient(135deg,#102033,#0b1724)]">
          <div className="absolute inset-0 bg-gradient-to-t from-[rgba(6,17,27,0.82)] to-transparent" />
          <div className="absolute bottom-3 left-3 right-3">
            <p className="text-lg font-semibold text-white">{slot.pitchName}</p>
            <p className="text-sm text-[var(--color-text-secondary)]">{slot.addressLabel ?? "Location available in map"}</p>
          </div>
        </div>
      </Card>

      <Card className="p-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="accent">{slot.productType}</Badge>
          <Badge variant="default">{slot.hostTrustBadge.replaceAll("_", " ")}</Badge>
          <span className="text-sm text-[var(--color-text-secondary)]">
            {stars(slot.hostAverageRating)} {slot.hostAverageRating.toFixed(1)} · {slot.hostReviewCount > 0 ? `${slot.hostReviewCount} reviews` : "No reviews yet"}
          </span>
        </div>

        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <p className="text-sm text-[var(--color-text-secondary)]">Start: {new Date(slot.startsAt).toLocaleString()}</p>
          <p className="text-sm text-[var(--color-text-secondary)]">End: {new Date(slot.endsAt).toLocaleString()}</p>
        </div>

        {slot.latitude != null && slot.longitude != null ? (
          <div className="mt-4 h-52 overflow-hidden rounded-xl border border-[var(--color-border)]">
            <StaticEventMapClient latitude={slot.latitude} longitude={slot.longitude} />
          </div>
        ) : null}
      </Card>

      {step === 1 ? (
        <Card className="p-4">
          <p className="text-sm text-[var(--color-text-secondary)]">Confirm this pitch, time, and host details before continuing.</p>
          <Button className="mt-4" onClick={() => setStep(2)}>Continue</Button>
        </Card>
      ) : null}

      {step === 2 ? (
        <Card className="space-y-4 p-4">
          {slot.productType === "DAILY" ? (
            <>
              <label className="block">
                <span className="field-label">Spots</span>
                <Input type="number" min="1" max={String(Math.max(1, slot.remainingCapacity))} value={quantity} onChange={(event) => setQuantity(event.target.value)} />
              </label>
              <label className="block">
                <span className="field-label">Payment</span>
                <Select value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value as "balance" | "chapa")}>
                  <option value="chapa">Chapa</option>
                  <option value="balance">Meda balance</option>
                </Select>
              </label>
            </>
          ) : (
            <>
              <label className="block">
                <span className="field-label">Group name</span>
                <Input value={groupName} onChange={(event) => setGroupName(event.target.value)} placeholder="Friday squad" />
              </label>
              <label className="block">
                <span className="field-label">Member emails</span>
                <Textarea rows={5} value={memberEmails} onChange={(event) => setMemberEmails(event.target.value)} placeholder="a@example.com, b@example.com" />
              </label>
            </>
          )}
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setStep(1)}>Back</Button>
            <Button onClick={() => setStep(3)}>Review</Button>
          </div>
        </Card>
      ) : null}

      {step === 3 ? (
        <Card className="space-y-4 p-4">
          <p className="text-sm text-[var(--color-text-secondary)]">Review and submit your booking.</p>
          <p className="text-sm text-[var(--color-text-secondary)]">
            {slot.productType === "DAILY"
              ? `${Math.max(1, Number(quantity) || 1)} spot(s) at ${slot.currency} ${slot.price}`
              : `${normalizedEmails.length + 1} member(s) for full pitch reservation`}
          </p>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setStep(2)}>Back</Button>
            <Button disabled={submitting} onClick={() => void submitBooking()}>
              {submitting ? "Submitting..." : "Confirm booking"}
            </Button>
          </div>
        </Card>
      ) : null}
    </div>
  );
}
