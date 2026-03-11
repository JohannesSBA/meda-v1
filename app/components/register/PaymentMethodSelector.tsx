/**
 * PaymentMethodSelector -- Balance vs Chapa payment method toggle for paid events.
 */

"use client";

type PaymentMethodSelectorProps = {
  isPaid: boolean;
  userBalance: number;
  paymentMethod: "chapa" | "balance";
  setPaymentMethod: (m: "chapa" | "balance") => void;
  pricePerTicket: number;
  qty: number;
};

export function PaymentMethodSelector({
  isPaid,
  userBalance,
  paymentMethod,
  setPaymentMethod,
  pricePerTicket,
  qty,
}: PaymentMethodSelectorProps) {
  if (!isPaid || userBalance <= 0) return null;

  const total = pricePerTicket * qty;
  const insufficientBalance = paymentMethod === "balance" && userBalance < total;

  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-[var(--color-text-secondary)]">
        Pay with
      </p>
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
          <span className="block text-xs opacity-75">
            ETB {userBalance.toFixed(2)}
          </span>
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
      {insufficientBalance ? (
        <p className="text-xs text-red-400">
          Insufficient balance. You need ETB {total.toFixed(2)} but have ETB{" "}
          {userBalance.toFixed(2)}.
        </p>
      ) : null}
    </div>
  );
}
