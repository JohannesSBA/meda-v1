"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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

export function ChapaStatusPanel({ eventId, txRef }: ChapaStatusPanelProps) {
  const [state, setState] = useState<StatusState>(() =>
    !eventId || !txRef
      ? {
          kind: "error",
          message: "We could not find the payment reference for this checkout.",
        }
      : { kind: "loading" },
  );
  const requestedRef = useRef<string | null>(null);

  const confirmPayment = useCallback(async () => {
    if (!eventId || !txRef) return;
    setState({ kind: "loading" });
    try {
      const data = await browserApi.post<{ quantity?: number }>("/api/payments/chapa/confirm", { txRef });
      setState({ kind: "success", quantity: Number(data?.quantity) || 0 });
    } catch (error) {
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
  }, [eventId, txRef]);

  useEffect(() => {
    if (!eventId || !txRef) return;
    if (requestedRef.current === txRef) return;
    requestedRef.current = txRef;
    void confirmPayment();
  }, [eventId, txRef, confirmPayment]);

  const eventHref = eventId ? `/events/${eventId}` : "/events";

  return (
    <Card className="mx-auto w-full max-w-2xl overflow-hidden p-8 sm:p-10">
      <div className="space-y-8 text-center">
        <div className="space-y-4">
          <StatusIcon state={state} />
          <div className="space-y-3">
            <p className="heading-kicker">Payment status</p>
            <h1 className="text-3xl font-semibold tracking-[-0.05em] text-[var(--color-text-primary)] sm:text-4xl">
              {state.kind === "loading"
                ? "Confirming payment"
                : state.kind === "success"
                  ? "Payment confirmed"
                  : state.kind === "requires_refund"
                    ? "Payment flagged for review"
                    : "Payment confirmation failed"}
            </h1>
            <p className="mx-auto max-w-xl text-sm leading-7 text-[var(--color-text-secondary)] sm:text-base">
              {state.kind === "loading"
                ? "We are verifying your Chapa payment and matching it to your reservation."
                : state.kind === "success"
                  ? state.quantity > 0
                    ? `Your payment was confirmed and ${state.quantity} ticket${state.quantity === 1 ? " was" : "s were"} issued.`
                    : "Your payment was already confirmed earlier."
                  : state.kind === "requires_refund"
                    ? state.message
                    : state.kind === "error"
                      ? state.message
                      : ""}
            </p>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          {state.kind === "error" ? (
            <button
              type="button"
              onClick={() => void confirmPayment()}
              className={cn(buttonVariants("primary", "lg"), "rounded-full")}
            >
              Retry confirmation
            </button>
          ) : null}
          <Link href={eventHref} className={cn(buttonVariants(state.kind === "error" ? "secondary" : "primary", "lg"), "rounded-full")}>
            Back to event
          </Link>
          <Link href="/events" className={cn(buttonVariants("secondary", "lg"), "rounded-full")}>Browse events</Link>
        </div>
      </div>
    </Card>
  );
}

function StatusIcon({ state }: { state: StatusState }) {
  if (state.kind === "loading") {
    return (
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border border-[rgba(125,211,252,0.26)] bg-[rgba(125,211,252,0.12)] text-[var(--color-brand)] [animation:pulseGlow_1.8s_ease-in-out_infinite]">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-current border-t-transparent" />
      </div>
    );
  }

  if (state.kind === "success") {
    return (
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border border-[rgba(52,211,153,0.26)] bg-[rgba(52,211,153,0.12)] text-[var(--color-brand-alt)]">
        <svg className="h-8 w-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M5 13l4 4L19 7" />
        </svg>
      </div>
    );
  }

  if (state.kind === "requires_refund") {
    return (
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border border-[rgba(251,191,36,0.26)] bg-[rgba(251,191,36,0.12)] text-[var(--color-warning)]">
        <svg className="h-8 w-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 9v4" />
          <path d="M12 17h.01" />
          <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
        </svg>
      </div>
    );
  }

  return (
    <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border border-[rgba(251,113,133,0.26)] bg-[rgba(251,113,133,0.12)] text-[var(--color-danger)]">
      <svg className="h-8 w-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M6 18 18 6" />
        <path d="m6 6 12 12" />
      </svg>
    </div>
  );
}
