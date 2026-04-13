"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { AsyncPanelState } from "@/app/components/ui/async-panel-state";
import { Button } from "@/app/components/ui/button";
import { Card } from "@/app/components/ui/card";
import { Input } from "@/app/components/ui/input";
import { Select } from "@/app/components/ui/select";
import { browserApi } from "@/lib/browserApi";
import { getErrorMessage } from "@/lib/errorMessage";

type PayoutBank = {
  code: string;
  name: string;
};

type PayoutSettings = {
  businessName: string | null;
  accountName: string | null;
  accountNumberMasked: string | null;
  accountNumberLast4: string | null;
  bankCode: string | null;
  chapaSubaccountId: string | null;
  splitType: string | null;
  splitValue: number | null;
  payoutSetupVerifiedAt: string | null;
  payoutSetupComplete: boolean;
  payoutSetupIssue: string | null;
};

const EMPTY_FORM = {
  businessName: "",
  accountName: "",
  accountNumber: "",
  bankCode: "",
};

export function PayoutSettingsTab() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [banksLoading, setBanksLoading] = useState(false);
  const [banks, setBanks] = useState<PayoutBank[]>([]);
  const [payout, setPayout] = useState<PayoutSettings | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);

  const loadPayout = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await browserApi.get<{ payout?: PayoutSettings }>(
        "/api/profile/payout",
        { cache: "no-store" },
      );
      const nextPayout = data.payout ?? null;
      setPayout(nextPayout);
      setForm((current) => ({
        ...current,
        businessName: nextPayout?.businessName ?? "",
      }));
    } catch (loadError) {
      setError(getErrorMessage(loadError) || "Failed to load payout settings");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadBanks = useCallback(async () => {
    setBanksLoading(true);
    try {
      const data = await browserApi.get<{ banks?: PayoutBank[] }>(
        "/api/chapa/banks",
        { cache: "force-cache" },
      );
      setBanks(data.banks ?? []);
    } catch (loadError) {
      toast.error(getErrorMessage(loadError) || "Failed to load Chapa banks");
    } finally {
      setBanksLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadPayout();
  }, [loadPayout]);

  useEffect(() => {
    if (!showForm && payout?.payoutSetupComplete) return;
    if (banks.length > 0 || banksLoading) return;
    void loadBanks();
  }, [banks.length, banksLoading, loadBanks, payout?.payoutSetupComplete, showForm]);

  const bankLabel = useMemo(() => {
    if (!payout?.bankCode) return null;
    return (
      banks.find((bank) => bank.code === payout.bankCode)?.name ??
      `Bank code ${payout.bankCode}`
    );
  }, [banks, payout?.bankCode]);

  const handleChange = (
    event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>,
  ) => {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    try {
      const data = await browserApi.patch<{ payout?: PayoutSettings }>(
        "/api/profile/payout",
        form,
      );
      setPayout(data.payout ?? null);
      setShowForm(false);
      setForm((current) => ({
        ...EMPTY_FORM,
        businessName: data.payout?.businessName ?? current.businessName,
      }));
      toast.success("Payout details verified");
    } catch (saveError) {
      toast.error(getErrorMessage(saveError) || "Failed to verify payout details");
    } finally {
      setSaving(false);
    }
  };

  const isConfigured = Boolean(payout?.payoutSetupComplete);

  return (
    <section className="space-y-4 rounded-2xl border border-white/10 bg-[#0c1d2e]/80 p-4 sm:p-5">
      <div className="space-y-1">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--color-brand)]">
          Payouts
        </p>
        <h2 className="text-lg font-semibold text-white">Settlement details</h2>
        <p className="text-sm text-[var(--color-text-secondary)]">
          Complete Chapa payout verification before creating events or accepting ticket payments. Meda sends host payouts from its Chapa balance to this verified bank destination.
        </p>
      </div>

      <AsyncPanelState
        loading={loading}
        error={error}
        isEmpty={false}
        loadingFallback={<Card className="p-6 text-sm text-[var(--color-text-secondary)]">Loading payout settings...</Card>}
        emptyTitle=""
        emptyDescription=""
        onRetry={loadPayout}
      >
        {isConfigured && !showForm ? (
          <Card className="space-y-5 p-5 sm:p-6">
            <div className="space-y-2">
              <p className="text-sm font-semibold text-[var(--color-brand-alt)]">
                Payout setup verified
              </p>
              <p className="text-sm text-[var(--color-text-secondary)]">
                Your host payout destination is verified. Meda can now transfer your settled earnings from its Chapa balance to this destination.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-white/[0.03] p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-[var(--color-text-muted)]">
                  Business
                </p>
                <p className="mt-2 text-sm font-medium text-[var(--color-text-primary)]">
                  {payout?.businessName ?? "Not set"}
                </p>
              </div>
              <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-white/[0.03] p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-[var(--color-text-muted)]">
                  Account
                </p>
                <p className="mt-2 text-sm font-medium text-[var(--color-text-primary)]">
                  {payout?.accountNumberMasked ?? "Not set"}
                </p>
                <p className="mt-1 text-xs text-[var(--color-text-muted)]">
                  {bankLabel ?? "Bank pending"}
                </p>
              </div>
              <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-white/[0.03] p-4 sm:col-span-2">
                <p className="text-xs uppercase tracking-[0.18em] text-[var(--color-text-muted)]">
                  Chapa subaccount
                </p>
                <p className="mt-2 break-all text-sm font-medium text-[var(--color-text-primary)]">
                  {payout?.chapaSubaccountId}
                </p>
                <p className="mt-1 text-xs text-[var(--color-text-muted)]">
                  Verified {payout?.payoutSetupVerifiedAt ? new Date(payout.payoutSetupVerifiedAt).toLocaleString() : ""}
                </p>
              </div>
            </div>

            <Button
              type="button"
              variant="secondary"
              className="rounded-full"
              onClick={() => setShowForm(true)}
            >
              Update payout details
            </Button>
          </Card>
        ) : (
          <Card className="p-5 sm:p-6">
            <form className="space-y-4" onSubmit={handleSubmit}>
              {payout?.payoutSetupIssue ? (
                <div className="rounded-[var(--radius-md)] border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-[var(--color-text-primary)]">
                  {payout.payoutSetupIssue}
                </div>
              ) : null}

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="sm:col-span-2">
                  <span className="field-label">Business name</span>
                  <Input
                    name="businessName"
                    value={form.businessName}
                    onChange={handleChange}
                    placeholder="Your pitch or business name"
                  />
                </label>
                <label>
                  <span className="field-label">Account name</span>
                  <Input
                    name="accountName"
                    value={form.accountName}
                    onChange={handleChange}
                    placeholder="Account holder name"
                    required
                  />
                </label>
                <label>
                  <span className="field-label">Account number</span>
                  <Input
                    name="accountNumber"
                    value={form.accountNumber}
                    onChange={handleChange}
                    placeholder="0123456789"
                    required
                  />
                </label>
                <label className="sm:col-span-2">
                  <span className="field-label">Bank</span>
                  <Select
                    name="bankCode"
                    value={form.bankCode}
                    onChange={handleChange}
                    required
                  >
                    <option value="">{banksLoading ? "Loading banks..." : "Select your bank"}</option>
                    {banks.map((bank) => (
                      <option key={bank.code} value={bank.code}>
                        {bank.name}
                      </option>
                    ))}
                  </Select>
                </label>
              </div>

              <div className="flex flex-wrap gap-3">
                <Button
                  type="submit"
                  disabled={saving || banksLoading}
                  className="rounded-full"
                >
                  {saving ? "Verifying..." : "Save & verify payout"}
                </Button>
                {isConfigured ? (
                  <Button
                    type="button"
                    variant="secondary"
                    className="rounded-full"
                    onClick={() => setShowForm(false)}
                  >
                    Cancel
                  </Button>
                ) : null}
              </div>
            </form>
          </Card>
        )}
      </AsyncPanelState>
    </section>
  );
}
