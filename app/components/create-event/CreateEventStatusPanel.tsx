"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Card } from "@/app/components/ui/card";
import { buttonVariants } from "@/app/components/ui/button";
import { cn } from "@/app/components/ui/cn";
import { BrowserApiError, browserApi } from "@/lib/browserApi";
import { getErrorMessage } from "@/lib/errorMessage";

type CreateEventStatusPanelProps = {
  txRef: string | null;
};

type StatusState =
  | { kind: "idle" | "loading" }
  | { kind: "success"; eventId: string; createdOccurrences: number }
  | { kind: "error"; message: string };

export function CreateEventStatusPanel({
  txRef,
}: CreateEventStatusPanelProps) {
  const [state, setState] = useState<StatusState>(() =>
    !txRef
      ? {
          kind: "error",
          message: "We could not find the event creation payment reference.",
        }
      : { kind: "loading" },
  );
  const requestedRef = useRef<string | null>(null);

  const confirmPayment = useCallback(async () => {
    if (!txRef) return;
    setState({ kind: "loading" });

    try {
      const data = await browserApi.post<{
        eventId?: string;
        createdOccurrences?: number;
      }>("/api/payments/chapa/confirm-event-creation", {
        txRef,
      });

      if (!data.eventId) {
        throw new Error("Confirmation did not return an event");
      }

      setState({
        kind: "success",
        eventId: data.eventId,
        createdOccurrences: Number(data.createdOccurrences) || 1,
      });
    } catch (error) {
      if (error instanceof BrowserApiError && error.status === 409) {
        setState({
          kind: "error",
          message:
            getErrorMessage(error) ||
            "The payment was verified, but the event could not be created automatically.",
        });
        return;
      }

      setState({
        kind: "error",
        message:
          getErrorMessage(error) ||
          "We could not confirm the event creation payment.",
      });
    }
  }, [txRef]);

  useEffect(() => {
    if (!txRef) return;
    if (requestedRef.current === txRef) return;
    requestedRef.current = txRef;
    void confirmPayment();
  }, [confirmPayment, txRef]);

  const eventHref =
    state.kind === "success" ? `/events/${state.eventId}` : "/create-events";
  const description =
    state.kind === "loading"
      ? "We are verifying your Chapa payment and finalizing the event."
      : state.kind === "success"
        ? state.createdOccurrences > 1
          ? `Your payment was confirmed and ${state.createdOccurrences} recurring occurrences were created.`
          : "Your payment was confirmed and the event is now live."
        : state.kind === "error"
          ? state.message
          : "";

  return (
    <Card className="mx-auto w-full max-w-2xl overflow-hidden p-8 sm:p-10">
      <div className="space-y-8 text-center">
        <div className="space-y-4">
          <StatusIcon state={state} />
          <div className="space-y-3">
            <p className="heading-kicker">Event creation</p>
            <h1 className="text-3xl font-semibold tracking-[-0.05em] text-[var(--color-text-primary)] sm:text-4xl">
              {state.kind === "loading"
                ? "Confirming payment"
                : state.kind === "success"
                  ? "Event created"
                  : "Creation payment failed"}
            </h1>
            <p className="mx-auto max-w-xl text-sm leading-7 text-[var(--color-text-secondary)] sm:text-base">
              {description}
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
          <Link
            href={eventHref}
            className={cn(
              buttonVariants(state.kind === "error" ? "secondary" : "primary", "lg"),
              "rounded-full",
            )}
          >
            {state.kind === "success" ? "Open event" : "Back to create event"}
          </Link>
          <Link
            href="/profile"
            className={cn(buttonVariants("secondary", "lg"), "rounded-full")}
          >
            Back to profile
          </Link>
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
        <svg
          className="h-8 w-8"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M5 13l4 4L19 7" />
        </svg>
      </div>
    );
  }

  return (
    <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border border-[rgba(251,113,133,0.26)] bg-[rgba(251,113,133,0.12)] text-[var(--color-danger)]">
      <svg
        className="h-8 w-8"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M6 18 18 6" />
        <path d="m6 6 12 12" />
      </svg>
    </div>
  );
}
