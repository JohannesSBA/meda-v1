/**
 * QRScanner -- camera-based QR code scanner for event check-in.
 *
 * Uses html5-qrcode; validates tokens against event attendees.
 */

"use client";

import { useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { PageShell } from "../ui/page-shell";
import { Card } from "../ui/card";
import Link from "next/link";
import { Button } from "../ui/button";
import { browserApi, BrowserApiError } from "@/lib/browserApi";

type Props = {
  eventId: string;
  eventName: string;
};

type ScanResult = {
  id: string;
  valid: boolean;
  eventName?: string;
  eventDatetime?: string;
  addressLabel?: string;
  attendeeName?: string | null;
  alreadyScanned?: boolean;
  previousScan?: {
    scannedAt: string;
    scannedByName: string;
  };
  error?: string;
};

function extractTokenFromUrl(url: string): string | null {
  try {
    const match = url.match(/\/tickets\/verify\/([^/?]+)/);
    return match ? match[1] : null;
  } catch {
    return null;
  }
}

export default function QRScanner({ eventId, eventName }: Props) {
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const lastScannedRef = useRef<string | null>(null);
  const cooldownRef = useRef(false);
  const [lastResult, setLastResult] = useState<ScanResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [recentScans, setRecentScans] = useState<ScanResult[]>([]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const verifyToken = async (token: string): Promise<ScanResult> => {
      try {
        const data = await browserApi.post<{
          valid: boolean;
          eventName?: string;
          eventDatetime?: string;
          addressLabel?: string;
          attendeeName?: string | null;
          alreadyScanned?: boolean;
          previousScan?: { scannedAt: string; scannedByName: string };
          error?: string;
        }>(
          `/api/tickets/verify/${encodeURIComponent(token)}`,
          { eventId },
          { cache: "no-store", credentials: "include" },
        );
        return {
          id: crypto.randomUUID(),
          valid: data.valid,
          eventName: data.eventName,
          eventDatetime: data.eventDatetime,
          addressLabel: data.addressLabel,
          attendeeName: data.attendeeName,
          alreadyScanned: data.alreadyScanned,
          previousScan: data.previousScan,
          error: data.error,
        };
      } catch (error) {
        const message =
          error instanceof BrowserApiError ? error.message : "Verification failed";
        return {
          id: crypto.randomUUID(),
          valid: false,
          error: message,
        };
      }
    };

    const handleScan = async (decodedText: string) => {
      if (cooldownRef.current) return;
      const token = extractTokenFromUrl(decodedText) ?? decodedText;
      if (lastScannedRef.current === token) return;
      lastScannedRef.current = token;
      cooldownRef.current = true;
      setTimeout(() => {
        cooldownRef.current = false;
        lastScannedRef.current = null;
      }, 2000);

      const result = await verifyToken(token);
      setLastResult(result);
      if (result.valid) {
        setRecentScans((prev) => [result, ...prev.slice(0, 4)]);
      }
    };

    const startScanner = async () => {
      try {
        setError(null);
        const html5Qr = new Html5Qrcode("qr-reader");
        scannerRef.current = html5Qr;

        await html5Qr.start(
          { facingMode: "environment" },
          {
            fps: 10,
            qrbox: { width: 250, height: 250 },
          },
          handleScan,
          () => {},
        );
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Failed to start camera";
        setError(msg);
      }
    };

    void startScanner();
    return () => {
      if (scannerRef.current?.isScanning) {
        scannerRef.current.stop().catch(() => {});
      }
      scannerRef.current = null;
    };
  }, [eventId]);

  return (
    <PageShell>
      <div className="mx-auto flex max-w-2xl flex-col gap-4 py-4 sm:gap-6 sm:py-8">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-white sm:text-2xl">Scan tickets</h1>
            <p className="mt-0.5 text-sm text-[var(--color-text-secondary)]">
              {eventName}
            </p>
          </div>
          <Link href={`/events/${eventId}`}>
            <Button variant="secondary" size="sm" className="rounded-full">
              Back
            </Button>
          </Link>
        </div>

        {/* Camera view */}
        <Card className="overflow-hidden rounded-2xl bg-[#0d1a27]/90 p-3 sm:p-4">
          <div
            id="qr-reader"
            className="overflow-hidden rounded-xl border border-[var(--color-border)] bg-black [&_.qr-shaded-region]:border-4 [&_.qr-shaded-region]:border-[var(--color-brand)]"
          />
          {error ? (
            <p className="mt-4 text-center text-sm text-red-400">{error}</p>
          ) : null}
        </Card>

        {/* Scan result - shown as prominent card */}
        {lastResult ? (
          <Card
            className={`rounded-2xl p-5 ${
              lastResult.valid
                ? lastResult.alreadyScanned
                  ? "border-amber-500/50 bg-amber-500/10"
                  : "border-[#22FF88]/50 bg-[#22FF88]/10"
                : "border-red-500/50 bg-red-500/10"
            }`}
          >
            <div className="flex items-start gap-4">
              <div
                className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-full ${
                  lastResult.valid
                    ? lastResult.alreadyScanned
                      ? "bg-amber-500/30"
                      : "bg-[#22FF88]/30"
                    : "bg-red-500/30"
                }`}
              >
                {lastResult.valid ? (
                  lastResult.alreadyScanned ? (
                    <svg className="h-7 w-7 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                  ) : (
                    <svg className="h-7 w-7 text-[#22FF88]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  )
                ) : (
                  <svg className="h-7 w-7 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                )}
              </div>
              <div className="min-w-0 flex-1 space-y-1">
                <p
                  className={`text-lg font-bold ${
                    lastResult.valid
                      ? lastResult.alreadyScanned
                        ? "text-amber-400"
                        : "text-[#22FF88]"
                      : "text-red-400"
                  }`}
                >
                  {lastResult.valid
                    ? lastResult.alreadyScanned
                      ? "Already scanned"
                      : "Ticket verified"
                    : "Invalid ticket"}
                </p>
                {lastResult.valid && lastResult.attendeeName ? (
                  <p className="text-xl font-bold text-white">
                    {lastResult.attendeeName}
                  </p>
                ) : null}
                {lastResult.valid && lastResult.eventName ? (
                  <p className="text-sm text-[var(--color-text-secondary)]">
                    {lastResult.eventName}
                  </p>
                ) : null}
                {lastResult.valid && lastResult.alreadyScanned && lastResult.previousScan ? (
                  <div className="mt-3 rounded-lg bg-black/20 px-4 py-3 text-sm">
                    <p className="font-medium text-amber-200">Previously scanned</p>
                    <p className="mt-0.5 text-[var(--color-text-muted)]">
                      {new Date(lastResult.previousScan.scannedAt).toLocaleString()} by{" "}
                      {lastResult.previousScan.scannedByName}
                    </p>
                  </div>
                ) : null}
                {!lastResult.valid && lastResult.error ? (
                  <p className="text-sm text-red-300">{lastResult.error}</p>
                ) : null}
              </div>
            </div>
          </Card>
        ) : null}

        {/* Recent scans */}
        {recentScans.length > 0 ? (
          <Card className="rounded-2xl border border-[var(--color-border)] bg-[#0a1927] p-4">
            <h2 className="mb-3 text-base font-semibold text-white">
              Recent verifications
            </h2>
            <ul className="space-y-2">
              {recentScans.map((r) => (
                <li
                  key={r.id}
                  className="flex items-center gap-3 rounded-xl bg-[#06111c] px-4 py-3"
                >
                  <span
                    className={`h-3 w-3 shrink-0 rounded-full ${
                      r.valid
                        ? r.alreadyScanned
                          ? "bg-amber-500"
                          : "bg-[#22FF88]"
                        : "bg-red-500"
                    }`}
                  />
                  <div className="min-w-0 flex-1">
                    <span className="text-base font-medium text-white">
                      {r.attendeeName ?? "Unknown attendee"}
                    </span>
                    {r.alreadyScanned ? (
                      <span className="ml-2 text-sm text-amber-400">(re-scan)</span>
                    ) : null}
                    {r.eventName ? (
                      <p className="text-sm text-[var(--color-text-muted)]">{r.eventName}</p>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          </Card>
        ) : null}
      </div>
    </PageShell>
  );
}
