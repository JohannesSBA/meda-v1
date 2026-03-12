"use client";

import { useState } from "react";
import { browserApi } from "@/lib/browserApi";
import { Button } from "@/app/components/ui/button";
import { Card } from "@/app/components/ui/card";
import { getErrorMessage } from "@/lib/errorMessage";

type VerificationState =
  | { kind: "idle" }
  | { kind: "loading" }
  | {
      kind: "success";
      message: string;
      attendeeName?: string | null;
      eventName?: string;
    }
  | { kind: "error"; message: string };

export function ScanHarness() {
  const [token, setToken] = useState("scan-token-demo");
  const [eventId, setEventId] = useState(
    "550e8400-e29b-41d4-a716-446655440000",
  );
  const [state, setState] = useState<VerificationState>({ kind: "idle" });

  async function handleVerify() {
    setState({ kind: "loading" });
    try {
      const data = await browserApi.post<{
        valid: boolean;
        alreadyScanned?: boolean;
        attendeeName?: string | null;
        eventName?: string;
        error?: string;
      }>(`/api/tickets/verify/${encodeURIComponent(token)}`, { eventId });

      if (!data.valid) {
        setState({
          kind: "error",
          message: data.error ?? "Verification failed.",
        });
        return;
      }

      setState({
        kind: "success",
        message: data.alreadyScanned ? "Already scanned" : "Ticket verified",
        attendeeName: data.attendeeName,
        eventName: data.eventName,
      });
    } catch (error) {
      setState({
        kind: "error",
        message: getErrorMessage(error) || "Verification failed.",
      });
    }
  }

  return (
    <Card className="mx-auto w-full max-w-2xl space-y-5 rounded-3xl border border-white/10 bg-[#0d1d2e]/90 p-6">
      <div className="space-y-2">
        <p className="heading-kicker">E2E scan harness</p>
        <h1 className="text-2xl font-semibold text-white">Verify scan flow</h1>
        <p className="text-sm text-[var(--color-text-secondary)]">
          This route is only enabled when `E2E_AUTH_BYPASS=1`.
        </p>
      </div>

      <label className="block space-y-2">
        <span className="text-sm font-medium text-white">Event ID</span>
        <input
          value={eventId}
          onChange={(event) => setEventId(event.target.value)}
          className="h-11 w-full rounded-2xl border border-white/10 bg-[#081421] px-4 text-sm text-white outline-none transition focus:border-[var(--color-brand)]"
        />
      </label>

      <label className="block space-y-2">
        <span className="text-sm font-medium text-white">Ticket token</span>
        <input
          value={token}
          onChange={(event) => setToken(event.target.value)}
          className="h-11 w-full rounded-2xl border border-white/10 bg-[#081421] px-4 text-sm text-white outline-none transition focus:border-[var(--color-brand)]"
        />
      </label>

      <Button
        type="button"
        onClick={() => void handleVerify()}
        className="h-11 rounded-full px-5"
      >
        {state.kind === "loading" ? "Verifying..." : "Verify token"}
      </Button>

      <div
        data-testid="scan-harness-result"
        className="rounded-2xl border border-white/10 bg-[#081421] p-4 text-sm"
      >
        {state.kind === "idle" ? (
          <p className="text-[var(--color-text-secondary)]">
            No verification has run yet.
          </p>
        ) : null}

        {state.kind === "loading" ? (
          <p className="text-[var(--color-text-secondary)]">
            Verifying token...
          </p>
        ) : null}

        {state.kind === "success" ? (
          <div className="space-y-1">
            <p className="font-semibold text-[#22FF88]">{state.message}</p>
            {state.attendeeName ? (
              <p className="text-white">{state.attendeeName}</p>
            ) : null}
            {state.eventName ? (
              <p className="text-[var(--color-text-secondary)]">
                {state.eventName}
              </p>
            ) : null}
          </div>
        ) : null}

        {state.kind === "error" ? (
          <p className="font-medium text-red-300">{state.message}</p>
        ) : null}
      </div>
    </Card>
  );
}
