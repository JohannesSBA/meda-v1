"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Card } from "@/app/components/ui/card";
import { Badge } from "@/app/components/ui/badge";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { Select } from "@/app/components/ui/select";
import { authClient } from "@/lib/auth/client";
import { browserApi } from "@/lib/browserApi";
import { getErrorMessage } from "@/lib/errorMessage";

type BookingRecord = {
  id: string;
  status: string;
  productType: "DAILY" | "MONTHLY";
  quantity: number;
  totalAmount: number;
  currency: string;
  expiresAt: string | null;
  paidAt: string | null;
  slot: {
    id: string;
    pitchName: string;
    ownerId: string;
    startsAt: string;
    endsAt: string;
    remainingCapacity: number;
  };
  tickets: Array<{
    id: string;
    purchaserId: string;
    assignedUserId: string | null;
    assignedName: string | null;
    assignedEmail: string | null;
    assigneeDisplayName: string | null;
    status: string;
    checkedInAt: string | null;
  }>;
  ticketSummary: {
    sold: number;
    assigned: number;
    unassigned: number;
    checkedIn: number;
  };
  paymentPool: null | {
    id: string;
    status: string;
    totalAmount: number;
    amountPaid: number;
    outstandingAmount: number;
    expiresAt: string;
    contributions: Array<{
      id: string;
      userId: string | null;
      contributorLabel: string;
      expectedAmount: number;
      paidAmount: number;
      status: string;
    }>;
  };
};

function formatCurrency(value: number, currency = "ETB") {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(value);
}

export function MyBookingsWorkspace() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: sessionData } = authClient.useSession();
  const currentUser = (sessionData?.user ?? null) as
    | {
        id?: string;
        email?: string | null;
      }
    | null;

  const [bookings, setBookings] = useState<BookingRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [submittingTicketId, setSubmittingTicketId] = useState<string | null>(null);
  const [submittingBookingId, setSubmittingBookingId] = useState<string | null>(null);
  const [ticketForms, setTicketForms] = useState<Record<string, { assignedEmail: string; assignedName: string }>>({});
  const [poolPaymentMethods, setPoolPaymentMethods] = useState<Record<string, "balance" | "chapa">>({});
  const [confirming, setConfirming] = useState(false);

  const unconfirmedTxRef = searchParams.get("tx_ref");
  const unconfirmedPoolTxRef = searchParams.get("pool_tx_ref");

  async function loadBookings() {
    setLoading(true);
    try {
      const data = await browserApi.get<{ bookings?: BookingRecord[] }>("/api/my-bookings", {
        cache: "no-store",
      });
      setBookings(data.bookings ?? []);
    } catch (error) {
      toast.error(getErrorMessage(error) || "Failed to load bookings");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadBookings();
  }, []);

  useEffect(() => {
    async function confirmPendingPayments() {
      if (confirming) return;
      if (!unconfirmedTxRef && !unconfirmedPoolTxRef) return;

      setConfirming(true);
      try {
        if (unconfirmedTxRef) {
          const response = await browserApi.postDetailed<{ status?: string }>(
            "/api/bookings/confirm",
            { txRef: unconfirmedTxRef },
          );
          if (response.status === 202 || response.data?.status === "processing") {
            toast.message("Booking payment is still processing.");
          } else {
            toast.success("Booking payment confirmed.");
          }
        }
        if (unconfirmedPoolTxRef) {
          const response = await browserApi.postDetailed<{ status?: string }>(
            "/api/payment-pools/confirm",
            { txRef: unconfirmedPoolTxRef },
          );
          if (response.status === 202 || response.data?.status === "processing") {
            toast.message("Pool contribution is still processing.");
          } else {
            toast.success("Pool contribution confirmed.");
          }
        }
        await loadBookings();
        router.replace("/tickets");
      } catch (error) {
        toast.error(getErrorMessage(error) || "Failed to confirm payment");
      } finally {
        setConfirming(false);
      }
    }

    void confirmPendingPayments();
  }, [confirming, router, unconfirmedPoolTxRef, unconfirmedTxRef]);

  const upcomingBookings = useMemo(
    () =>
      bookings.filter((booking) => new Date(booking.slot.endsAt).getTime() >= Date.now()),
    [bookings],
  );

  async function handleAssignTicket(ticketId: string) {
    const form = ticketForms[ticketId];
    setSubmittingTicketId(ticketId);
    try {
      await browserApi.post(`/api/tickets/${ticketId}/assign`, {
        assignedEmail: form?.assignedEmail || undefined,
        assignedName: form?.assignedName || undefined,
      });
      toast.success("Ticket assigned.");
      await loadBookings();
    } catch (error) {
      toast.error(getErrorMessage(error) || "Failed to assign ticket");
    } finally {
      setSubmittingTicketId(null);
    }
  }

  async function handleClaimTicket(ticketId: string) {
    setSubmittingTicketId(ticketId);
    try {
      await browserApi.post(`/api/tickets/${ticketId}/claim`);
      toast.success("Ticket claimed.");
      await loadBookings();
    } catch (error) {
      toast.error(getErrorMessage(error) || "Failed to claim ticket");
    } finally {
      setSubmittingTicketId(null);
    }
  }

  async function handleUnassignTicket(ticketId: string) {
    setSubmittingTicketId(ticketId);
    try {
      await browserApi.post(`/api/tickets/${ticketId}/unassign`);
      toast.success("Ticket unassigned.");
      await loadBookings();
    } catch (error) {
      toast.error(getErrorMessage(error) || "Failed to unassign ticket");
    } finally {
      setSubmittingTicketId(null);
    }
  }

  async function handleCancelBooking(bookingId: string) {
    setSubmittingBookingId(bookingId);
    try {
      await browserApi.post(`/api/bookings/${bookingId}/cancel`);
      toast.success("Booking cancelled.");
      await loadBookings();
    } catch (error) {
      toast.error(getErrorMessage(error) || "Failed to cancel booking");
    } finally {
      setSubmittingBookingId(null);
    }
  }

  async function handleContributeToPool(poolId: string, bookingId: string) {
    setSubmittingBookingId(bookingId);
    try {
      const method = poolPaymentMethods[poolId] ?? "balance";
      const result = await browserApi.post<{
        checkoutUrl?: string | null;
      }>(`/api/payment-pools/${poolId}/contribute`, {
        paymentMethod: method,
      });
      if (result.checkoutUrl) {
        window.location.href = result.checkoutUrl;
        return;
      }

      toast.success("Contribution recorded.");
      await loadBookings();
    } catch (error) {
      toast.error(getErrorMessage(error) || "Failed to contribute");
    } finally {
      setSubmittingBookingId(null);
    }
  }

  return (
    <div className="space-y-6">
      <Card className="space-y-3 p-5 sm:p-6">
        <p className="heading-kicker">Booking ledger</p>
        <h2 className="section-title">Track bookings, pool deadlines, and ticket assignment.</h2>
        <p className="text-sm leading-7 text-[var(--color-text-secondary)]">
          Daily bookings become usable immediately after payment. Monthly bookings stay pending until the pool reaches 100% before the one-hour deadline.
        </p>
      </Card>

      {loading || confirming ? (
        <Card className="p-8 text-center text-sm text-[var(--color-text-secondary)]">
          {confirming ? "Confirming payment..." : "Loading your bookings..."}
        </Card>
      ) : upcomingBookings.length === 0 ? (
        <Card className="p-8 text-center text-sm text-[var(--color-text-secondary)]">
          No bookings yet. Start from the slot marketplace.
        </Card>
      ) : (
        <div className="grid gap-4">
          {upcomingBookings.map((booking) => {
            const myContribution =
              booking.paymentPool?.contributions.find(
                (contribution) => contribution.userId === currentUser?.id,
              ) ?? null;
            const purchaserCanManage = booking.tickets.some(
              (ticket) => ticket.purchaserId === currentUser?.id,
            );

            return (
              <Card key={booking.id} className="space-y-5 p-5 sm:p-6">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="space-y-2">
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="accent">{booking.productType}</Badge>
                      <Badge variant={booking.status === "CONFIRMED" ? "success" : "default"}>
                        {booking.status}
                      </Badge>
                      {booking.paymentPool ? (
                        <Badge variant="default">{booking.paymentPool.status}</Badge>
                      ) : null}
                    </div>
                    <h3 className="text-xl font-semibold tracking-[-0.03em] text-[var(--color-text-primary)]">
                      {booking.slot.pitchName}
                    </h3>
                    <p className="text-sm text-[var(--color-text-secondary)]">
                      {new Date(booking.slot.startsAt).toLocaleString()} -{" "}
                      {new Date(booking.slot.endsAt).toLocaleTimeString([], {
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                    </p>
                    <p className="text-sm text-[var(--color-text-secondary)]">
                      {booking.quantity} seat{booking.quantity === 1 ? "" : "s"}, {formatCurrency(booking.totalAmount, booking.currency)}
                    </p>
                    <p className="text-sm text-[var(--color-text-secondary)]">
                      {booking.ticketSummary.assigned}/{booking.ticketSummary.sold} assigned,{" "}
                      {booking.ticketSummary.checkedIn} checked in
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={submittingBookingId === booking.id}
                      onClick={() => void handleCancelBooking(booking.id)}
                    >
                      {submittingBookingId === booking.id ? "Processing..." : "Cancel"}
                    </Button>
                  </div>
                </div>

                {booking.paymentPool ? (
                  <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-control-bg)] p-4">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                      <div className="space-y-1">
                        <p className="text-sm font-semibold text-[var(--color-text-primary)]">
                          Pool progress {formatCurrency(booking.paymentPool.amountPaid, booking.currency)} /{" "}
                          {formatCurrency(booking.paymentPool.totalAmount, booking.currency)}
                        </p>
                        <p className="text-xs text-[var(--color-text-muted)]">
                          Deadline {new Date(booking.paymentPool.expiresAt).toLocaleString()}
                        </p>
                      </div>
                      {booking.paymentPool.status === "PENDING" ? (
                        <div className="flex flex-wrap gap-2">
                          <Select
                            value={poolPaymentMethods[booking.paymentPool.id] ?? "balance"}
                            onChange={(event) =>
                              setPoolPaymentMethods((prev) => ({
                                ...prev,
                                [booking.paymentPool!.id]: event.target.value as "balance" | "chapa",
                              }))
                            }
                          >
                            <option value="balance">Meda balance</option>
                            <option value="chapa">Chapa</option>
                          </Select>
                          <Button
                            type="button"
                            variant="primary"
                            size="sm"
                            disabled={submittingBookingId === booking.id}
                            onClick={() => void handleContributeToPool(booking.paymentPool!.id, booking.id)}
                          >
                            {submittingBookingId === booking.id ? "Processing..." : myContribution ? "Pay my share" : "Contribute"}
                          </Button>
                        </div>
                      ) : null}
                    </div>

                    <div className="mt-4 grid gap-2">
                      {booking.paymentPool.contributions.map((contribution) => (
                        <div
                          key={contribution.id}
                          className="flex flex-col gap-2 rounded-[var(--radius-md)] border border-[var(--color-border)] px-3 py-3 sm:flex-row sm:items-center sm:justify-between"
                        >
                          <div className="space-y-1">
                            <p className="text-sm font-semibold text-[var(--color-text-primary)]">
                              {contribution.contributorLabel}
                            </p>
                            <p className="text-xs text-[var(--color-text-muted)]">
                              {formatCurrency(contribution.paidAmount, booking.currency)} paid of{" "}
                              {formatCurrency(contribution.expectedAmount, booking.currency)}
                            </p>
                          </div>
                          <Badge
                            variant={
                              contribution.status === "PAID" ? "success" : "default"
                            }
                          >
                            {contribution.status}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}

                <div className="grid gap-3">
                  {booking.tickets.map((ticket) => {
                    const isPendingAssignment = ticket.status === "ASSIGNMENT_PENDING";
                    const canClaim =
                      ticket.status === "ASSIGNED" &&
                      ticket.assignedEmail &&
                      currentUser?.email &&
                      ticket.assignedEmail.toLowerCase() === currentUser.email.toLowerCase();

                    return (
                      <div
                        key={ticket.id}
                        className="rounded-[var(--radius-md)] border border-[var(--color-border)] px-4 py-4"
                      >
                        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                          <div className="space-y-1">
                            <div className="flex flex-wrap gap-2">
                              <Badge variant={ticket.status === "CHECKED_IN" ? "success" : "default"}>
                                {ticket.status}
                              </Badge>
                            </div>
                            <p className="text-sm font-semibold text-[var(--color-text-primary)]">
                              {ticket.assigneeDisplayName ?? "Assignment pending"}
                            </p>
                            <p className="text-xs text-[var(--color-text-muted)]">
                              {ticket.assignedEmail ?? "No email assigned"}
                            </p>
                          </div>

                          <div className="flex flex-wrap gap-2">
                            {canClaim ? (
                              <Button
                                type="button"
                                size="sm"
                                variant="secondary"
                                disabled={submittingTicketId === ticket.id}
                                onClick={() => void handleClaimTicket(ticket.id)}
                              >
                                {submittingTicketId === ticket.id ? "Claiming..." : "Claim"}
                              </Button>
                            ) : null}
                            {purchaserCanManage ? (
                              <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                disabled={submittingTicketId === ticket.id}
                                onClick={() => void handleUnassignTicket(ticket.id)}
                              >
                                Unassign
                              </Button>
                            ) : null}
                          </div>
                        </div>

                        {purchaserCanManage && isPendingAssignment ? (
                          <div className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
                            <Input
                              value={ticketForms[ticket.id]?.assignedEmail ?? ""}
                              onChange={(event) =>
                                setTicketForms((prev) => ({
                                  ...prev,
                                  [ticket.id]: {
                                    assignedEmail: event.target.value,
                                    assignedName: prev[ticket.id]?.assignedName ?? "",
                                  },
                                }))
                              }
                              placeholder="friend@example.com"
                            />
                            <Input
                              value={ticketForms[ticket.id]?.assignedName ?? ""}
                              onChange={(event) =>
                                setTicketForms((prev) => ({
                                  ...prev,
                                  [ticket.id]: {
                                    assignedEmail: prev[ticket.id]?.assignedEmail ?? "",
                                    assignedName: event.target.value,
                                  },
                                }))
                              }
                              placeholder="Assignee name"
                            />
                            <Button
                              type="button"
                              variant="primary"
                              disabled={submittingTicketId === ticket.id}
                              onClick={() => void handleAssignTicket(ticket.id)}
                            >
                              {submittingTicketId === ticket.id ? "Saving..." : "Assign"}
                            </Button>
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
