"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/app/components/ui/badge";
import { Button } from "@/app/components/ui/button";
import { Card } from "@/app/components/ui/card";
import { Input } from "@/app/components/ui/input";
import { ResponsiveTableCard } from "@/app/components/ui/responsive-table-card";
import { Select } from "@/app/components/ui/select";
import { Table } from "@/app/components/ui/table";
import { browserApi } from "@/lib/browserApi";
import { getErrorMessage } from "@/lib/errorMessage";
import { uiCopy } from "@/lib/uiCopy";

type PitchSummary = {
  id: string;
  name: string;
};

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

type BookingRow = {
  id: string;
  status: string;
  productType: string;
  pitchName: string;
  startsAt: string;
  quantity: number;
  totalAmount: number;
  customerName: string;
  partyName: string | null;
  partyStatus: string | null;
  partyMemberCount: number;
  poolStatus: string | null;
  poolAmountPaid: number | null;
  poolTotalAmount: number | null;
  poolOutstandingAmount: number | null;
  poolExpiresAt: string | null;
  soldTickets: number;
  assignedTickets: number;
  checkedInTickets: number;
};

type PaymentRow = {
  type: string;
  id: string;
  bookingId: string | null;
  pitchName: string | null;
  productType: string | null;
  amount: number;
  status: string;
  paidAt: string | null;
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

type CustomerRow = {
  customerId: string;
  customerName: string;
  customerEmail: string | null;
  bookings: number;
  ticketsAssigned: number;
  ticketsCheckedIn: number;
  totalPaidEtb: number;
  monthlyPassUsage: number;
  history: Array<{
    referenceId: string;
    sourceType: "SLOT" | "EVENT";
    title: string;
    startsAt: string;
    amountEtb: number;
    checkedInCount: number;
    assignedCount: number;
    refundAmountEtb: number;
  }>;
};

type Utilization = {
  totals: {
    slotCount: number;
    bookingCount: number;
    utilization: number;
    revenueTotalEtb: number;
  };
  slots: Array<{
    id: string;
    pitchName: string;
    startsAt: string;
    endsAt: string;
    status: string;
    capacity: number;
    soldQuantity: number;
    remainingCapacity: number;
    bookingCount: number;
    utilization: number;
    revenueSummaryEtb: number;
    productType: string;
  }>;
};

type DashboardTab =
  | "overview"
  | "bookings"
  | "payments"
  | "pool_payments"
  | "customers"
  | "slots"
  | "subscription"
  | "exports";

const dashboardTabLabels: Record<DashboardTab, string> = {
  overview: "Overview",
  bookings: "Bookings",
  payments: "Money",
  pool_payments: uiCopy.host.groupPayment,
  customers: uiCopy.host.people,
  slots: "Calendar",
  subscription: "Settings",
  exports: "Exports",
};

function formatCurrency(value: number, currency = "ETB") {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(value);
}

function toDateInput(date: Date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

function buildQueryString(filters: {
  from: string;
  to: string;
  pitchId: string;
  customerId?: string;
}) {
  const params = new URLSearchParams();
  if (filters.from) params.set("from", new Date(`${filters.from}T00:00:00`).toISOString());
  if (filters.to) params.set("to", new Date(`${filters.to}T23:59:59`).toISOString());
  if (filters.pitchId) params.set("pitchId", filters.pitchId);
  if (filters.customerId) params.set("customerId", filters.customerId);
  return params.toString();
}

type OwnerDashboardWorkspaceProps = {
  initialTab?: DashboardTab;
};

export function OwnerDashboardWorkspace({
  initialTab = "overview",
}: OwnerDashboardWorkspaceProps = {}) {
  const router = useRouter();
  const [tab, setTab] = useState<DashboardTab>(initialTab);
  const [fromDate, setFromDate] = useState(() => toDateInput(new Date(new Date().getFullYear(), new Date().getMonth(), 1)));
  const [toDate, setToDate] = useState(() => toDateInput(new Date()));
  const [selectedPitchId, setSelectedPitchId] = useState("");
  const [pitches, setPitches] = useState<PitchSummary[]>([]);
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
  const [subscriptionPaymentMethod, setSubscriptionPaymentMethod] = useState<
    "balance" | "chapa"
  >("balance");
  const [refreshToken, setRefreshToken] = useState(0);

  const filterQuery = useMemo(
    () => buildQueryString({ from: fromDate, to: toDate, pitchId: selectedPitchId }),
    [fromDate, selectedPitchId, toDate],
  );

  useEffect(() => {
    setTab(initialTab);
  }, [initialTab]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      try {
        const [pitchResponse, overviewResponse, bookingsResponse, paymentsResponse, customersResponse, utilizationResponse, subscriptionResponse, payoutResponse] = await Promise.all([
          browserApi.get<{ pitches?: PitchSummary[] }>("/api/pitches", { cache: "no-store" }),
          browserApi.get<{ overview?: Overview }>(`/api/owner/dashboard/overview?${filterQuery}`, { cache: "no-store" }),
          browserApi.get<{ bookings?: BookingRow[] }>(`/api/owner/dashboard/bookings?${filterQuery}`, { cache: "no-store" }),
          browserApi.get<{ payments?: PaymentRow[] }>(`/api/owner/dashboard/payments?${filterQuery}`, { cache: "no-store" }),
          browserApi.get<{ customers?: CustomerRow[] }>(`/api/owner/dashboard/customers?${filterQuery}`, { cache: "no-store" }),
          browserApi.get<{ utilization?: Utilization }>(`/api/owner/dashboard/utilization?${filterQuery}`, { cache: "no-store" }),
          browserApi.get<{ subscription?: OwnerSubscriptionSummary }>("/api/owner/dashboard/subscription", { cache: "no-store" }),
          browserApi.get<{
            summary?: OwnerPayoutSummary;
            commissionPercent?: number;
            ticketSurchargeEtb?: number;
          }>("/api/owner/payouts", { cache: "no-store" }),
        ]);

        if (cancelled) return;

        setPitches(pitchResponse.pitches ?? []);
        setOverview(overviewResponse.overview ?? null);
        setSubscription(subscriptionResponse.subscription ?? overviewResponse.overview?.subscription ?? null);
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

  const poolBookings = useMemo(
    () => bookings.filter((booking) => booking.poolStatus),
    [bookings],
  );

  async function handleSubscriptionAction(action: "start" | "renew" | "cancel") {
    setSubscriptionPending(true);
    try {
      const payload =
        action === "cancel"
          ? await browserApi.post<SubscriptionActionResponse>(
              "/api/pitch-subscriptions/cancel",
            )
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
      <Card className="space-y-4 p-5 sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-2">
            <p className="heading-kicker">Host overview</p>
            <h2 className="section-title">See bookings, people, money, settings, and exports.</h2>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <label className="block">
              <span className="field-label">From</span>
              <Input type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} />
            </label>
            <label className="block">
              <span className="field-label">To</span>
              <Input type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} />
            </label>
            <label className="block">
              <span className="field-label">Pitch</span>
              <Select value={selectedPitchId} onChange={(event) => setSelectedPitchId(event.target.value)}>
                <option value="">All pitches</option>
                {pitches.map((pitch) => (
                  <option key={pitch.id} value={pitch.id}>
                    {pitch.name}
                  </option>
                ))}
              </Select>
            </label>
          </div>
        </div>

        <div role="tablist" aria-label="Owner dashboard sections" className="grid gap-2 md:grid-cols-4 xl:grid-cols-8">
          {([
            "overview",
            "bookings",
            "payments",
            "pool_payments",
            "customers",
            "slots",
            "subscription",
            "exports",
          ] as const).map((value) => (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={tab === value}
              onClick={() => setTab(value)}
              className={`rounded-[var(--radius-md)] px-4 py-3 text-sm font-semibold transition ${
                tab === value
                  ? "bg-[rgba(125,211,252,0.12)] text-[var(--color-text-primary)]"
                  : "text-[var(--color-text-secondary)] hover:bg-white/[0.04] hover:text-[var(--color-text-primary)]"
              }`}
            >
              {dashboardTabLabels[value]}
            </button>
          ))}
        </div>
      </Card>

      {loading ? (
        <Card className="p-8 text-center text-sm text-[var(--color-text-secondary)]">
          Loading owner dashboard...
        </Card>
      ) : null}

      {!loading && tab === "overview" ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard label="Money in" value={formatCurrency(overview?.revenueTotalEtb ?? 0)} detail={`${overview?.bookingsConfirmed ?? 0} booked and paid`} />
          <MetricCard label="Refunds" value={formatCurrency(overview?.refundedAmountEtb ?? 0)} detail={`${overview?.expiredPools ?? 0} expired group payments`} />
          <MetricCard label="Calendar use" value={`${Math.round((overview?.utilization ?? 0) * 100)}%`} detail={`${utilization?.totals.slotCount ?? 0} booking times in range`} />
          <MetricCard label="Player names" value={`${overview?.assignedTicketCount ?? 0}/${(overview?.assignedTicketCount ?? 0) + (overview?.unassignedTicketCount ?? 0)}`} detail={`${overview?.checkedInTicketCount ?? 0} checked in`} />
          <MetricCard label="Single vs group" value={`${overview?.dailySalesCount ?? 0} / ${overview?.monthlySalesCount ?? 0}`} detail="Single visits vs monthly groups" />
          <MetricCard label="Monthly members" value={String(overview?.monthlyPassCustomers ?? 0)} detail={`${Math.round((overview?.partyCompletion ?? 0) * 100)}% group payment completion`} />
          <MetricCard label={uiCopy.host.hostPlan} value={overview?.subscription?.status ?? "NONE"} detail={overview?.subscription?.entitlementActive ? `${overview.subscription.daysRemaining} days left` : "Turn this on to publish booking times"} />
          <MetricCard label="Total bookings" value={String(overview?.bookingsTotal ?? 0)} detail={`${overview?.activeSlotCount ?? 0} open booking times in range`} />
        </div>
      ) : null}

      {!loading && tab === "bookings" ? (
        <Card className="p-5 sm:p-6">
          <ResponsiveTableCard
            table={
              <Table>
                <thead>
                  <tr>
                    <th className="px-3 py-3">Pitch</th>
                    <th className="px-3 py-3">When</th>
                    <th className="px-3 py-3">Customer</th>
                    <th className="px-3 py-3">Type</th>
                    <th className="px-3 py-3">Tickets</th>
                    <th className="px-3 py-3">Pool</th>
                    <th className="px-3 py-3">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {bookings.map((booking) => (
                    <tr key={booking.id} className="border-t border-[var(--color-border)]">
                      <td className="px-3 py-4">{booking.pitchName}</td>
                      <td className="px-3 py-4">{new Date(booking.startsAt).toLocaleString()}</td>
                      <td className="px-3 py-4">{booking.customerName}</td>
                      <td className="px-3 py-4">
                        <div className="flex flex-wrap gap-2">
                          <Badge variant="accent">{booking.productType}</Badge>
                          <Badge variant="default">{booking.status}</Badge>
                        </div>
                      </td>
                      <td className="px-3 py-4">
                        {booking.assignedTickets} assigned / {booking.checkedInTickets} checked in
                      </td>
                      <td className="px-3 py-4">{booking.poolStatus ?? "-"}</td>
                      <td className="px-3 py-4 font-semibold text-[var(--color-text-primary)]">
                        {formatCurrency(booking.totalAmount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            }
            mobileCards={bookings.map((booking) => (
              <BookingRowCard key={booking.id} booking={booking} />
            ))}
          />
        </Card>
      ) : null}

      {!loading && tab === "payments" ? (
        <div className="space-y-4">
          <Card className="space-y-5 p-5 sm:p-6">
            <div className="space-y-2">
              <p className="heading-kicker">Host payout</p>
              <h2 className="section-title">Send your settled earnings to your verified bank account.</h2>
              <p className="text-sm text-[var(--color-text-secondary)]">
                Money moves from Meda&apos;s Chapa balance to your verified payout destination. This is not a direct wallet-to-wallet Chapa send.
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <MetricCard
                label="Ready now"
                value={formatCurrency(payoutSummary?.availablePayoutEtb ?? 0)}
                detail={`Based on your current Meda balance of ${formatCurrency(
                  payoutSummary?.currentBalanceEtb ?? 0,
                )}.`}
              />
              <MetricCard
                label="Already sent"
                value={formatCurrency(payoutSummary?.totalPaidOutEtb ?? 0)}
                detail="Completed payouts to your verified destination."
              />
              <MetricCard
                label="Still processing"
                value={formatCurrency(payoutSummary?.totalPendingPayoutEtb ?? 0)}
                detail="Payouts that Chapa is still reviewing or sending."
              />
              <MetricCard
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
                      {payoutSummary?.destinationLabel ?? "Set up your payout destination in profile first."}
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
                      payoutSummary
                        ? payoutSummary.availablePayoutEtb.toFixed(2)
                        : "0.00"
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
                    This number is capped by your real Meda balance, not just your lifetime host earnings.
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
                        payoutSummary
                          ? payoutSummary.availablePayoutEtb.toFixed(2)
                          : "",
                      )
                    }
                    disabled={payoutPending || !payoutSummary || payoutSummary.availablePayoutEtb <= 0}
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
                      Add and verify your payout destination in profile before sending money out.
                    </p>
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => router.push("/profile")}
                    >
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
                        {payout.failureReason ??
                          payout.destinationBusinessName ??
                          "Processing"}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-[var(--color-text-secondary)]">
                  No payouts sent yet.
                </p>
              )}
            </div>
          </Card>

          <Card className="p-5 sm:p-6">
            <ResponsiveTableCard
              table={
                <Table>
                  <thead>
                    <tr>
                      <th className="px-3 py-3">Type</th>
                      <th className="px-3 py-3">Reference</th>
                      <th className="px-3 py-3">Status</th>
                      <th className="px-3 py-3">Amount</th>
                      <th className="px-3 py-3">Paid at</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payments.map((payment) => (
                      <tr
                        key={`${payment.type}-${payment.id}`}
                        className="border-t border-[var(--color-border)]"
                      >
                        <td className="px-3 py-4">{payment.type}</td>
                        <td className="px-3 py-4">{payment.pitchName ?? "-"}</td>
                        <td className="px-3 py-4">{payment.status}</td>
                        <td className="px-3 py-4 font-semibold text-[var(--color-text-primary)]">
                          {formatCurrency(payment.amount)}
                        </td>
                        <td className="px-3 py-4">
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
          </Card>
        </div>
      ) : null}

      {!loading && tab === "pool_payments" ? (
        <div className="grid gap-4">
          {poolBookings.length === 0 ? (
            <Card className="p-8 text-center text-sm text-[var(--color-text-secondary)]">
              No group payments in this date range.
            </Card>
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
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_360px]">
          <Card className="p-5 sm:p-6">
            <ResponsiveTableCard
              table={
                <Table>
                  <thead>
                    <tr>
                      <th className="px-3 py-3">Customer</th>
                      <th className="px-3 py-3">Bookings</th>
                      <th className="px-3 py-3">Assigned</th>
                      <th className="px-3 py-3">Checked in</th>
                      <th className="px-3 py-3">Paid</th>
                    </tr>
                  </thead>
                  <tbody>
                    {customers.map((customer) => (
                      <tr
                        key={customer.customerId}
                        className="cursor-pointer border-t border-[var(--color-border)] hover:bg-white/[0.03]"
                        onClick={() => setSelectedCustomerId(customer.customerId)}
                      >
                        <td className="px-3 py-4">
                          <div className="space-y-1">
                            <p className="font-semibold text-[var(--color-text-primary)]">
                              {customer.customerName}
                            </p>
                            <p className="text-xs text-[var(--color-text-muted)]">
                              {customer.customerEmail ?? "No email"}
                            </p>
                          </div>
                        </td>
                        <td className="px-3 py-4">{customer.bookings}</td>
                        <td className="px-3 py-4">{customer.ticketsAssigned}</td>
                        <td className="px-3 py-4">{customer.ticketsCheckedIn}</td>
                        <td className="px-3 py-4 font-semibold text-[var(--color-text-primary)]">
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
          </Card>

          <Card className="space-y-4 p-5 sm:p-6">
            <div className="space-y-2">
              <p className="heading-kicker">Customer profile</p>
              <h2 className="section-title">{selectedCustomer?.customerName ?? "Select a customer"}</h2>
              <p className="text-sm text-[var(--color-text-secondary)]">
                {selectedCustomer?.customerEmail ?? "Payment history, attendance, and monthly usage appear here."}
              </p>
            </div>

            {selectedCustomer ? (
              <div className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <MetricCard label="Bookings" value={String(selectedCustomer.bookings)} detail={`${selectedCustomer.monthlyPassUsage} monthly pass usages`} />
                  <MetricCard label="Paid" value={formatCurrency(selectedCustomer.totalPaidEtb)} detail={`${selectedCustomer.ticketsCheckedIn} check-ins`} />
                </div>

                <div className="space-y-3">
                  {selectedCustomer.history.map((entry) => (
                    <div key={`${entry.sourceType}:${entry.referenceId}`} className="rounded-[var(--radius-md)] border border-[var(--color-border)] px-4 py-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant={entry.sourceType === "SLOT" ? "accent" : "default"}>
                          {entry.sourceType}
                        </Badge>
                        <p className="font-semibold text-[var(--color-text-primary)]">{entry.title}</p>
                      </div>
                      <p className="text-xs text-[var(--color-text-muted)]">{new Date(entry.startsAt).toLocaleString()}</p>
                      <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
                        {entry.assignedCount} assigned, {entry.checkedInCount} checked in, {formatCurrency(entry.amountEtb)}
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
            ) : (
              <div className="rounded-[var(--radius-md)] border border-dashed border-[var(--color-border)] px-4 py-8 text-sm text-[var(--color-text-secondary)]">
                Click a customer row to inspect their booking and attendance history.
              </div>
            )}
          </Card>
        </div>
      ) : null}

      {!loading && tab === "slots" ? (
        <Card className="p-5 sm:p-6">
          <ResponsiveTableCard
            table={
              <Table>
                <thead>
                  <tr>
                    <th className="px-3 py-3">Pitch</th>
                    <th className="px-3 py-3">When</th>
                    <th className="px-3 py-3">Status</th>
                    <th className="px-3 py-3">Inventory</th>
                    <th className="px-3 py-3">Utilization</th>
                    <th className="px-3 py-3">Revenue</th>
                  </tr>
                </thead>
                <tbody>
                  {(utilization?.slots ?? []).map((slot) => (
                    <tr key={slot.id} className="border-t border-[var(--color-border)]">
                      <td className="px-3 py-4">{slot.pitchName}</td>
                      <td className="px-3 py-4">{new Date(slot.startsAt).toLocaleString()}</td>
                      <td className="px-3 py-4">
                        <div className="flex flex-wrap gap-2">
                          <Badge variant="default">{slot.status}</Badge>
                          <Badge variant="accent">{slot.productType}</Badge>
                        </div>
                      </td>
                      <td className="px-3 py-4">
                        {slot.soldQuantity}/{slot.capacity} sold, {slot.remainingCapacity} left
                      </td>
                      <td className="px-3 py-4">{Math.round(slot.utilization * 100)}%</td>
                      <td className="px-3 py-4 font-semibold text-[var(--color-text-primary)]">
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
          <p className="mt-4 text-sm text-[var(--color-text-secondary)]">
            Calendar-backed create, edit, and block actions are available in the owner operations section below.
          </p>
        </Card>
      ) : null}

      {!loading && tab === "subscription" ? (
        <Card className="space-y-5 p-5 sm:p-6">
          <div className="space-y-2">
            <p className="heading-kicker">Subscription</p>
            <h2 className="section-title">Pitch inventory entitlement</h2>
            <p className="text-sm text-[var(--color-text-secondary)]">
              Monthly subscription status controls whether owners can keep publishing and managing slot inventory.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <MetricCard
              label="Status"
              value={subscription?.status ?? "NONE"}
              detail={
                subscription?.gracePeriodActive
                  ? `Grace ends ${new Date(subscription.graceEndsAt ?? subscription.endsAt).toLocaleDateString()}`
                  : subscription?.entitlementActive
                    ? "Inventory access active"
                    : "Inventory access inactive"
              }
            />
            <MetricCard
              label="Plan"
              value={subscription?.planCode ?? "N/A"}
              detail={subscription?.renewalAt ? `Renews ${new Date(subscription.renewalAt).toLocaleDateString()}` : "No renewal scheduled"}
            />
            <MetricCard
              label="Days left"
              value={String(
                subscription?.gracePeriodActive
                  ? subscription.graceDaysRemaining
                  : subscription?.daysRemaining ?? 0,
              )}
              detail={
                subscription?.gracePeriodActive
                  ? `Grace ends ${new Date(subscription.graceEndsAt ?? subscription.endsAt).toLocaleDateString()}`
                  : subscription?.endsAt
                    ? `Ends ${new Date(subscription.endsAt).toLocaleDateString()}`
                    : "No active term"
              }
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_220px] sm:items-end">
            <label className="block">
              <span className="field-label">Payment method</span>
              <Select
                value={subscriptionPaymentMethod}
                onChange={(event) =>
                  setSubscriptionPaymentMethod(
                    event.target.value as "balance" | "chapa",
                  )
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
        <Card className="space-y-4 p-5 sm:p-6">
          <p className="heading-kicker">Exports</p>
          <h2 className="section-title">Download ERP CSV snapshots.</h2>
          <div className="grid gap-3 sm:grid-cols-3">
            <Button type="button" variant="secondary" onClick={() => window.open(exportLinks.bookings, "_blank", "noopener,noreferrer")}>
              Export bookings
            </Button>
            <Button type="button" variant="secondary" onClick={() => window.open(exportLinks.payments, "_blank", "noopener,noreferrer")}>
              Export payments
            </Button>
            <Button type="button" variant="secondary" onClick={() => window.open(exportLinks.attendees, "_blank", "noopener,noreferrer")}>
              Export attendees
            </Button>
          </div>
          <p className="text-sm text-[var(--color-text-secondary)]">
            These exports are filtered by the date range and pitch selector above.
          </p>
        </Card>
      ) : null}
    </div>
  );
}

function BookingRowCard({ booking }: { booking: BookingRow }) {
  return (
    <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-control-bg)] p-4">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="accent">{booking.productType}</Badge>
        <Badge variant="default">{booking.status}</Badge>
        {booking.poolStatus ? <Badge variant="default">{booking.poolStatus}</Badge> : null}
      </div>
      <div className="mt-3 space-y-1">
        <p className="text-base font-semibold text-[var(--color-text-primary)]">
          {booking.pitchName}
        </p>
        <p className="text-sm text-[var(--color-text-secondary)]">
          {new Date(booking.startsAt).toLocaleString()}
        </p>
      </div>
      <div className="mt-3 grid gap-2 text-sm text-[var(--color-text-secondary)]">
        <p>Customer: {booking.customerName}</p>
        <p>
          Tickets: {booking.assignedTickets} assigned / {booking.checkedInTickets} checked in
        </p>
        <p>Amount: {formatCurrency(booking.totalAmount)}</p>
      </div>
    </div>
  );
}

function PaymentRowCard({ payment }: { payment: PaymentRow }) {
  return (
    <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-control-bg)] p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-base font-semibold text-[var(--color-text-primary)]">{payment.type}</p>
        <Badge variant="default">{payment.status}</Badge>
      </div>
      <div className="mt-3 grid gap-2 text-sm text-[var(--color-text-secondary)]">
        <p>Reference: {payment.pitchName ?? "-"}</p>
        <p>Amount: {formatCurrency(payment.amount)}</p>
        <p>
          Paid at: {payment.paidAt ? new Date(payment.paidAt).toLocaleString() : "Not paid yet"}
        </p>
      </div>
    </div>
  );
}

function CustomerRowCard({
  customer,
  onSelect,
}: {
  customer: CustomerRow;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className="w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-control-bg)] p-4 text-left transition hover:bg-white/[0.03]"
    >
      <div className="space-y-1">
        <p className="text-base font-semibold text-[var(--color-text-primary)]">
          {customer.customerName}
        </p>
        <p className="text-sm text-[var(--color-text-muted)]">
          {customer.customerEmail ?? "No email"}
        </p>
      </div>
      <div className="mt-3 grid gap-2 text-sm text-[var(--color-text-secondary)] sm:grid-cols-2">
        <p>Bookings: {customer.bookings}</p>
        <p>Assigned: {customer.ticketsAssigned}</p>
        <p>Checked in: {customer.ticketsCheckedIn}</p>
        <p>Paid: {formatCurrency(customer.totalPaidEtb)}</p>
      </div>
      <p className="mt-3 text-xs text-[var(--color-text-muted)]">Tap to inspect history</p>
    </button>
  );
}

function UtilizationSlotCard({ slot }: { slot: Utilization["slots"][number] }) {
  return (
    <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-control-bg)] p-4">
      <div className="flex flex-wrap gap-2">
        <Badge variant="default">{slot.status}</Badge>
        <Badge variant="accent">{slot.productType}</Badge>
      </div>
      <div className="mt-3 space-y-1">
        <p className="text-base font-semibold text-[var(--color-text-primary)]">{slot.pitchName}</p>
        <p className="text-sm text-[var(--color-text-secondary)]">
          {new Date(slot.startsAt).toLocaleString()}
        </p>
      </div>
      <div className="mt-3 grid gap-2 text-sm text-[var(--color-text-secondary)]">
        <p>
          Inventory: {slot.soldQuantity}/{slot.capacity} sold, {slot.remainingCapacity} left
        </p>
        <p>Space used: {Math.round(slot.utilization * 100)}%</p>
        <p>Revenue: {formatCurrency(slot.revenueSummaryEtb)}</p>
      </div>
    </div>
  );
}

function MetricCard({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-control-bg)] p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-text-muted)]">
        {label}
      </p>
      <p className="mt-3 text-2xl font-semibold tracking-[-0.04em] text-[var(--color-text-primary)]">
        {value}
      </p>
      <p className="mt-2 text-sm leading-6 text-[var(--color-text-secondary)]">{detail}</p>
    </div>
  );
}
