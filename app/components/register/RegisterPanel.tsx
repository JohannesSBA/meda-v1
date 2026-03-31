/**
 * RegisterPanel -- Event registration sidebar with tickets, payment, share, and refund.
 */

"use client";

import { Card } from "@/app/components/ui/card";
import { Badge } from "@/app/components/ui/badge";
import { Select } from "@/app/components/ui/select";
import { Input } from "@/app/components/ui/input";
import { Button } from "@/app/components/ui/button";
import TicketQRPanel from "@/app/components/tickets/TicketQRPanel";
import { computeTicketChargeBreakdown } from "@/lib/ticketPricing";
import { useRegisterPanel } from "./useRegisterPanel";
import { PaymentMethodSelector } from "./PaymentMethodSelector";
import { ShareTicketCard } from "./ShareTicketCard";
import { RefundConfirmCard } from "./RefundConfirmCard";
import type { EventOccurrence, EventResponse } from "@/app/types/eventTypes";

type RegisterPanelProps = {
  event: EventResponse;
  isSoldOut: boolean;
  occurrences?: EventOccurrence[];
};

export default function RegisterPanel({ event, isSoldOut, occurrences = [] }: RegisterPanelProps) {
  const data = useRegisterPanel({ event, isSoldOut, occurrences });
  const chargeBreakdown = computeTicketChargeBreakdown({
    unitPriceEtb: event.priceField ?? 0,
    quantity: data.qty,
  });

  const registerDisabled =
    data.loading ||
    data.confirmingPayment ||
    data.soldOutForSelection ||
    (data.isPaid &&
      data.paymentMethod === "balance" &&
      data.userBalance < chargeBreakdown.totalAmountEtb);

  return (
    <Card id="register-panel" className="space-y-5 rounded-[var(--radius-xl)] p-5 sm:p-6">
      {data.confirmingPayment ? (
        <div className="flex flex-col items-center gap-3 py-8 text-center">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-[var(--color-brand)] border-t-transparent" />
          <p className="text-base font-semibold text-[var(--color-text-primary)]">Confirming your payment...</p>
          <p className="text-sm text-[var(--color-text-muted)]">Please wait while we verify with Chapa.</p>
        </div>
      ) : (
        <>
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-2">
              <p className="heading-kicker">Tickets</p>
              <h3 className="text-2xl font-semibold tracking-[-0.04em] text-[var(--color-text-primary)]">Register to play</h3>
            </div>
            <Badge variant="accent">
              {event.priceField ? `ETB ${event.priceField} + 15 fee` : "Free"}
            </Badge>
          </div>

          <div className="space-y-4 text-sm text-[var(--color-text-secondary)]">
            {data.occurrenceOptions.length > 1 ? (
              <div className="space-y-2">
                <label className="field-label mb-0">Date</label>
                <Select value={data.selectedEventId} onChange={(e) => data.setSelectedEventId(e.target.value)}>
                  {data.occurrenceOptions.map((entry) => (
                    <option key={entry.eventId} value={entry.eventId}>
                      {new Date(entry.eventDatetime).toLocaleString()}
                    </option>
                  ))}
                </Select>
              </div>
            ) : null}

            <div className="grid gap-3">
              <InfoRow label="Available" value={data.soldOutForSelection ? "Sold out" : data.remaining === Infinity ? "No limit" : `${data.remaining} seats`} />
              <InfoRow label="Tickets you hold" value={`${data.myTickets ?? 0}`} />
              {data.isPaid ? (
                <InfoRow
                  label="Refundable tickets"
                  value={`${data.refundableTicketCount ?? 0}`}
                />
              ) : null}
              <div className="surface-card-muted rounded-[var(--radius-md)] p-3.5">
                <label className="field-label mb-2">Quantity to add</label>
                <Input
                  type="number"
                  min={1}
                  max={data.maxQty}
                  value={data.qty}
                  onChange={(e) => {
                    const val = Number(e.target.value);
                    data.setQty(Number.isFinite(val) ? Math.max(1, Math.min(data.maxQty, val)) : 1);
                  }}
                  className="text-right"
                />
              </div>
            </div>
          </div>

          {data.isPaid ? (
            <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-white/[0.03] p-4 text-sm text-[var(--color-text-secondary)]">
              <p className="font-semibold text-[var(--color-text-primary)]">
                Price breakdown
              </p>
              <div className="mt-3 space-y-2">
                <InfoRow
                  label="Ticket price"
                  value={`ETB ${chargeBreakdown.ticketSubtotalEtb.toFixed(2)}`}
                />
                <InfoRow
                  label="Platform fee"
                  value={`ETB ${chargeBreakdown.surchargeTotalEtb.toFixed(2)}`}
                />
                <InfoRow
                  label="Total to pay"
                  value={`ETB ${chargeBreakdown.totalAmountEtb.toFixed(2)}`}
                />
              </div>
              <p className="mt-3 text-xs leading-6 text-[var(--color-text-muted)]">
                The ETB 15 fee per ticket stays with Meda&apos;s Chapa account for payment processing and does not go to the host.
              </p>
            </div>
          ) : null}

          <PaymentMethodSelector
            isPaid={data.isPaid}
            userBalance={data.userBalance}
            paymentMethod={data.paymentMethod}
            setPaymentMethod={data.setPaymentMethod}
            totalDue={chargeBreakdown.totalAmountEtb}
          />

          <div className="grid gap-3">
            <Button
              type="button"
              disabled={registerDisabled}
              onClick={data.handleRegister}
              variant="primary"
              className="h-[52px] w-full rounded-full text-base font-bold"
            >
              {data.soldOutForSelection
                ? "Sold out"
                : data.loading
                  ? "Processing..."
                  : data.isPaid
                    ? data.paymentMethod === "balance"
                      ? "Pay with balance"
                      : "Pay with Chapa"
                    : "Get tickets"}
            </Button>
            {data.soldOutForSelection && data.myTickets === 0 && data.userId ? (
              <Button
                type="button"
                variant="secondary"
                className="h-11 w-full rounded-full"
                disabled={data.waitlistLoading}
                onClick={() => void data.handleWaitlistToggle()}
              >
                {data.waitlistLoading ? "..." : data.onWaitlist ? "Leave waitlist" : "Join waitlist"}
              </Button>
            ) : null}
          </div>

          {data.myTickets > 0 ? <TicketQRPanel eventId={event.eventId} eventName={event.eventName} ticketCount={data.myTickets} /> : null}
          {data.canShareTickets ? (
            <ShareTicketCard
              shareLoading={data.shareLoading}
              shareUrl={data.shareUrl}
              remainingClaims={data.remainingClaims}
              myTickets={data.myTickets}
              onCopy={data.handleCopyShareLink}
              onRegenerate={() => void data.generateShareLink(data.selectedEventId)}
              shareCopied={data.shareCopied}
            />
          ) : null}

          {data.refundEligible && !data.showRefundConfirm ? (
            <Button
              type="button"
              variant="secondary"
              className="h-11 w-full rounded-full text-red-300"
              onClick={() => {
                data.setRefundQty(1);
                data.setShowRefundConfirm(true);
              }}
            >
              {data.isPaid ? "Cancel and refund tickets" : "Cancel tickets"}
            </Button>
          ) : null}

          {data.showRefundConfirm ? (
            <RefundConfirmCard
              isPaid={data.isPaid}
              refundQty={data.refundQty}
              setRefundQty={data.setRefundQty}
              refundableTicketCount={data.refundableTicketCount}
              refundAmountEtb={data.refundQuoteAmountEtb}
              refundQuoteLoading={data.refundQuoteLoading}
              refundLoading={data.refundLoading}
              onConfirm={data.handleRefund}
              onCancel={() => data.setShowRefundConfirm(false)}
            />
          ) : null}

          {data.holdsTransferredTickets ? (
            <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-white/[0.03] p-4 text-xs leading-6 text-[var(--color-text-muted)]">
              These tickets were transferred to you. Only the original purchaser can request a refund.
            </div>
          ) : null}

          <Button type="button" onClick={data.handleToggleSave} variant="secondary" className="h-11 w-full rounded-full">
            {data.isSaved ? "Remove from saved" : "Save event"}
          </Button>

          <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-white/[0.03] p-4 text-xs leading-6 text-[var(--color-text-muted)]">
            {data.isPaid ? (
              <p>
                Refunds are available up to 24 hours before the event. Refunded amounts are credited to your Meda balance. No refunds within 24 hours of kickoff.
              </p>
            ) : (
              <p>
                You may cancel your registration up to 24 hours before the event. No cancellations within 24 hours of kickoff.
              </p>
            )}
          </div>
        </>
      )}
    </Card>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="surface-card-muted flex items-center justify-between rounded-[var(--radius-md)] p-3.5">
      <span>{label}</span>
      <span className="font-semibold text-[var(--color-text-primary)]">{value}</span>
    </div>
  );
}
