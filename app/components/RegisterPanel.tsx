"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import { toast } from "sonner";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { EventOccurrence, EventResponse } from "@/app/types/eventTypes";
import { authClient } from "@/lib/auth/client";
import { Card } from "@/app/components/ui/card";
import { Badge } from "@/app/components/ui/badge";
import TicketQRPanel from "@/app/components/tickets/TicketQRPanel";
import { Select } from "@/app/components/ui/select";
import { Input } from "@/app/components/ui/input";
import { Button } from "@/app/components/ui/button";
import { MAX_TICKETS_PER_USER_PER_EVENT, REFUND_CUTOFF_HOURS } from "@/lib/constants";
import { getErrorMessage } from "@/lib/errorMessage";

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
  const [onWaitlist, setOnWaitlist] = useState(false);
  const [waitlistLoading, setWaitlistLoading] = useState(false);
  const [myTickets, setMyTickets] = useState<number>(
    occurrenceOptions[0]?.myTickets ?? event.myTickets ?? 0,
  );
  const [userId, setUserId] = useState<string | null>(null);
  const [refundLoading, setRefundLoading] = useState(false);
  const [refundQty, setRefundQty] = useState(1);
  const [showRefundConfirm, setShowRefundConfirm] = useState(false);
  const [userBalance, setUserBalance] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState<"chapa" | "balance">("chapa");

  const selectedOccurrence =
    occurrenceOptions.find((entry) => entry.eventId === selectedEventId) ??
    occurrenceOptions[0];
  const selectedEndtime =
    selectedOccurrence?.eventEndtime ?? event.eventEndtime;
  const selectedCapacity = selectedOccurrence?.capacity ?? event.capacity;
  const remaining =
    selectedCapacity != null ? Math.max(selectedCapacity, 0) : Infinity;
  const maxQty = Math.min(MAX_TICKETS_PER_USER_PER_EVENT, remaining || MAX_TICKETS_PER_USER_PER_EVENT);
  const soldOutForSelection =
    selectedCapacity != null ? remaining <= 0 : isSoldOut;
  const canShareTickets = myTickets > 1;
  const selectedDatetime =
    selectedOccurrence?.eventDatetime ?? event.eventDatetime;
  const hoursUntilEvent =
    (new Date(selectedDatetime).getTime() - Date.now()) / (1000 * 60 * 60);
  const refundEligible = myTickets > 0 && hoursUntilEvent >= REFUND_CUTOFF_HOURS;
  const isPaid = (event.priceField ?? 0) > 0;

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
    let cancelled = false;
    authClient.getSession().then((session) => {
      if (!cancelled) {
        setUserId(session.data?.user?.id ?? null);
      }
    });
    return () => { cancelled = true; };
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
        if (!res.ok)
          throw new Error(data?.error || "Unable to create share link");
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
    if (!userId || !soldOutForSelection || myTickets > 0) {
      setOnWaitlist(false);
      return;
    }
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch(`/api/events/${selectedEventId}/waitlist`, {
          cache: "no-store",
        });
        if (cancelled || !res.ok) return;
        const data = await res.json();
        if (!cancelled) setOnWaitlist(data.onWaitlist ?? false);
      } catch {
        if (!cancelled) setOnWaitlist(false);
      }
    };
    void load();
    return () => { cancelled = true; };
  }, [selectedEventId, userId, soldOutForSelection, myTickets]);

  useEffect(() => {
    if (!userId || !isPaid) return;
    let cancelled = false;
    const loadBalance = async () => {
      try {
        const res = await fetch("/api/profile/balance", { cache: "no-store" });
        if (cancelled || !res.ok) return;
        const data = await res.json();
        if (cancelled) return;
        const bal = Number(data.balanceEtb) || 0;
        setUserBalance(bal);
        if (bal <= 0) setPaymentMethod("chapa");
      } catch {
        // silently ignore
      }
    };
    void loadBalance();
    return () => { cancelled = true; };
  }, [userId, isPaid]);

  useEffect(() => {
    if (!userId) {
      setIsSaved(false);
      return;
    }
    let cancelled = false;
    const loadSaved = async () => {
      try {
        const res = await fetch("/api/profile/saved-events", {
          cache: "no-store",
        });
        if (cancelled || !res.ok) return;
        const data = await res.json();
        if (cancelled) return;
        const items = Array.isArray(data?.items) ? data.items : [];
        setIsSaved(
          items.some(
            (item: { eventId?: string }) => item.eventId === selectedEventId,
          ),
        );
      } catch {
        // silently ignore
      }
    };
    void loadSaved();
    return () => { cancelled = true; };
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
      if (isPaid) {
        if (paymentMethod === "balance") {
          const response = await axios.post("/api/payments/balance", {
            eventId: selectedEventId,
            quantity: qty,
          });
          const addedTickets = Number(response.data?.quantity) || qty;
          toast.success("Payment confirmed from your Meda balance.");
          const nextTicketCount = myTickets + addedTickets;
          setMyTickets(nextTicketCount);
          setUserBalance(Number(response.data?.newBalance) ?? 0);
          if (nextTicketCount > 1) {
            void generateShareLink(selectedEventId);
          }
          router.refresh();
          setLoading(false);
          registerSubmittingRef.current = false;
          return;
        }

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

  const handleRefund = async () => {
    if (!userId || refundLoading) return;
    setRefundLoading(true);
    try {
      const res = await fetch(`/api/events/${selectedEventId}/refund`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ticketCount: refundQty }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to process refund");
      const refunded = Number(data.ticketCount) || refundQty;
      const amount = Number(data.amountEtb) || 0;
      setMyTickets((prev) => Math.max(0, prev - refunded));
      setShowRefundConfirm(false);
      setRefundQty(1);
      toast.success(
        amount > 0
          ? `Refund processed. ETB ${amount} credited to your balance.`
          : `${refunded} ticket${refunded === 1 ? "" : "s"} cancelled.`,
      );
      router.refresh();
      setTimeout(() => router.refresh(), 5000);
    } catch (err) {
      toast.error(getErrorMessage(err) || "Failed to process refund");
    } finally {
      setRefundLoading(false);
    }
  };

  return (
    <Card id="register-panel" className="space-y-4 rounded-2xl border-none bg-[#0f2235] p-5 sm:rounded-3xl sm:p-6">
      {/* Payment confirming overlay */}
      {confirmingPayment ? (
        <div className="flex flex-col items-center gap-3 py-6 text-center">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-[var(--color-brand)] border-t-transparent" />
          <p className="text-base font-semibold text-white">Confirming your payment...</p>
          <p className="text-sm text-[var(--color-text-muted)]">Please wait while we verify with Chapa.</p>
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between">
            <div>
              <p className="heading-kicker">Tickets</p>
              <h3 className="text-lg font-semibold text-white">Register to play</h3>
            </div>
            <Badge className="bg-white/10 text-sm text-[var(--color-text-secondary)]">
              {event.priceField ? `ETB ${event.priceField}` : "Free"}
            </Badge>
          </div>

          <div className="space-y-3 text-sm text-[var(--color-text-secondary)]">
            {occurrenceOptions.length > 1 ? (
              <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                <span className="font-medium">Date</span>
                <Select
                  value={selectedEventId}
                  onChange={(e) => setSelectedEventId(e.target.value)}
                  className="bg-[#0a1927] sm:min-w-[220px] sm:text-right"
                >
                  {occurrenceOptions.map((entry) => (
                    <option key={entry.eventId} value={entry.eventId}>
                      {new Date(entry.eventDatetime).toLocaleString()}
                    </option>
                  ))}
                </Select>
              </div>
            ) : null}
            <div className="flex items-center justify-between py-1">
              <span>Available</span>
              <span className="font-medium text-white">
                {soldOutForSelection
                  ? "Sold out"
                  : remaining === Infinity
                    ? "No limit"
                    : `${remaining} seats`}
              </span>
            </div>
            <div className="flex items-center justify-between py-1">
              <span>Your tickets</span>
              <span className="font-semibold text-white">{myTickets ?? 0}</span>
            </div>
            <div className="flex items-center justify-between py-1">
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
                className="w-24 border-none bg-[#0a1927] text-right"
              />
            </div>
          </div>

          {isPaid && userBalance > 0 ? (
            <div className="space-y-2">
              <p className="text-xs font-medium text-[var(--color-text-secondary)]">Pay with</p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setPaymentMethod("balance")}
                  className={`flex-1 rounded-xl border px-3 py-2.5 text-sm font-medium transition ${
                    paymentMethod === "balance"
                      ? "border-[var(--color-brand)] bg-[var(--color-brand)]/10 text-[var(--color-brand)]"
                      : "border-white/10 text-[var(--color-text-secondary)]"
                  }`}
                >
                  <span className="block">Meda Balance</span>
                  <span className="block text-xs opacity-75">ETB {userBalance.toFixed(2)}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentMethod("chapa")}
                  className={`flex-1 rounded-xl border px-3 py-2.5 text-sm font-medium transition ${
                    paymentMethod === "chapa"
                      ? "border-[var(--color-brand)] bg-[var(--color-brand)]/10 text-[var(--color-brand)]"
                      : "border-white/10 text-[var(--color-text-secondary)]"
                  }`}
                >
                  <span className="block">Chapa</span>
                  <span className="block text-xs opacity-75">Online payment</span>
                </button>
              </div>
              {paymentMethod === "balance" && userBalance < (event.priceField ?? 0) * qty ? (
                <p className="text-xs text-red-400">
                  Insufficient balance. You need ETB {((event.priceField ?? 0) * qty).toFixed(2)} but have ETB {userBalance.toFixed(2)}.
                </p>
              ) : null}
            </div>
          ) : null}

          <div className="grid gap-2">
            <Button
              type="button"
              disabled={
                loading ||
                confirmingPayment ||
                soldOutForSelection ||
                (isPaid && paymentMethod === "balance" && userBalance < (event.priceField ?? 0) * qty)
              }
              onClick={handleRegister}
              variant="primary"
              className="h-[52px] w-full rounded-2xl text-base font-bold"
            >
              {soldOutForSelection
                ? "Sold out"
                : loading
                  ? "Processing…"
                  : isPaid
                    ? paymentMethod === "balance"
                      ? "Pay with balance"
                      : "Pay with Chapa"
                    : "Get tickets"}
            </Button>
            {soldOutForSelection && myTickets === 0 && userId ? (
              <Button
                type="button"
                variant="secondary"
                className="h-11 w-full rounded-2xl"
                disabled={waitlistLoading}
                onClick={async () => {
                  setWaitlistLoading(true);
                  try {
                    const method = onWaitlist ? "DELETE" : "POST";
                    const res = await fetch(
                      `/api/events/${selectedEventId}/waitlist`,
                      { method },
                    );
                    const data = await res.json();
                    if (!res.ok) throw new Error(data?.error || "Failed");
                    setOnWaitlist(!onWaitlist);
                    toast.success(
                      onWaitlist ? "Left waitlist" : "You're on the waitlist!",
                    );
                  } catch (err) {
                    toast.error(getErrorMessage(err));
                  } finally {
                    setWaitlistLoading(false);
                  }
                }}
              >
                {waitlistLoading
                  ? "…"
                  : onWaitlist
                    ? "Leave waitlist"
                    : "Join waitlist"}
              </Button>
            ) : null}
          </div>

          {myTickets > 0 ? (
            <TicketQRPanel
              eventId={event.eventId}
              eventName={event.eventName}
              ticketCount={myTickets}
            />
          ) : null}

          {canShareTickets ? (
            <Card className="space-y-3 rounded-2xl border border-[var(--color-border)] bg-[#0a1927] p-4">
              <div>
                <p className="text-sm font-semibold text-white">
                  Share your extra tickets
                </p>
                <p className="text-sm text-[var(--color-text-muted)]">
                  Friends can claim up to{" "}
                  {shareUrl ? remainingClaims : myTickets - 1} ticket
                  {(shareUrl ? remainingClaims : myTickets - 1) === 1
                    ? ""
                    : "s"}{" "}
                  from this link.
                </p>
              </div>
              {shareLoading ? (
                <p className="text-sm text-[var(--color-text-secondary)]">
                  Generating link...
                </p>
              ) : shareUrl ? (
                <div className="space-y-2">
                  <Input
                    value={shareUrl}
                    readOnly
                    className="bg-[#06111c] text-sm text-[var(--color-text-primary)]"
                  />
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="secondary"
                      className="h-11 rounded-full px-4"
                      onClick={handleCopyShareLink}
                    >
                      {shareCopied ? "Copied!" : "Copy link"}
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      className="h-11 rounded-full px-4"
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
                  className="h-11 w-full rounded-full"
                  onClick={() => void generateShareLink(selectedEventId)}
                >
                  Generate share link
                </Button>
              )}
            </Card>
          ) : null}

          {refundEligible && !showRefundConfirm ? (
            <Button
              type="button"
              variant="secondary"
              className="h-11 w-full rounded-2xl border-none text-red-400"
              onClick={() => {
                setRefundQty(1);
                setShowRefundConfirm(true);
              }}
            >
              {isPaid ? "Cancel & refund tickets" : "Cancel tickets"}
            </Button>
          ) : null}

          {showRefundConfirm ? (
            <Card className="space-y-3 rounded-2xl border border-red-500/30 bg-[#1a0a0a] p-4">
              <p className="text-sm font-semibold text-white">
                {isPaid ? "Cancel & refund" : "Cancel tickets"}
              </p>
              <div className="flex items-center justify-between text-sm text-[var(--color-text-secondary)]">
                <span>Tickets to cancel</span>
                <Input
                  type="number"
                  min={1}
                  max={myTickets}
                  value={refundQty}
                  onChange={(e) => {
                    const val = Number(e.target.value);
                    setRefundQty(
                      Number.isFinite(val) ? Math.max(1, Math.min(myTickets, val)) : 1,
                    );
                  }}
                  className="w-24 border-none bg-[#0a1927] text-right"
                />
              </div>
              {isPaid ? (
                <p className="text-sm text-[var(--color-text-muted)]">
                  ETB {(event.priceField ?? 0) * refundQty} will be credited to your Meda balance.
                </p>
              ) : null}
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="danger"
                  className="h-11 flex-1 rounded-xl"
                  disabled={refundLoading}
                  onClick={() => void handleRefund()}
                >
                  {refundLoading ? "Processing…" : "Confirm"}
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  className="h-11 flex-1 rounded-xl"
                  onClick={() => setShowRefundConfirm(false)}
                >
                  Keep tickets
                </Button>
              </div>
            </Card>
          ) : null}

          <Button
            type="button"
            onClick={handleToggleSave}
            variant="secondary"
            className="h-11 w-full rounded-2xl border-none"
          >
            {isSaved ? "Remove from saved" : "Save event"}
          </Button>

          <div className="rounded-xl border border-white/10 bg-[#0a1927] p-3 text-xs text-[var(--color-text-muted)]">
            {isPaid ? (
              <p>
                Refunds are available up to 24 hours before the event. Refunded
                amounts are credited to your Meda balance. No refunds within 24
                hours of the event start.
              </p>
            ) : (
              <p>
                You may cancel your registration up to 24 hours before the
                event. No cancellations within 24 hours of the event start.
              </p>
            )}
          </div>
        </>
      )}
    </Card>
  );
}
