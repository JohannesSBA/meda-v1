"use client";

import { AsyncPanelState } from "@/app/components/ui/async-panel-state";
import { Button } from "@/app/components/ui/button";
import { Card } from "@/app/components/ui/card";
import { Input } from "@/app/components/ui/input";
import { Select } from "@/app/components/ui/select";
import type {
  AdminOwnerPayoutSummary,
  AdminUserRow,
  EventCreationFeeItem,
  PromoCodeItem,
} from "./types";

type PromoFormState = {
  code: string;
  discountType: "full" | "partial";
  discountValue: string;
  pitchOwnerUserId: string;
  maxUses: string;
  expiresAt: string;
};

type AdminBillingTabProps = {
  fee: EventCreationFeeItem | null;
  feeLoading: boolean;
  feeError?: string | null;
  feeAmountDraft: string;
  setFeeAmountDraft: (value: string) => void;
  savingFee: boolean;
  onSaveFee: () => void;
  promoCodes: PromoCodeItem[];
  promoCodesLoading: boolean;
  promoCodesError?: string | null;
  promoForm: PromoFormState;
  onPromoFieldChange: (
    field: keyof PromoFormState,
    value: string,
  ) => void;
  creatingPromo: boolean;
  onCreatePromo: () => void;
  onTogglePromo: (promoId: string, isActive: boolean) => void;
  payoutOwners: AdminOwnerPayoutSummary[];
  payoutsLoading: boolean;
  payoutsError?: string | null;
  ticketSurchargeEtb: number;
  commissionPercent: number;
  payoutDraftByOwner: Record<string, string>;
  payingOutOwnerId: string | null;
  onPayoutDraftChange: (ownerId: string, value: string) => void;
  onCreatePayout: (ownerId: string) => void;
  pitchOwners: AdminUserRow[];
  onRetry?: () => void;
};

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "ETB",
    maximumFractionDigits: 2,
  }).format(amount);
}

export function AdminBillingTab({
  fee,
  feeLoading,
  feeError,
  feeAmountDraft,
  setFeeAmountDraft,
  savingFee,
  onSaveFee,
  promoCodes,
  promoCodesLoading,
  promoCodesError,
  promoForm,
  onPromoFieldChange,
  creatingPromo,
  onCreatePromo,
  onTogglePromo,
  payoutOwners,
  payoutsLoading,
  payoutsError,
  ticketSurchargeEtb,
  commissionPercent,
  payoutDraftByOwner,
  payingOutOwnerId,
  onPayoutDraftChange,
  onCreatePayout,
  pitchOwners,
  onRetry,
}: AdminBillingTabProps) {
  return (
    <section
      id="admin-tabpanel-billing"
      role="tabpanel"
      aria-label="Billing administration"
      className="space-y-4 rounded-2xl border border-white/10 bg-[#0c1d2e]/80 p-4 sm:p-5"
    >
      <div className="space-y-1">
        <h2 className="text-lg font-semibold text-white">Billing controls</h2>
        <p className="text-sm text-[var(--color-text-secondary)]">
          Manage platform fees, host payouts, and promo codes used to waive or reduce host creation costs.
        </p>
      </div>

      <Card className="space-y-4 p-5">
        <div className="space-y-1">
          <p className="text-sm font-semibold text-[var(--color-text-primary)]">
            Ticket pricing and payout rule
          </p>
          <p className="text-sm text-[var(--color-text-secondary)]">
            Every paid ticket now includes an extra platform fee that stays in Meda&apos;s Chapa account.
          </p>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-white/[0.03] p-4">
            <p className="text-xs uppercase tracking-[0.18em] text-[var(--color-text-muted)]">
              Platform fee
            </p>
            <p className="mt-2 text-lg font-semibold text-[var(--color-text-primary)]">
              {formatCurrency(ticketSurchargeEtb)} per ticket
            </p>
          </div>
          <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-white/[0.03] p-4">
            <p className="text-xs uppercase tracking-[0.18em] text-[var(--color-text-muted)]">
              Platform commission
            </p>
            <p className="mt-2 text-lg font-semibold text-[var(--color-text-primary)]">
              {(commissionPercent * 100).toFixed(0)}% of ticket price
            </p>
          </div>
          <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-white/[0.03] p-4">
            <p className="text-xs uppercase tracking-[0.18em] text-[var(--color-text-muted)]">
              Payout destination rule
            </p>
            <p className="mt-2 text-sm font-medium leading-6 text-[var(--color-text-primary)]">
              Host payouts are sent from Meda&apos;s Chapa balance to the host&apos;s verified bank destination. This is not a direct wallet-to-wallet Chapa send.
            </p>
          </div>
        </div>
      </Card>

      <div className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
        <Card className="space-y-4 p-5">
          <div className="space-y-1">
            <p className="text-sm font-semibold text-[var(--color-text-primary)]">
              Event creation fee
            </p>
            <p className="text-sm text-[var(--color-text-secondary)]">
              This fee applies to pitch-owner event submissions unless a promo code waives it.
            </p>
          </div>

          <AsyncPanelState
            loading={feeLoading}
            error={feeError}
            isEmpty={false}
            loadingFallback={<p className="text-sm text-[var(--color-text-secondary)]">Loading fee...</p>}
            emptyTitle=""
            emptyDescription=""
            onRetry={onRetry}
          >
            <div className="space-y-3">
              <label>
                <span className="field-label">Amount (ETB)</span>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={feeAmountDraft}
                  onChange={(event) => setFeeAmountDraft(event.target.value)}
                />
              </label>
              <Button
                type="button"
                onClick={() => void onSaveFee()}
                disabled={savingFee}
                className="rounded-full"
              >
                {savingFee ? "Saving..." : "Save fee"}
              </Button>
              {fee ? (
                <p className="text-xs text-[var(--color-text-muted)]">
                  Active from {new Date(fee.effectiveFrom).toLocaleString()}
                </p>
              ) : (
                <p className="text-xs text-[var(--color-text-muted)]">
                  No fee configured yet. Pitch-owner event creation is currently free.
                </p>
              )}
            </div>
          </AsyncPanelState>
        </Card>

        <Card className="space-y-4 p-5">
          <div className="space-y-1">
            <p className="text-sm font-semibold text-[var(--color-text-primary)]">
              Create promo code
            </p>
            <p className="text-sm text-[var(--color-text-secondary)]">
              Leave the pitch owner field blank to create a global code.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <label>
              <span className="field-label">Code</span>
              <Input
                value={promoForm.code}
                onChange={(event) =>
                  onPromoFieldChange("code", event.target.value)
                }
                placeholder="FREE100"
              />
            </label>
            <label>
              <span className="field-label">Type</span>
              <Select
                value={promoForm.discountType}
                onChange={(event) =>
                  onPromoFieldChange(
                    "discountType",
                    event.target.value,
                  )
                }
              >
                <option value="full">Full waiver</option>
                <option value="partial">Partial discount</option>
              </Select>
            </label>
            <label>
              <span className="field-label">Value</span>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={promoForm.discountValue}
                onChange={(event) =>
                  onPromoFieldChange("discountValue", event.target.value)
                }
                disabled={promoForm.discountType === "full"}
              />
            </label>
            <label>
              <span className="field-label">Max uses</span>
              <Input
                type="number"
                min="1"
                step="1"
                value={promoForm.maxUses}
                onChange={(event) =>
                  onPromoFieldChange("maxUses", event.target.value)
                }
                placeholder="Unlimited"
              />
            </label>
            <label className="sm:col-span-2">
              <span className="field-label">Pitch owner scope</span>
              <Select
                value={promoForm.pitchOwnerUserId}
                onChange={(event) =>
                  onPromoFieldChange("pitchOwnerUserId", event.target.value)
                }
              >
                <option value="">Global</option>
                {pitchOwners.map((pitchOwner) => (
                  <option key={pitchOwner.id} value={pitchOwner.id}>
                    {pitchOwner.name} ({pitchOwner.email})
                  </option>
                ))}
              </Select>
            </label>
            <label className="sm:col-span-2">
              <span className="field-label">Expires at</span>
              <Input
                type="datetime-local"
                value={promoForm.expiresAt}
                onChange={(event) =>
                  onPromoFieldChange("expiresAt", event.target.value)
                }
              />
            </label>
          </div>

          <Button
            type="button"
            onClick={() => void onCreatePromo()}
            disabled={creatingPromo}
            className="rounded-full"
          >
            {creatingPromo ? "Creating..." : "Create promo"}
          </Button>
        </Card>
      </div>

      <AsyncPanelState
        loading={payoutsLoading}
        error={payoutsError}
        isEmpty={payoutOwners.length === 0}
        loadingFallback={<Card className="p-5 text-sm text-[var(--color-text-secondary)]">Loading host payouts...</Card>}
        emptyTitle="No host payout profiles yet"
        emptyDescription="Hosts need verified payout details before their earnings can be transferred."
        onRetry={onRetry}
      >
        <div className="space-y-3">
          {payoutOwners.map((owner) => (
            <Card key={owner.ownerId} className="space-y-4 p-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-lg font-semibold text-[var(--color-text-primary)]">
                      {owner.ownerName ?? owner.businessName ?? "Pitch owner"}
                    </p>
                    <span className="rounded-full bg-white/[0.06] px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--color-text-secondary)]">
                      {owner.payoutReady ? "Ready" : "Needs setup"}
                    </span>
                  </div>
                  <p className="text-sm text-[var(--color-text-secondary)]">
                    {owner.ownerEmail ?? "No email on file"}
                  </p>
                  <p className="text-sm text-[var(--color-text-secondary)]">
                    {owner.destinationLabel ??
                      owner.payoutSetupIssue ??
                      "No verified payout destination yet"}
                  </p>
                </div>

                <div className="min-w-[220px] rounded-[var(--radius-md)] border border-[rgba(125,211,252,0.2)] bg-[var(--color-accent-soft)] p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-[var(--color-text-muted)]">
                    Ready to send now
                  </p>
                  <p className="mt-2 text-2xl font-semibold text-[var(--color-text-primary)]">
                    {formatCurrency(owner.availablePayoutEtb)}
                  </p>
                  <p className="mt-1 text-xs leading-6 text-[var(--color-text-muted)]">
                    Already sent: {formatCurrency(owner.totalPaidOutEtb)}. Still pending: {formatCurrency(owner.totalPendingPayoutEtb)}.
                  </p>
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-4">
                <Metric label="Ticket sales" value={formatCurrency(owner.grossTicketSalesEtb)} />
                <Metric label="Platform commission" value={formatCurrency(owner.platformCommissionEtb)} />
                <Metric label="Platform fees" value={formatCurrency(owner.ticketSurchargeEtb)} />
                <Metric label="Host net revenue" value={formatCurrency(owner.netOwnerRevenueEtb)} />
              </div>

              <div className="grid gap-3 lg:grid-cols-[220px_auto]">
                <label>
                  <span className="field-label">Payout amount (ETB)</span>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={payoutDraftByOwner[owner.ownerId] ?? ""}
                    onChange={(event) =>
                      onPayoutDraftChange(owner.ownerId, event.target.value)
                    }
                    disabled={!owner.payoutReady || owner.availablePayoutEtb <= 0}
                  />
                </label>

                <div className="flex items-end gap-3">
                  <Button
                    type="button"
                    className="rounded-full"
                    disabled={
                      !owner.payoutReady ||
                      owner.availablePayoutEtb <= 0 ||
                      payingOutOwnerId === owner.ownerId
                    }
                    onClick={() => void onCreatePayout(owner.ownerId)}
                  >
                    {payingOutOwnerId === owner.ownerId
                      ? "Sending..."
                      : "Send payout"}
                  </Button>
                  <p className="text-xs leading-6 text-[var(--color-text-muted)]">
                    Funds leave Meda&apos;s Chapa balance and go to the verified host destination shown above.
                  </p>
                </div>
              </div>

              {owner.recentPayouts.length > 0 ? (
                <div className="space-y-2">
                  <p className="text-xs uppercase tracking-[0.18em] text-[var(--color-text-muted)]">
                    Recent payouts
                  </p>
                  <div className="grid gap-2">
                    {owner.recentPayouts.map((payout) => (
                      <div
                        key={payout.id}
                        className="flex flex-col gap-1 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-white/[0.02] px-4 py-3 text-sm text-[var(--color-text-secondary)] md:flex-row md:items-center md:justify-between"
                      >
                        <div>
                          <p className="font-medium text-[var(--color-text-primary)]">
                            {formatCurrency(payout.amountEtb)} • {payout.status}
                          </p>
                          <p className="text-xs text-[var(--color-text-muted)]">
                            {new Date(payout.createdAt).toLocaleString()} • {payout.reference}
                          </p>
                        </div>
                        <p className="text-xs text-[var(--color-text-muted)]">
                          {payout.failureReason ?? payout.destinationBusinessName ?? "Processing"}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </Card>
          ))}
        </div>
      </AsyncPanelState>

      <AsyncPanelState
        loading={promoCodesLoading}
        error={promoCodesError}
        isEmpty={promoCodes.length === 0}
        loadingFallback={<Card className="p-5 text-sm text-[var(--color-text-secondary)]">Loading promo codes...</Card>}
        emptyTitle="No promo codes yet"
        emptyDescription="Create a promo code above to waive or discount event creation fees."
        onRetry={onRetry}
      >
        <div className="grid gap-3">
          {promoCodes.map((promo) => (
            <Card key={promo.id} className="p-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-lg font-semibold text-[var(--color-text-primary)]">
                      {promo.code}
                    </p>
                    <span className="rounded-full bg-white/[0.06] px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--color-text-secondary)]">
                      {promo.discountType}
                    </span>
                    <span className="rounded-full bg-[rgba(125,211,252,0.12)] px-3 py-1 text-xs font-semibold text-[var(--color-brand)]">
                      {promo.discountType === "full"
                        ? "Waives full fee"
                        : `Value ${promo.discountValue}`}
                    </span>
                  </div>
                  <p className="text-sm text-[var(--color-text-secondary)]">
                    {promo.pitchOwnerName
                      ? `Scoped to ${promo.pitchOwnerName}`
                      : "Global promo code"}
                  </p>
                  <p className="text-xs text-[var(--color-text-muted)]">
                    Used {promo.usedCount}
                    {promo.maxUses != null ? ` / ${promo.maxUses}` : ""}
                    {" · "}Expires {new Date(promo.expiresAt).toLocaleString()}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant={promo.isActive ? "danger" : "secondary"}
                    size="sm"
                    onClick={() => void onTogglePromo(promo.id, !promo.isActive)}
                  >
                    {promo.isActive ? "Deactivate" : "Activate"}
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </AsyncPanelState>
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-white/[0.03] p-4">
      <p className="text-xs uppercase tracking-[0.18em] text-[var(--color-text-muted)]">
        {label}
      </p>
      <p className="mt-2 text-sm font-semibold text-[var(--color-text-primary)]">
        {value}
      </p>
    </div>
  );
}
