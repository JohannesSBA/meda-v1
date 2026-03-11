/**
 * RegisterPanel -- Event registration sidebar with tickets, payment, share, and refund.
 *
 * Used on event detail page. Handles free/paid registration, Chapa/balance payment,
 * waitlist, ticket sharing, and refunds.
 */

"use client";

import { Card } from "@/app/components/ui/card";
import { Badge } from "@/app/components/ui/badge";
import { Select } from "@/app/components/ui/select";
import { Input } from "@/app/components/ui/input";
import { Button } from "@/app/components/ui/button";
import TicketQRPanel from "@/app/components/tickets/TicketQRPanel";
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

export default function RegisterPanel({
  event,
  isSoldOut,
  occurrences = [],
}: RegisterPanelProps) {
  const data = useRegisterPanel({ event, isSoldOut, occurrences });

  const registerDisabled =
    data.loading ||
    data.confirmingPayment ||
    data.soldOutForSelection ||
    (data.isPaid &&
      data.paymentMethod === "balance" &&
      data.userBalance < (event.priceField ?? 0) * data.qty);

  return (
    <Card
      id="register-panel"
      className="space-y-4 rounded-2xl border-none bg-[#0f2235] p-5 sm:rounded-3xl sm:p-6"
    >
      {data.confirmingPayment ? (
        <div className="flex flex-col items-center gap-3 py-6 text-center">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-[var(--color-brand)] border-t-transparent" />
          <p className="text-base font-semibold text-white">
            Confirming your payment...
          </p>
          <p className="text-sm text-[var(--color-text-muted)]">
            Please wait while we verify with Chapa.
          </p>
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between">
            <div>
              <p className="heading-kicker">Tickets</p>
              <h3 className="text-lg font-semibold text-white">
                Register to play
              </h3>
            </div>
            <Badge className="bg-white/10 text-sm text-[var(--color-text-secondary)]">
              {event.priceField ? `ETB ${event.priceField}` : "Free"}
            </Badge>
          </div>

          <div className="space-y-3 text-sm text-[var(--color-text-secondary)]">
            {data.occurrenceOptions.length > 1 ? (
              <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                <span className="font-medium">Date</span>
                <Select
                  value={data.selectedEventId}
                  onChange={(e) => data.setSelectedEventId(e.target.value)}
                  className="bg-[#0a1927] sm:min-w-[220px] sm:text-right"
                >
                  {data.occurrenceOptions.map((entry) => (
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
                {data.soldOutForSelection
                  ? "Sold out"
                  : data.remaining === Infinity
                    ? "No limit"
                    : `${data.remaining} seats`}
              </span>
            </div>
            <div className="flex items-center justify-between py-1">
              <span>Your tickets</span>
              <span className="font-semibold text-white">
                {data.myTickets ?? 0}
              </span>
            </div>
            <div className="flex items-center justify-between py-1">
              <span>Quantity to add</span>
              <Input
                type="number"
                min={1}
                max={data.maxQty}
                value={data.qty}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  data.setQty(
                    Number.isFinite(val)
                      ? Math.max(1, Math.min(data.maxQty, val))
                      : 1,
                  );
                }}
                className="w-24 border-none bg-[#0a1927] text-right"
              />
            </div>
          </div>

          <PaymentMethodSelector
            isPaid={data.isPaid}
            userBalance={data.userBalance}
            paymentMethod={data.paymentMethod}
            setPaymentMethod={data.setPaymentMethod}
            pricePerTicket={event.priceField ?? 0}
            qty={data.qty}
          />

          <div className="grid gap-2">
            <Button
              type="button"
              disabled={registerDisabled}
              onClick={data.handleRegister}
              variant="primary"
              className="h-[52px] w-full rounded-2xl text-base font-bold"
            >
              {data.soldOutForSelection
                ? "Sold out"
                : data.loading
                  ? "Processing…"
                  : data.isPaid
                    ? data.paymentMethod === "balance"
                      ? "Pay with balance"
                      : "Pay with Chapa"
                    : "Get tickets"}
            </Button>
            {data.soldOutForSelection &&
            data.myTickets === 0 &&
            data.userId ? (
              <Button
                type="button"
                variant="secondary"
                className="h-11 w-full rounded-2xl"
                disabled={data.waitlistLoading}
                onClick={() => void data.handleWaitlistToggle()}
              >
                {data.waitlistLoading
                  ? "…"
                  : data.onWaitlist
                    ? "Leave waitlist"
                    : "Join waitlist"}
              </Button>
            ) : null}
          </div>

          {data.myTickets > 0 ? (
            <TicketQRPanel
              eventId={event.eventId}
              eventName={event.eventName}
              ticketCount={data.myTickets}
            />
          ) : null}

          {data.canShareTickets ? (
            <ShareTicketCard
              shareLoading={data.shareLoading}
              shareUrl={data.shareUrl}
              remainingClaims={data.remainingClaims}
              myTickets={data.myTickets}
              onCopy={data.handleCopyShareLink}
              onRegenerate={() =>
                void data.generateShareLink(data.selectedEventId)
              }
              shareCopied={data.shareCopied}
            />
          ) : null}

          {data.refundEligible && !data.showRefundConfirm ? (
            <Button
              type="button"
              variant="secondary"
              className="h-11 w-full rounded-2xl border-none text-red-400"
              onClick={() => {
                data.setRefundQty(1);
                data.setShowRefundConfirm(true);
              }}
            >
              {data.isPaid
                ? "Cancel & refund tickets"
                : "Cancel tickets"}
            </Button>
          ) : null}

          {data.showRefundConfirm ? (
            <RefundConfirmCard
              isPaid={data.isPaid}
              pricePerTicket={event.priceField ?? 0}
              refundQty={data.refundQty}
              setRefundQty={data.setRefundQty}
              myTickets={data.myTickets}
              refundLoading={data.refundLoading}
              onConfirm={data.handleRefund}
              onCancel={() => data.setShowRefundConfirm(false)}
            />
          ) : null}

          <Button
            type="button"
            onClick={data.handleToggleSave}
            variant="secondary"
            className="h-11 w-full rounded-2xl border-none"
          >
            {data.isSaved ? "Remove from saved" : "Save event"}
          </Button>

          <div className="rounded-xl border border-white/10 bg-[#0a1927] p-3 text-xs text-[var(--color-text-muted)]">
            {data.isPaid ? (
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
