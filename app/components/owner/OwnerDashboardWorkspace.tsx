"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/app/components/ui/badge";
import { Button } from "@/app/components/ui/button";
import { Card } from "@/app/components/ui/card";
import { cn } from "@/app/components/ui/cn";
import { Input } from "@/app/components/ui/input";
import { ResponsiveTableCard } from "@/app/components/ui/responsive-table-card";
import { Select } from "@/app/components/ui/select";
import { Table } from "@/app/components/ui/table";
import { HostEmptyState } from "@/app/components/host/HostEmptyState";
import { HostMetricTile } from "@/app/components/host/HostMetricTile";
import { HostPanelLoading } from "@/app/components/host/HostPanelLoading";
import { HostSectionHeader } from "@/app/components/host/HostSectionHeader";
import { HostWorkbenchTableSection } from "@/app/components/host/HostWorkbenchTableSection";
import {
  HOST_MASTER_DETAIL_GRID,
  HOST_TABLE_CELL_CLASS,
  HOST_TABLE_HEAD_CLASS,
  HOST_TABLE_ROW_DIVIDER_CLASS,
  HOST_WORKBENCH_TIMELINE_ENTRY_CLASS,
} from "@/app/components/host/hostWorkbenchChrome";
import { HostWorkbenchListDetailBody } from "@/app/components/host/HostWorkbenchListDetailBody";
import {
  HOST_METRIC_GRID_DENSE,
  HOST_METRIC_GRID_THREE,
  HOST_METRIC_PAIR_GRID,
} from "@/app/components/host/hostSurfaceGrids";
import { OwnerDashboardBookingsTablePanel } from "@/app/components/owner/OwnerDashboardBookingsTablePanel";
import { OwnerDashboardCsvExportCard } from "@/app/components/owner/OwnerDashboardCsvExportCard";
import { OwnerDashboardFilterTabsCard } from "@/app/components/owner/OwnerDashboardFilterTabsCard";
import {
  CustomerRowCard,
  PaymentRowCard,
  UtilizationSlotCard,
} from "@/app/components/owner/OwnerDashboardMobileRowCards";
import type {
  BookingRow,
  CustomerRow,
  OwnerDashboardPitchOption,
  OwnerDashboardTab,
  PaymentRow,
  Utilization,
} from "@/app/components/owner/ownerDashboardWorkspaceTypes";
import { browserApi } from "@/lib/browserApi";
import { getErrorMessage } from "@/lib/errorMessage";
import { getCustomerProfileDetailHeaderCopy } from "@/lib/hostSplitPaneCopy";
import {
  buildOwnerDashboardQueryString as buildQueryString,
  formatOwnerDashboardCurrency as formatCurrency,
  ownerDashboardDateInputFromDate as toDateInput,
} from "@/lib/ownerDashboardQuery";
import { buildOwnerOverviewMetricTiles } from "@/lib/ownerOverviewDashboardMetrics";
import {
  getOwnerSubscriptionDaysLeftMetricDetail,
  getOwnerSubscriptionDaysLeftValue,
  getOwnerSubscriptionPlanMetricDetail,
  getOwnerSubscriptionStatusMetricDetail,
} from "@/lib/ownerSubscriptionDashboardCopy";
import { shouldClearStaleListSelection } from "@/lib/reconcileHostSelection";
import { uiCopy } from "@/lib/uiCopy";

type OwnerSubscriptionSummary = {
  id: string;
  status: string;
  planCode: string;
  endsAt: string;
  renewalAt: string | null;
  entitlementActive: boolean;
  daysRemaining: number;
  graceEndsAt: string | null;
  gracePeriodActive: boolean;
  graceDaysRemaining: number;
  feeAmountEtb: number;
} | null;

type SubscriptionActionResponse = {
  subscription: OwnerSubscriptionSummary;
  checkoutUrl?: string | null;
};

type Overview = {
  revenueTotalEtb: number;
  refundedAmountEtb: number;
  bookingsTotal: number;
  bookingsConfirmed: number;
  activeSlotCount: number;
  utilization: number;
  dailySalesCount: number;
  monthlySalesCount: number;
  expiredPools: number;
  partyCompletion: number;
  assignedTicketCount: number;
  unassignedTicketCount: number;
  checkedInTicketCount: number;
  monthlyPassCustomers: number;
  subscription: OwnerSubscriptionSummary;
};

type OwnerPayoutRow = {
  id: string;
  ownerId: string;
  amountEtb: number;
  currency: string;
  reference: string;
  providerTransferId: string | null;
  status: string;
  destinationBusinessName: string | null;
  destinationAccountLast4: string | null;
  destinationBankCode: string | null;
  failureReason: string | null;
  initiatedByUserId: string | null;
  paidAt: string | null;
  createdAt: string;
  updatedAt: string;
};

type OwnerPayoutSummary = {
  ownerId: string;
  businessName: string | null;
  payoutReady: boolean;
  payoutSetupIssue: string | null;
  destinationLabel: string | null;
  destinationBankCode: string | null;
  currentBalanceEtb: number;
  grossTicketSalesEtb: number;
  platformCommissionEtb: number;
  ticketSurchargeEtb: number;
  netOwnerRevenueEtb: number;
  totalPaidOutEtb: number;
  totalPendingPayoutEtb: number;
  availablePayoutEtb: number;
  recentPayouts: OwnerPayoutRow[];
};

type OwnerDashboardWorkspaceProps = {
  initialTab?: OwnerDashboardTab;
};

export function OwnerDashboardWorkspace({
  initialTab = "overview",
}: OwnerDashboardWorkspaceProps = {}) {
  const router = useRouter();
  const [tab, setTab] = useState<OwnerDashboardTab>(initialTab);
  const [fromDate, setFromDate] = useState(() =>
    toDateInput(new Date(new Date().getFullYear(), new Date().getMonth(), 1)),
  );
  const [toDate, setToDate] = useState(() => toDateInput(new Date()));
  const [selectedPitchId, setSelectedPitchId] = useState("");
  const [pitches, setPitches] = useState<OwnerDashboardPitchOption[]>([]);
  const [overview, setOverview] = useState<Overview | null>(null);
  const [subscription, setSubscription] = useState<OwnerSubscriptionSummary>(null);
  const [bookings, setBookings] = useState<BookingRow[]>([]);
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [customers, setCustomers] = useState<CustomerRow[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>("");
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerRow | null>(null);
  const [utilization, setUtilization] = useState<Utilization | null>(null);
  const [payoutSummary, setPayoutSummary] = useState<OwnerPayoutSummary | null>(null);
  const [payoutCommissionPercent, setPayoutCommissionPercent] = useState(0);
  const [payoutTicketSurchargeEtb, setPayoutTicketSurchargeEtb] = useState(15);
  const [payoutAmountDraft, setPayoutAmountDraft] = useState("");
  const [payoutPending, setPayoutPending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [subscriptionPending, setSubscriptionPending] = useState(false);
  const [subscriptionPaymentMethod, setSubscriptionPaymentMethod] = useState<"balance" | "chapa">(
    "balance",
  );
  const [refreshToken, setRefreshToken] = useState(0);

  const filterQuery = useMemo(
    () => buildQueryString({ from: fromDate, to: toDate, pitchId: selectedPitchId }),
    [fromDate, selectedPitchId, toDate],
  );

  useEffect(() => {
    setTab(initialTab);
  }, [initialTab]);

  useEffect(() => {
    if (
      shouldClearStaleListSelection(
        selectedCustomerId,
        customers.map((c) => c.customerId),
      )
    ) {
      setSelectedCustomerId("");
    }
  }, [customers, selectedCustomerId]);

  useEffect(() => {
    if (
      shouldClearStaleListSelection(
        selectedPitchId,
        pitches.map((p) => p.id),
      )
    ) {
      setSelectedPitchId("");
    }
  }, [pitches, selectedPitchId]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      try {
        const [
          pitchResponse,
          overviewResponse,
          bookingsResponse,
          paymentsResponse,
          customersResponse,
          utilizationResponse,
          subscriptionResponse,
          payoutResponse,
        ] = await Promise.all([
          browserApi.get<{ pitches?: OwnerDashboardPitchOption[] }>("/api/pitches", {
            cache: "no-store",
          }),
          browserApi.get<{ overview?: Overview }>(`/api/owner/dashboard/overview?${filterQuery}`, {
            cache: "no-store",
          }),
          browserApi.get<{ bookings?: BookingRow[] }>(
            `/api/owner/dashboard/bookings?${filterQuery}`,
            { cache: "no-store" },
          ),
          browserApi.get<{ payments?: PaymentRow[] }>(
            `/api/owner/dashboard/payments?${filterQuery}`,
            { cache: "no-store" },
          ),
          browserApi.get<{ customers?: CustomerRow[] }>(
            `/api/owner/dashboard/customers?${filterQuery}`,
            { cache: "no-store" },
          ),
          browserApi.get<{ utilization?: Utilization }>(
            `/api/owner/dashboard/utilization?${filterQuery}`,
            { cache: "no-store" },
          ),
          browserApi.get<{ subscription?: OwnerSubscriptionSummary }>(
            "/api/owner/dashboard/subscription",
            { cache: "no-store" },
          ),
          browserApi.get<{
            summary?: OwnerPayoutSummary;
            commissionPercent?: number;
            ticketSurchargeEtb?: number;
          }>("/api/owner/payouts", { cache: "no-store" }),
        ]);

        if (cancelled) return;

        setPitches(pitchResponse.pitches ?? []);
        setOverview(overviewResponse.overview ?? null);
        setSubscription(
          subscriptionResponse.subscription ?? overviewResponse.overview?.subscription ?? null,
        );
        setBookings(bookingsResponse.bookings ?? []);
        setPayments(paymentsResponse.payments ?? []);
        setCustomers(customersResponse.customers ?? []);
        setUtilization(utilizationResponse.utilization ?? null);
        setPayoutSummary(payoutResponse.summary ?? null);
        setPayoutCommissionPercent(payoutResponse.commissionPercent ?? 0);
        setPayoutTicketSurchargeEtb(payoutResponse.ticketSurchargeEtb ?? 15);
      } catch (error) {
        if (!cancelled) {
          toast.error(getErrorMessage(error) || "Failed to load owner dashboard");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [filterQuery, refreshToken]);

  useEffect(() => {
    let cancelled = false;

    async function loadCustomer() {
      if (!selectedCustomerId) {
        setSelectedCustomer(null);
        return;
      }

      try {
        const query = buildQueryString({
          from: fromDate,
          to: toDate,
          pitchId: selectedPitchId,
          customerId: selectedCustomerId,
        });
        const response = await browserApi.get<{ customers?: CustomerRow | null }>(
          `/api/owner/dashboard/customers?${query}`,
          { cache: "no-store" },
        );
        if (!cancelled) {
          setSelectedCustomer((response.customers as CustomerRow | null) ?? null);
        }
      } catch (error) {
        if (!cancelled) {
          toast.error(getErrorMessage(error) || "Failed to load customer detail");
        }
      }
    }

    void loadCustomer();
    return () => {
      cancelled = true;
    };
  }, [fromDate, refreshToken, selectedCustomerId, selectedPitchId, toDate]);

  const exportLinks = {
    bookings: `/api/owner/dashboard/exports/bookings.csv?${filterQuery}`,
    payments: `/api/owner/dashboard/exports/payments.csv?${filterQuery}`,
    attendees: `/api/owner/dashboard/exports/attendees.csv?${filterQuery}`,
  };

  const poolBookings = useMemo(() => bookings.filter((booking) => booking.poolStatus), [bookings]);

  const overviewMetricTiles = useMemo(
    () => buildOwnerOverviewMetricTiles(overview, utilization, uiCopy.host.hostPlan),
    [overview, utilization],
  );

  async function handleSubscriptionAction(action: "start" | "renew" | "cancel") {
    setSubscriptionPending(true);
    try {
      const payload =
        action === "cancel"
          ? await browserApi.post<SubscriptionActionResponse>("/api/pitch-subscriptions/cancel")
          : await browserApi.post<SubscriptionActionResponse>(
              `/api/pitch-subscriptions/${action}`,
              {
                pitchId: selectedPitchId || undefined,
                paymentMethod: subscriptionPaymentMethod,
              },
            );

      if (payload.checkoutUrl) {
        window.location.assign(payload.checkoutUrl);
        return;
      }

      setSubscription(payload.subscription);
      setOverview((current) =>
        current ? { ...current, subscription: payload.subscription } : current,
      );
      router.refresh();
      toast.success(
        action === "start"
          ? "Subscription activated"
          : action === "renew"
            ? "Subscription renewed"
            : "Subscription cancelled",
      );
    } catch (error) {
      toast.error(getErrorMessage(error) || "Failed to update subscription");
    } finally {
      setSubscriptionPending(false);
    }
  }

  async function handleCreatePayout() {
    setPayoutPending(true);
    try {
      const normalizedDraft = payoutAmountDraft.trim();
      await browserApi.post<{ payout: OwnerPayoutRow }>("/api/owner/payouts", {
        ...(normalizedDraft ? { amountEtb: normalizedDraft } : {}),
      });
      setPayoutAmountDraft("");
      setRefreshToken((current) => current + 1);
      router.refresh();
      toast.success("Payout started. Chapa is now processing your transfer.");
    } catch (error) {
      toast.error(getErrorMessage(error) || "Failed to create payout");
    } finally {
      setPayoutPending(false);
    }
  }

  return (
    <div className="space-y-6">
      <OwnerDashboardFilterTabsCard
        fromDate={fromDate}
        toDate={toDate}
        selectedPitchId={selectedPitchId}
        onFromDateChange={setFromDate}
        onToDateChange={setToDate}
        onPitchChange={setSelectedPitchId}
        pitches={pitches}
        tab={tab}
        onSelectTab={setTab}
      />

      {loading ? <HostPanelLoading message="Loading host reports…" /> : null}

      {!loading && tab === "overview" ? (
        <div className={HOST_METRIC_GRID_DENSE}>
          {overviewMetricTiles.map((tile) => (
            <HostMetricTile
              key={tile.label}
              label={tile.label}
              value={tile.value}
              detail={tile.detail}
            />
          ))}
        </div>
      ) : null}

      {!loading && tab === "bookings" ? (
        <OwnerDashboardBookingsTablePanel bookings={bookings} />
      ) : null}

      {!loading && tab === "payments" ? (
        <div className="space-y-4">
          <Card className="space-y-5 p-5 sm:p-6">
            <HostSectionHeader
              kicker="Host payout"
              title="Send your settled earnings to your verified bank account."
              description={
                <>
                  Money moves from Meda&apos;s Chapa balance to your verified payout destination.
                  This is not a direct wallet-to-wallet Chapa send.
                </>
              }
            />

            <div className={HOST_METRIC_GRID_DENSE}>
              <HostMetricTile
                label="Ready now"
                value={formatCurrency(payoutSummary?.availablePayoutEtb ?? 0)}
                detail={`Based on your current Meda balance of ${formatCurrency(
                  payoutSummary?.currentBalanceEtb ?? 0,
                )}.`}
              />
              <HostMetricTile
                label="Already sent"
                value={formatCurrency(payoutSummary?.totalPaidOutEtb ?? 0)}
                detail="Completed payouts to your verified destination."
              />
              <HostMetricTile
                label="Still processing"
                value={formatCurrency(payoutSummary?.totalPendingPayoutEtb ?? 0)}
                detail="Payouts that Chapa is still reviewing or sending."
              />
              <HostMetricTile
                label="You earned"
                value={formatCurrency(payoutSummary?.netOwnerRevenueEtb ?? 0)}
                detail="Your host share after fees."
              />
            </div>

            <div className="grid gap-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(280px,0.85fr)]">
              <div className="space-y-4 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-control-bg)] p-4">
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-[var(--color-text-primary)]">
                    Exact money breakdown
                  </p>
                  <p className="text-sm text-[var(--color-text-secondary)]">
                    Attendee payments are split before your payout becomes available.
                  </p>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-text-muted)]">
                      Player ticket sales
                    </p>
                    <p className="mt-2 text-lg font-semibold text-[var(--color-text-primary)]">
                      {formatCurrency(payoutSummary?.grossTicketSalesEtb ?? 0)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-text-muted)]">
                      Meda commission
                    </p>
                    <p className="mt-2 text-lg font-semibold text-[var(--color-text-primary)]">
                      {formatCurrency(payoutSummary?.platformCommissionEtb ?? 0)}
                    </p>
                    <p className="text-xs text-[var(--color-text-muted)]">
                      {(payoutCommissionPercent * 100).toFixed(0)}% of the ticket price
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-text-muted)]">
                      Meda ticket fee
                    </p>
                    <p className="mt-2 text-lg font-semibold text-[var(--color-text-primary)]">
                      {formatCurrency(payoutSummary?.ticketSurchargeEtb ?? 0)}
                    </p>
                    <p className="text-xs text-[var(--color-text-muted)]">
                      {formatCurrency(payoutTicketSurchargeEtb)} per paid ticket stays with Meda
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-text-muted)]">
                      Current Meda balance
                    </p>
                    <p className="mt-2 text-lg font-semibold text-[var(--color-text-primary)]">
                      {formatCurrency(payoutSummary?.currentBalanceEtb ?? 0)}
                    </p>
                    <p className="text-xs text-[var(--color-text-muted)]">
                      Spending from your Meda balance lowers what can be paid out.
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-text-muted)]">
                      Verified destination
                    </p>
                    <p className="mt-2 text-sm font-medium leading-6 text-[var(--color-text-primary)]">
                      {payoutSummary?.destinationLabel ??
                        payoutSummary?.payoutSetupIssue ??
                        "Set up your payout destination in profile first."}
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-4 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-control-bg)] p-4">
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-[var(--color-text-primary)]">
                    Send payout
                  </p>
                  <p className="text-sm text-[var(--color-text-secondary)]">
                    Leave the box empty to send the full available amount.
                  </p>
                </div>

                <label className="block">
                  <span className="field-label">Amount to send (ETB)</span>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={payoutAmountDraft}
                    onChange={(event) => setPayoutAmountDraft(event.target.value)}
                    placeholder={
                      payoutSummary ? payoutSummary.availablePayoutEtb.toFixed(2) : "0.00"
                    }
                    disabled={payoutPending}
                  />
                </label>

                <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-black/10 px-4 py-3 text-sm leading-6 text-[var(--color-text-secondary)]">
                  <p>
                    Available now:{" "}
                    <span className="font-semibold text-[var(--color-text-primary)]">
                      {formatCurrency(payoutSummary?.availablePayoutEtb ?? 0)}
                    </span>
                  </p>
                  <p>
                    This number is capped by your real Meda balance, not just your lifetime host
                    earnings.
                  </p>
                  <p>
                    If Chapa accepts the transfer, the money goes to your verified bank destination.
                  </p>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() =>
                      setPayoutAmountDraft(
                        payoutSummary ? payoutSummary.availablePayoutEtb.toFixed(2) : "",
                      )
                    }
                    disabled={
                      payoutPending || !payoutSummary || payoutSummary.availablePayoutEtb <= 0
                    }
                  >
                    Use full amount
                  </Button>
                  <Button
                    type="button"
                    variant="primary"
                    onClick={() => void handleCreatePayout()}
                    disabled={
                      payoutPending ||
                      !payoutSummary?.payoutReady ||
                      payoutSummary.availablePayoutEtb <= 0
                    }
                  >
                    {payoutPending ? "Sending..." : "Send payout"}
                  </Button>
                </div>

                {!payoutSummary?.payoutReady ? (
                  <div className="space-y-3 rounded-[var(--radius-md)] border border-amber-500/30 bg-amber-500/10 px-4 py-3">
                    <p className="text-sm text-[var(--color-text-primary)]">
                      {payoutSummary?.payoutSetupIssue ??
                        "Add and verify your payout destination in profile before sending money out."}
                    </p>
                    <Button type="button" variant="ghost" onClick={() => router.push("/profile")}>
                      Open payout settings
                    </Button>
                  </div>
                ) : null}
              </div>
            </div>

            <div className="space-y-3">
              <p className="text-sm font-semibold text-[var(--color-text-primary)]">
                Recent payouts
              </p>
              {payoutSummary?.recentPayouts?.length ? (
                <div className="grid gap-3">
                  {payoutSummary.recentPayouts.map((payout) => (
                    <div
                      key={payout.id}
                      className="rounded-[var(--radius-md)] border border-[var(--color-border)] px-4 py-3"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="font-semibold text-[var(--color-text-primary)]">
                          {formatCurrency(payout.amountEtb)} • {payout.status}
                        </p>
                        <p className="text-xs text-[var(--color-text-muted)]">
                          {new Date(payout.createdAt).toLocaleString()}
                        </p>
                      </div>
                      <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
                        {payout.reference}
                      </p>
                      <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
                        {payout.failureReason ?? payout.destinationBusinessName ?? "Processing"}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <HostEmptyState
                  className="py-4 text-left"
                  message="No payouts sent yet. Completed transfers will appear here."
                />
              )}
            </div>
          </Card>

          <HostWorkbenchTableSection
            empty={payments.length === 0}
            emptyMessage="No payments in this date range."
          >
            <ResponsiveTableCard
              table={
                <Table>
                  <thead>
                    <tr>
                      <th className={HOST_TABLE_HEAD_CLASS}>Type</th>
                      <th className={HOST_TABLE_HEAD_CLASS}>Reference</th>
                      <th className={HOST_TABLE_HEAD_CLASS}>Status</th>
                      <th className={HOST_TABLE_HEAD_CLASS}>Amount</th>
                      <th className={HOST_TABLE_HEAD_CLASS}>Paid at</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payments.map((payment) => (
                      <tr
                        key={`${payment.type}-${payment.id}`}
                        className={HOST_TABLE_ROW_DIVIDER_CLASS}
                      >
                        <td className={HOST_TABLE_CELL_CLASS}>{payment.type}</td>
                        <td className={HOST_TABLE_CELL_CLASS}>{payment.pitchName ?? "-"}</td>
                        <td className={HOST_TABLE_CELL_CLASS}>{payment.status}</td>
                        <td
                          className={cn(
                            HOST_TABLE_CELL_CLASS,
                            "font-semibold text-[var(--color-text-primary)]",
                          )}
                        >
                          {formatCurrency(payment.amount)}
                        </td>
                        <td className={HOST_TABLE_CELL_CLASS}>
                          {payment.paidAt ? new Date(payment.paidAt).toLocaleString() : "-"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              }
              mobileCards={payments.map((payment) => (
                <PaymentRowCard key={`${payment.type}-${payment.id}`} payment={payment} />
              ))}
            />
          </HostWorkbenchTableSection>
        </div>
      ) : null}

      {!loading && tab === "pool_payments" ? (
        <div className="grid gap-4">
          {poolBookings.length === 0 ? (
            <HostEmptyState variant="panel" message="No group payments in this date range." />
          ) : (
            poolBookings.map((booking) => (
              <Card key={booking.id} className="space-y-4 p-5 sm:p-6">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div className="space-y-2">
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="accent">{booking.productType}</Badge>
                      <Badge variant="default">{booking.poolStatus ?? "NO_POOL"}</Badge>
                      {booking.partyStatus ? (
                        <Badge variant="default">{booking.partyStatus}</Badge>
                      ) : null}
                    </div>
                    <h3 className="text-lg font-semibold text-[var(--color-text-primary)]">
                      {booking.pitchName}
                    </h3>
                    <p className="text-sm text-[var(--color-text-secondary)]">
                      {booking.partyName ?? "Unnamed group"} with {booking.partyMemberCount} member
                      {booking.partyMemberCount === 1 ? "" : "s"}
                    </p>
                    <p className="text-sm text-[var(--color-text-secondary)]">
                      {new Date(booking.startsAt).toLocaleString()}
                    </p>
                  </div>

                  <div className="grid gap-2 text-sm text-[var(--color-text-secondary)]">
                    <p>
                      Paid {formatCurrency(booking.poolAmountPaid ?? 0)} /{" "}
                      {formatCurrency(booking.poolTotalAmount ?? 0)}
                    </p>
                    <p>Outstanding {formatCurrency(booking.poolOutstandingAmount ?? 0)}</p>
                    <p>
                      Deadline{" "}
                      {booking.poolExpiresAt
                        ? new Date(booking.poolExpiresAt).toLocaleString()
                        : "-"}
                    </p>
                  </div>
                </div>
              </Card>
            ))
          )}
        </div>
      ) : null}

      {!loading && tab === "customers" ? (
        <div className={HOST_MASTER_DETAIL_GRID}>
          <HostWorkbenchTableSection
            empty={customers.length === 0}
            emptyMessage="No customers in this date range."
          >
            <ResponsiveTableCard
              table={
                <Table>
                  <thead>
                    <tr>
                      <th className={HOST_TABLE_HEAD_CLASS}>Customer</th>
                      <th className={HOST_TABLE_HEAD_CLASS}>Bookings</th>
                      <th className={HOST_TABLE_HEAD_CLASS}>Assigned</th>
                      <th className={HOST_TABLE_HEAD_CLASS}>Checked in</th>
                      <th className={HOST_TABLE_HEAD_CLASS}>Paid</th>
                    </tr>
                  </thead>
                  <tbody>
                    {customers.map((customer) => (
                      <tr
                        key={customer.customerId}
                        className={cn(
                          HOST_TABLE_ROW_DIVIDER_CLASS,
                          "cursor-pointer hover:bg-white/[0.03]",
                        )}
                        onClick={() => setSelectedCustomerId(customer.customerId)}
                      >
                        <td className={HOST_TABLE_CELL_CLASS}>
                          <div className="space-y-1">
                            <p className="font-semibold text-[var(--color-text-primary)]">
                              {customer.customerName}
                            </p>
                            <p className="text-xs text-[var(--color-text-muted)]">
                              {customer.customerEmail ?? "No email"}
                            </p>
                          </div>
                        </td>
                        <td className={HOST_TABLE_CELL_CLASS}>{customer.bookings}</td>
                        <td className={HOST_TABLE_CELL_CLASS}>{customer.ticketsAssigned}</td>
                        <td className={HOST_TABLE_CELL_CLASS}>{customer.ticketsCheckedIn}</td>
                        <td
                          className={cn(
                            HOST_TABLE_CELL_CLASS,
                            "font-semibold text-[var(--color-text-primary)]",
                          )}
                        >
                          {formatCurrency(customer.totalPaidEtb)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              }
              mobileCards={customers.map((customer) => (
                <CustomerRowCard
                  key={customer.customerId}
                  customer={customer}
                  onSelect={() => setSelectedCustomerId(customer.customerId)}
                />
              ))}
            />
          </HostWorkbenchTableSection>

          <Card className="space-y-4 p-5 sm:p-6">
            <HostSectionHeader
              kicker="Customer profile"
              {...getCustomerProfileDetailHeaderCopy({
                listEmpty: customers.length === 0,
                selectedCustomer,
              })}
            />

            <HostWorkbenchListDetailBody
              listEmpty={customers.length === 0}
              idleMessage="Select a row in the list to load full payment and attendance history for that person."
              hasDetail={Boolean(selectedCustomer)}
            >
              {selectedCustomer ? (
                <div className="space-y-4">
                  <div className={HOST_METRIC_PAIR_GRID}>
                    <HostMetricTile
                      label="Bookings"
                      value={String(selectedCustomer.bookings)}
                      detail={`${selectedCustomer.monthlyPassUsage} monthly pass usages`}
                    />
                    <HostMetricTile
                      label="Paid"
                      value={formatCurrency(selectedCustomer.totalPaidEtb)}
                      detail={`${selectedCustomer.ticketsCheckedIn} check-ins`}
                    />
                  </div>

                  <div className="space-y-3">
                    {selectedCustomer.history.map((entry) => (
                      <div
                        key={`${entry.sourceType}:${entry.referenceId}`}
                        className={HOST_WORKBENCH_TIMELINE_ENTRY_CLASS}
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant={entry.sourceType === "SLOT" ? "accent" : "default"}>
                            {entry.sourceType}
                          </Badge>
                          <p className="font-semibold text-[var(--color-text-primary)]">
                            {entry.title}
                          </p>
                        </div>
                        <p className="text-xs text-[var(--color-text-muted)]">
                          {new Date(entry.startsAt).toLocaleString()}
                        </p>
                        <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
                          {entry.assignedCount} assigned, {entry.checkedInCount} checked in,{" "}
                          {formatCurrency(entry.amountEtb)}
                        </p>
                        {entry.refundAmountEtb > 0 ? (
                          <p className="text-sm text-[var(--color-text-secondary)]">
                            Refunded {formatCurrency(entry.refundAmountEtb)}
                          </p>
                        ) : null}
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </HostWorkbenchListDetailBody>
          </Card>
        </div>
      ) : null}

      {!loading && tab === "slots" ? (
        <HostWorkbenchTableSection
          empty={(utilization?.slots ?? []).length === 0}
          emptyMessage="No booking times in this date range."
          footer={
            <p className="text-sm text-[var(--color-text-secondary)]">
              Calendar-backed create, edit, and block actions are available in the owner operations
              section below.
            </p>
          }
        >
          <ResponsiveTableCard
            table={
              <Table>
                <thead>
                  <tr>
                    <th className={HOST_TABLE_HEAD_CLASS}>Pitch</th>
                    <th className={HOST_TABLE_HEAD_CLASS}>When</th>
                    <th className={HOST_TABLE_HEAD_CLASS}>Status</th>
                    <th className={HOST_TABLE_HEAD_CLASS}>Inventory</th>
                    <th className={HOST_TABLE_HEAD_CLASS}>Utilization</th>
                    <th className={HOST_TABLE_HEAD_CLASS}>Revenue</th>
                  </tr>
                </thead>
                <tbody>
                  {(utilization?.slots ?? []).map((slot) => (
                    <tr key={slot.id} className={HOST_TABLE_ROW_DIVIDER_CLASS}>
                      <td className={HOST_TABLE_CELL_CLASS}>{slot.pitchName}</td>
                      <td className={HOST_TABLE_CELL_CLASS}>
                        {new Date(slot.startsAt).toLocaleString()}
                      </td>
                      <td className={HOST_TABLE_CELL_CLASS}>
                        <div className="flex flex-wrap gap-2">
                          <Badge variant="default">{slot.status}</Badge>
                          <Badge variant="accent">{slot.productType}</Badge>
                        </div>
                      </td>
                      <td className={HOST_TABLE_CELL_CLASS}>
                        {slot.soldQuantity}/{slot.capacity} sold, {slot.remainingCapacity} left
                      </td>
                      <td className={HOST_TABLE_CELL_CLASS}>
                        {Math.round(slot.utilization * 100)}%
                      </td>
                      <td
                        className={cn(
                          HOST_TABLE_CELL_CLASS,
                          "font-semibold text-[var(--color-text-primary)]",
                        )}
                      >
                        {formatCurrency(slot.revenueSummaryEtb)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            }
            mobileCards={(utilization?.slots ?? []).map((slot) => (
              <UtilizationSlotCard key={slot.id} slot={slot} />
            ))}
          />
        </HostWorkbenchTableSection>
      ) : null}

      {!loading && tab === "subscription" ? (
        <Card className="space-y-5 p-5 sm:p-6">
          <HostSectionHeader
            kicker="Subscription"
            title="Pitch inventory entitlement"
            description="Monthly subscription status controls whether owners can keep publishing and managing slot inventory."
          />

          <div className={HOST_METRIC_GRID_THREE}>
            <HostMetricTile
              label="Status"
              value={subscription?.status ?? "NONE"}
              detail={getOwnerSubscriptionStatusMetricDetail(subscription ?? undefined)}
            />
            <HostMetricTile
              label="Plan"
              value={subscription?.planCode ?? "N/A"}
              detail={getOwnerSubscriptionPlanMetricDetail(subscription ?? undefined)}
            />
            <HostMetricTile
              label="Days left"
              value={String(getOwnerSubscriptionDaysLeftValue(subscription ?? undefined))}
              detail={getOwnerSubscriptionDaysLeftMetricDetail(subscription ?? undefined)}
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_220px] sm:items-end">
            <label className="block">
              <span className="field-label">Payment method</span>
              <Select
                value={subscriptionPaymentMethod}
                onChange={(event) =>
                  setSubscriptionPaymentMethod(event.target.value as "balance" | "chapa")
                }
                disabled={subscriptionPending}
              >
                <option value="balance">Use my Meda balance</option>
                <option value="chapa">Pay with Chapa</option>
              </Select>
            </label>
            <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-control-bg)] px-4 py-3 text-sm leading-6 text-[var(--color-text-secondary)]">
              Fee: {formatCurrency(subscription?.feeAmountEtb ?? 1500)} every 30 days. If you renew
              late, you still get 15 days of grace.
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <Button
              type="button"
              variant="primary"
              onClick={() => void handleSubscriptionAction("start")}
              disabled={subscriptionPending || Boolean(subscription?.entitlementActive)}
            >
              {subscriptionPending ? "Processing..." : "Start"}
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => void handleSubscriptionAction("renew")}
              disabled={subscriptionPending}
            >
              {subscriptionPending ? "Processing..." : "Renew"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => void handleSubscriptionAction("cancel")}
              disabled={subscriptionPending || !subscription}
            >
              {subscriptionPending ? "Processing..." : "Cancel"}
            </Button>
          </div>
        </Card>
      ) : null}

      {!loading && tab === "exports" ? (
        <OwnerDashboardCsvExportCard exportLinks={exportLinks} />
      ) : null}
    </div>
  );
}
