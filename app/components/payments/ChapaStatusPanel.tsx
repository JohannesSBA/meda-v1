"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Card } from "@/app/components/ui/card";
import { buttonVariants } from "@/app/components/ui/button";
import { browserApi, BrowserApiError } from "@/lib/browserApi";
import { getErrorMessage } from "@/lib/errorMessage";
import { cn } from "@/app/components/ui/cn";

type ChapaStatusPanelProps = {
  eventId: string | null;
  txRef: string | null;
};

type StatusState =
  | { kind: "idle" | "loading" }
  | { kind: "success"; quantity: number }
  | { kind: "requires_refund"; message: string }
  | { kind: "error"; message: string };

export function ChapaStatusPanel({
  eventId,
  txRef,
}: ChapaStatusPanelProps) {
  const [state, setState] = useState<StatusState>(() =>
    !eventId || !txRef
      ? {
          kind: "error",
          message: "We could not find the payment reference for this checkout.",
        }
      : { kind: "loading" },
  );
  const requestedRef = useRef<string | null>(null);

  useEffect(() => {
    if (!eventId || !txRef) return;
    if (requestedRef.current === txRef) return;
    requestedRef.current = txRef;

    let cancelled = false;

    async function confirmPayment() {
      setState({ kind: "loading" });
      try {
        const data = await browserApi.post<{ quantity?: number }>(
          "/api/payments/chapa/confirm",
          { txRef },
        );
        if (cancelled) return;
        setState({
          kind: "success",
          quantity: Number(data?.quantity) || 0,
        });
      } catch (error) {
        if (cancelled) return;
        if (error instanceof BrowserApiError && error.status === 409) {
          setState({
            kind: "requires_refund",
            message:
              getErrorMessage(error) ||
              "Payment succeeded with the provider, but the reservation could not be fulfilled. The order was flagged for refund review.",
          });
          return;
        }
        setState({
          kind: "error",
          message: getErrorMessage(error) || "We could not confirm this payment.",
        });
      }
    }

    void confirmPayment();

    return () => {
      cancelled = true;
    };
  }, [eventId, txRef]);

  const eventHref = eventId ? `/events/${eventId}` : "/events";

  return (
    <Card className="mx-auto w-full max-w-xl rounded-3xl border border-white/10 bg-[#0d1d2e]/90 p-8 text-center shadow-2xl shadow-black/40">
      {state.kind === "loading" ? (
        <>
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border border-[var(--color-brand)]/30 bg-[var(--color-brand)]/10">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--color-brand)] border-t-transparent" />
          </div>
          <h1 className="mt-5 text-2xl font-semibold text-white">
            Confirming payment
          </h1>
          <p className="mt-2 text-sm leading-6 text-[var(--color-text-secondary)]">
            We are verifying your Chapa payment and matching it to your ticket
            reservation.
          </p>
        </>
      ) : null}

      {state.kind === "success" ? (
        <>
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#22FF88]/15 text-[#22FF88]">
            <svg className="h-8 w-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="mt-5 text-2xl font-semibold text-white">
            Payment confirmed
          </h1>
          <p className="mt-2 text-sm leading-6 text-[var(--color-text-secondary)]">
            {state.quantity > 0
              ? `Your payment was confirmed and ${state.quantity} ticket${state.quantity === 1 ? "" : "s"} were issued.`
              : "Your payment was already confirmed earlier."}
          </p>
        </>
      ) : null}

      {state.kind === "requires_refund" ? (
        <>
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-amber-400/15 text-amber-300">
            <svg className="h-8 w-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 9v4" />
              <path d="M12 17h.01" />
              <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
            </svg>
          </div>
          <h1 className="mt-5 text-2xl font-semibold text-white">
            Payment flagged for review
          </h1>
          <p className="mt-2 text-sm leading-6 text-[var(--color-text-secondary)]">
            {state.message}
          </p>
        </>
      ) : null}

      {state.kind === "error" ? (
        <>
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-500/15 text-red-300">
            <svg className="h-8 w-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 18 18 6" />
              <path d="m6 6 12 12" />
            </svg>
          </div>
          <h1 className="mt-5 text-2xl font-semibold text-white">
            Payment confirmation failed
          </h1>
          <p className="mt-2 text-sm leading-6 text-[var(--color-text-secondary)]">
            {state.message}
          </p>
        </>
      ) : null}

      <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
        <Link
          href={eventHref}
          className={cn(buttonVariants("primary"), "w-full sm:w-auto")}
        >
          Back to event
        </Link>
        <Link
          href="/events"
          className={cn(buttonVariants("secondary"), "w-full sm:w-auto")}
        >
          Browse events
        </Link>
      </div>
    </Card>
  );
}
