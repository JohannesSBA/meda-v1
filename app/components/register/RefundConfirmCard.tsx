/**
 * RefundConfirmCard -- Refund confirmation UI with quantity selector.
 */

"use client";

import { Card } from "@/app/components/ui/card";
import { Input } from "@/app/components/ui/input";
import { Button } from "@/app/components/ui/button";

type RefundConfirmCardProps = {
  isPaid: boolean;
  pricePerTicket: number;
  refundQty: number;
  setRefundQty: (qty: number) => void;
  myTickets: number;
  refundLoading: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

export function RefundConfirmCard({
  isPaid,
  pricePerTicket,
  refundQty,
  setRefundQty,
  myTickets,
  refundLoading,
  onConfirm,
  onCancel,
}: RefundConfirmCardProps) {
  return (
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
          ETB {pricePerTicket * refundQty} will be credited to your Meda
          balance.
        </p>
      ) : null}
      <div className="flex gap-2">
        <Button
          type="button"
          variant="danger"
          className="h-11 flex-1 rounded-xl"
          disabled={refundLoading}
          onClick={() => void onConfirm()}
        >
          {refundLoading ? "Processing…" : "Confirm"}
        </Button>
        <Button
          type="button"
          variant="secondary"
          className="h-11 flex-1 rounded-xl"
          onClick={onCancel}
        >
          Keep tickets
        </Button>
      </div>
    </Card>
  );
}
