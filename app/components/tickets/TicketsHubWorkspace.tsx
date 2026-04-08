"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Badge } from "@/app/components/ui/badge";
import { Button, buttonVariants } from "@/app/components/ui/button";
import { Card } from "@/app/components/ui/card";
import { cn } from "@/app/components/ui/cn";
import { Input } from "@/app/components/ui/input";
import { Select } from "@/app/components/ui/select";
import { AppPageHeader } from "@/app/components/ui/app-page-header";
import { AppSectionCard } from "@/app/components/ui/app-section-card";
import { InlineStatusBanner } from "@/app/components/ui/inline-status-banner";
import { browserApi } from "@/lib/browserApi";
import { getErrorMessage } from "@/lib/errorMessage";
import { buildGoogleMapsUrl } from "@/lib/location";
import {
  formatBookingStatusLabel,
  formatPoolStatusLabel,
  formatProductTypeLabel,
  formatTicketStatusLabel,
  getBookingStatusHelper,
  getPoolStatusHelper,
  getTicketStatusHelper,
  uiCopy,
} from "@/lib/uiCopy";

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
    addressLabel: string | null;
    latitude: number | null;
    longitude: number | null;
    startsAt: string;
    endsAt: string;
    capacity: number;
    remainingCapacity: number;
  };
  party: null | {
    id: string;
    ownerId: string;
    name: string | null;
    status: string;
    memberCount: number;
    members: Array<{
      id: string;
      userId: string | null;
      invitedEmail: string | null;
      displayName: string | null;
      status: string;
      joinedAt: string | null;
      paidAt: string | null;
    }>;
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
      partyMemberId: string | null;
      contributorLabel: string;
      expectedAmount: number;
      paidAmount: number;
      status: string;
    }>;
  };
};

type BookingHubItem = {
  kind: "booking";
  id: string;
  section: "up_next" | "needs_action" | "past";
  startsAt: string;
  endsAt: string;
  title: string;
  subtitle: string;
  statusLabel: string;
  helperText: string;
  booking: BookingRecord;
  primaryAction:
    | { type: "pay_share"; label: string; poolId: string }
    | { type: "add_player_names"; label: string }
    | { type: "claim_ticket"; label: string; ticketId: string }
    | { type: "open_booking"; label: string };
  canCancel: boolean;
  purchaserCanManageTickets: boolean;
  claimableTicketIds: string[];
  canPayShare: boolean;
};

type EventHubItem = {
  kind: "event";
  id: string;
  section: "up_next" | "needs_action" | "past";
  startsAt: string;
  endsAt: string;
  title: string;
  subtitle: string;
  statusLabel: string;
  helperText: string;
  locationLabel?: string | null;
  mapUrl?: string | null;
  ticketCount: number;
  checkedInCount: number;
  href: string;
  primaryAction: {
    type: "open_event";
    label: string;
    href: string;
  };
};

type TicketHubItem = BookingHubItem | EventHubItem;

type TicketsHubResponse = {
  sections: {
    needsAction: TicketHubItem[];
    upNext: TicketHubItem[];
    past: TicketHubItem[];
  };
  summary: {
    needsAction: number;
    upNext: number;
    past: number;
  };
};

function formatCurrency(value: number, currency = "ETB") {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(value);
}

export function TicketsHubWorkspace() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [hub, setHub] = useState<TicketsHubResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [confirming, setConfirming] = useState(false);
  const [submittingItemId, setSubmittingItemId] = useState<string | null>(null);
  const [expandedBookings, setExpandedBookings] = useState<Record<string, boolean>>({});
  const [ticketForms, setTicketForms] = useState<
    Record<string, { assignedEmail: string; assignedName: string }>
  >({});
  const [poolPaymentMethods, setPoolPaymentMethods] = useState<Record<string, "balance" | "chapa">>(
    {},
  );
  const [groupMemberForms, setGroupMemberForms] = useState<Record<string, string>>({});
  const [openQrTickets, setOpenQrTickets] = useState<Record<string, boolean>>({});
  const [ticketShareLinks, setTicketShareLinks] = useState<Record<string, string>>({});
  const [bookingShareLinks, setBookingShareLinks] = useState<Record<string, string>>({});
  const [copiedShareTicketId, setCopiedShareTicketId] = useState<string | null>(null);
  const [copiedShareBookingId, setCopiedShareBookingId] = useState<string | null>(null);

  const txRef = searchParams.get("tx_ref");
  const poolTxRef = searchParams.get("pool_tx_ref");

  async function loadHub() {
    setLoading(true);
    try {
      const payload = await browserApi.get<TicketsHubResponse>("/api/tickets/hub", {
        cache: "no-store",
      });
      setHub(payload);
    } catch (error) {
      toast.error(getErrorMessage(error) || "Failed to load tickets");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadHub();
  }, []);

  useEffect(() => {
    async function confirmPendingPayments() {
      if (confirming) return;
      if (!txRef && !poolTxRef) return;

      setConfirming(true);
      try {
        if (txRef) {
          await browserApi.postDetailed("/api/bookings/confirm", { txRef });
          toast.success("Booking payment confirmed.");
        }

        if (poolTxRef) {
          await browserApi.postDetailed("/api/payment-pools/confirm", { txRef: poolTxRef });
          toast.success("Group payment confirmed.");
        }

        await loadHub();
        router.replace("/tickets");
      } catch (error) {
        toast.error(getErrorMessage(error) || "Failed to confirm payment");
      } finally {
        setConfirming(false);
      }
    }

    void confirmPendingPayments();
  }, [confirming, poolTxRef, router, txRef]);

  async function handleClaimTicket(ticketId: string) {
    setSubmittingItemId(ticketId);
    try {
      await browserApi.post(`/api/tickets/${ticketId}/claim`);
      toast.success("Ticket claimed.");
      await loadHub();
    } catch (error) {
      toast.error(getErrorMessage(error) || "Failed to claim ticket");
    } finally {
      setSubmittingItemId(null);
    }
  }

  async function handleAssignTicket(ticketId: string) {
    const form = ticketForms[ticketId];
    setSubmittingItemId(ticketId);
    try {
      await browserApi.post(`/api/tickets/${ticketId}/assign`, {
        assignedEmail: form?.assignedEmail || undefined,
        assignedName: form?.assignedName || undefined,
      });
      toast.success("Player name saved.");
      await loadHub();
    } catch (error) {
      toast.error(getErrorMessage(error) || "Failed to save player name");
    } finally {
      setSubmittingItemId(null);
    }
  }

  async function handleCreateTicketClaimLink(ticketId: string) {
    setSubmittingItemId(ticketId);
    try {
      const data = await browserApi.post<{ shareUrl?: string }>(`/api/tickets/${ticketId}/share-link`);
      const shareUrl = String(data?.shareUrl ?? "");
      if (!shareUrl) {
        throw new Error("Claim link was not returned");
      }

      setTicketShareLinks((current) => ({
        ...current,
        [ticketId]: shareUrl,
      }));

      if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(shareUrl);
        setCopiedShareTicketId(ticketId);
        window.setTimeout(() => setCopiedShareTicketId(null), 1600);
        toast.success("Claim link copied.");
      } else {
        toast.success("Claim link created below.");
      }
    } catch (error) {
      toast.error(getErrorMessage(error) || "Failed to create claim link");
    } finally {
      setSubmittingItemId(null);
    }
  }

  async function handleCreateBookingClaimLink(bookingId: string) {
    setSubmittingItemId(bookingId);
    try {
      const data = await browserApi.post<{ shareUrl?: string }>(`/api/bookings/${bookingId}/share-link`);
      const shareUrl = String(data?.shareUrl ?? "");
      if (!shareUrl) {
        throw new Error("Claim link was not returned");
      }

      setBookingShareLinks((current) => ({
        ...current,
        [bookingId]: shareUrl,
      }));

      if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(shareUrl);
        setCopiedShareBookingId(bookingId);
        window.setTimeout(() => setCopiedShareBookingId(null), 1600);
        toast.success("Claim link copied.");
      } else {
        toast.success("Claim link created below.");
      }
    } catch (error) {
      toast.error(getErrorMessage(error) || "Failed to create claim link");
    } finally {
      setSubmittingItemId(null);
    }
  }

  async function handleUnassignTicket(ticketId: string) {
    setSubmittingItemId(ticketId);
    try {
      await browserApi.post(`/api/tickets/${ticketId}/unassign`);
      toast.success("Player name removed.");
      await loadHub();
    } catch (error) {
      toast.error(getErrorMessage(error) || "Failed to remove player name");
    } finally {
      setSubmittingItemId(null);
    }
  }

  async function handleCancelBooking(bookingId: string) {
    setSubmittingItemId(bookingId);
    try {
      await browserApi.post(`/api/bookings/${bookingId}/cancel`);
      toast.success("Booking cancelled.");
      await loadHub();
    } catch (error) {
      toast.error(getErrorMessage(error) || "Failed to cancel booking");
    } finally {
      setSubmittingItemId(null);
    }
  }

  async function handleContribute(poolId: string, itemId: string, partyMemberId?: string) {
    setSubmittingItemId(itemId);
    try {
      const method = poolPaymentMethods[poolId] ?? "balance";
      const result = await browserApi.post<{ checkoutUrl?: string | null }>(
        `/api/payment-pools/${poolId}/contribute`,
        { paymentMethod: method, partyMemberId },
      );

      if (result.checkoutUrl) {
        window.location.href = result.checkoutUrl;
        return;
      }

      toast.success("Your payment was recorded.");
      await loadHub();
    } catch (error) {
      toast.error(getErrorMessage(error) || "Failed to pay your share");
    } finally {
      setSubmittingItemId(null);
    }
  }

  async function handleAddGroupMember(partyId: string, bookingId: string) {
    const email = groupMemberForms[bookingId]?.trim().toLowerCase() ?? "";
    if (!email) {
      toast.error("Enter an email address first.");
      return;
    }

    setSubmittingItemId(bookingId);
    try {
      await browserApi.post(`/api/parties/${partyId}/invite`, { emails: [email] });
      setGroupMemberForms((current) => ({ ...current, [bookingId]: "" }));
      toast.success("Member added. They will get an email from Meda.");
      await loadHub();
    } catch (error) {
      toast.error(getErrorMessage(error) || "Failed to add member");
    } finally {
      setSubmittingItemId(null);
    }
  }

  async function handleRemoveGroupMember(partyId: string, memberId: string) {
    setSubmittingItemId(memberId);
    try {
      await browserApi.delete(`/api/parties/${partyId}/member/${memberId}`);
      toast.success("Member removed.");
      await loadHub();
    } catch (error) {
      toast.error(getErrorMessage(error) || "Failed to remove member");
    } finally {
      setSubmittingItemId(null);
    }
  }

  const allItems = useMemo(
    () => [
      ...(hub?.sections.needsAction ?? []),
      ...(hub?.sections.upNext ?? []),
      ...(hub?.sections.past ?? []),
    ],
    [hub],
  );
  const groupPaymentItems = useMemo(
    () =>
      hub?.sections.needsAction.filter(
        (item): item is BookingHubItem =>
          item.kind === "booking" && item.primaryAction.type === "pay_share",
      ) ?? [],
    [hub],
  );
  const playerNameItems = useMemo(
    () =>
      hub?.sections.needsAction.filter(
        (item): item is BookingHubItem =>
          item.kind === "booking" && item.primaryAction.type === "add_player_names",
      ) ?? [],
    [hub],
  );

  if (loading || confirming) {
    return (
      <AppSectionCard density="comfortable">
        <div className="py-8 text-center text-sm text-[var(--color-text-secondary)]">
        {confirming ? "Finishing your payment..." : "Loading your tickets..."}
        </div>
      </AppSectionCard>
    );
  }

  return (
    <div className="space-y-8">
      <AppPageHeader
        kicker={uiCopy.nav.tickets}
        title="Your tickets in one place."
        description="Start with needs action, then check what is coming up."
        primaryAction={
          <Link
            href="/play"
            className={cn(buttonVariants("primary", "md"), "rounded-full")}
          >
            Find something to play
          </Link>
        }
        secondaryActions={
          <Link
            href="/profile"
            className={cn(buttonVariants("secondary", "md"), "rounded-full")}
          >
            Account and settings
          </Link>
        }
        stats={
          <>
            <SummaryPill label="Needs action" value={hub?.summary.needsAction ?? 0} />
            <SummaryPill label={uiCopy.tickets.comingUp} value={hub?.summary.upNext ?? 0} />
            <SummaryPill label="Past" value={hub?.summary.past ?? 0} />
          </>
        }
      />

      {hub && hub.summary.needsAction > 0 ? (
        <InlineStatusBanner
          title="Start with what needs action."
          description={
            groupPaymentItems.length > 0
              ? `${groupPaymentItems.length} group payment${
                  groupPaymentItems.length === 1 ? "" : "s"
                } still need money before the deadline.`
              : `${playerNameItems.length} ticket${
                  playerNameItems.length === 1 ? "" : "s"
                } still need a player name before they can be used.`
          }
          tone="warning"
        />
      ) : null}

      {playerNameItems.length > 0 ? (
        <InlineStatusBanner
          title="Tip for family/dependent tickets"
          description="Save only a player name when the ticket should stay under your account."
          tone="info"
        />
      ) : null}

      <TicketsSection
        title="Needs action"
        description="Handle these first."
        items={hub?.sections.needsAction ?? []}
        emptyMessage="Nothing needs your attention right now."
        expandedBookings={expandedBookings}
        setExpandedBookings={setExpandedBookings}
        ticketForms={ticketForms}
        setTicketForms={setTicketForms}
        poolPaymentMethods={poolPaymentMethods}
        setPoolPaymentMethods={setPoolPaymentMethods}
        groupMemberForms={groupMemberForms}
        setGroupMemberForms={setGroupMemberForms}
        openQrTickets={openQrTickets}
        setOpenQrTickets={setOpenQrTickets}
        ticketShareLinks={ticketShareLinks}
        bookingShareLinks={bookingShareLinks}
        copiedShareTicketId={copiedShareTicketId}
        copiedShareBookingId={copiedShareBookingId}
        submittingItemId={submittingItemId}
        onClaimTicket={handleClaimTicket}
        onAssignTicket={handleAssignTicket}
        onCreateBookingClaimLink={handleCreateBookingClaimLink}
        onCreateTicketClaimLink={handleCreateTicketClaimLink}
        onUnassignTicket={handleUnassignTicket}
        onContribute={handleContribute}
        onCancelBooking={handleCancelBooking}
        onAddGroupMember={handleAddGroupMember}
        onRemoveGroupMember={handleRemoveGroupMember}
      />

      <TicketsSection
        title="Up next"
        description="Ready for your next game."
        items={hub?.sections.upNext ?? []}
        emptyMessage={allItems.length === 0 ? "You do not have any tickets yet." : "Nothing upcoming right now."}
        expandedBookings={expandedBookings}
        setExpandedBookings={setExpandedBookings}
        ticketForms={ticketForms}
        setTicketForms={setTicketForms}
        poolPaymentMethods={poolPaymentMethods}
        setPoolPaymentMethods={setPoolPaymentMethods}
        groupMemberForms={groupMemberForms}
        setGroupMemberForms={setGroupMemberForms}
        openQrTickets={openQrTickets}
        setOpenQrTickets={setOpenQrTickets}
        ticketShareLinks={ticketShareLinks}
        bookingShareLinks={bookingShareLinks}
        copiedShareTicketId={copiedShareTicketId}
        copiedShareBookingId={copiedShareBookingId}
        submittingItemId={submittingItemId}
        onClaimTicket={handleClaimTicket}
        onAssignTicket={handleAssignTicket}
        onCreateBookingClaimLink={handleCreateBookingClaimLink}
        onCreateTicketClaimLink={handleCreateTicketClaimLink}
        onUnassignTicket={handleUnassignTicket}
        onContribute={handleContribute}
        onCancelBooking={handleCancelBooking}
        onAddGroupMember={handleAddGroupMember}
        onRemoveGroupMember={handleRemoveGroupMember}
      />

      <TicketsSection
        title="Past"
        description="Completed bookings and matches."
        items={hub?.sections.past ?? []}
        emptyMessage="No past tickets yet."
        expandedBookings={expandedBookings}
        setExpandedBookings={setExpandedBookings}
        ticketForms={ticketForms}
        setTicketForms={setTicketForms}
        poolPaymentMethods={poolPaymentMethods}
        setPoolPaymentMethods={setPoolPaymentMethods}
        groupMemberForms={groupMemberForms}
        setGroupMemberForms={setGroupMemberForms}
        openQrTickets={openQrTickets}
        setOpenQrTickets={setOpenQrTickets}
        ticketShareLinks={ticketShareLinks}
        bookingShareLinks={bookingShareLinks}
        copiedShareTicketId={copiedShareTicketId}
        copiedShareBookingId={copiedShareBookingId}
        submittingItemId={submittingItemId}
        onClaimTicket={handleClaimTicket}
        onAssignTicket={handleAssignTicket}
        onCreateBookingClaimLink={handleCreateBookingClaimLink}
        onCreateTicketClaimLink={handleCreateTicketClaimLink}
        onUnassignTicket={handleUnassignTicket}
        onContribute={handleContribute}
        onCancelBooking={handleCancelBooking}
        onAddGroupMember={handleAddGroupMember}
        onRemoveGroupMember={handleRemoveGroupMember}
      />
    </div>
  );
}

function TicketsSection(props: {
  title: string;
  description: string;
  items: TicketHubItem[];
  emptyMessage: string;
  expandedBookings: Record<string, boolean>;
  setExpandedBookings: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  ticketForms: Record<string, { assignedEmail: string; assignedName: string }>;
  setTicketForms: React.Dispatch<
    React.SetStateAction<Record<string, { assignedEmail: string; assignedName: string }>>
  >;
  poolPaymentMethods: Record<string, "balance" | "chapa">;
  setPoolPaymentMethods: React.Dispatch<
    React.SetStateAction<Record<string, "balance" | "chapa">>
  >;
  groupMemberForms: Record<string, string>;
  setGroupMemberForms: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  openQrTickets: Record<string, boolean>;
  setOpenQrTickets: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  ticketShareLinks: Record<string, string>;
  bookingShareLinks: Record<string, string>;
  copiedShareTicketId: string | null;
  copiedShareBookingId: string | null;
  submittingItemId: string | null;
  onClaimTicket: (ticketId: string) => Promise<void>;
  onAssignTicket: (ticketId: string) => Promise<void>;
  onCreateBookingClaimLink: (bookingId: string) => Promise<void>;
  onCreateTicketClaimLink: (ticketId: string) => Promise<void>;
  onUnassignTicket: (ticketId: string) => Promise<void>;
  onContribute: (poolId: string, itemId: string, partyMemberId?: string) => Promise<void>;
  onCancelBooking: (bookingId: string) => Promise<void>;
  onAddGroupMember: (partyId: string, bookingId: string) => Promise<void>;
  onRemoveGroupMember: (partyId: string, memberId: string) => Promise<void>;
}) {
  return (
    <AppSectionCard
      headingKicker={props.title}
      title={`${props.items.length} item${props.items.length === 1 ? "" : "s"}`}
      description={props.description}
      density="comfortable"
    >
      {props.items.length === 0 ? (
        <Card className="p-6 text-sm text-[var(--color-text-secondary)]">{props.emptyMessage}</Card>
      ) : (
        <div className="grid gap-4">
          {props.items.map((item) =>
            item.kind === "booking" ? (
              <BookingTicketCard
                key={`booking-${item.id}`}
                item={item}
                expanded={Boolean(props.expandedBookings[item.id])}
                setExpanded={(next) =>
                  props.setExpandedBookings((current) => ({
                    ...current,
                    [item.id]: next,
                  }))
                }
                ticketForms={props.ticketForms}
                setTicketForms={props.setTicketForms}
                poolPaymentMethods={props.poolPaymentMethods}
                setPoolPaymentMethods={props.setPoolPaymentMethods}
                groupMemberForms={props.groupMemberForms}
                setGroupMemberForms={props.setGroupMemberForms}
                openQrTickets={props.openQrTickets}
                setOpenQrTickets={props.setOpenQrTickets}
                ticketShareLinks={props.ticketShareLinks}
                bookingShareLinks={props.bookingShareLinks}
                copiedShareTicketId={props.copiedShareTicketId}
                copiedShareBookingId={props.copiedShareBookingId}
                submittingItemId={props.submittingItemId}
                onClaimTicket={props.onClaimTicket}
                onAssignTicket={props.onAssignTicket}
                onCreateBookingClaimLink={props.onCreateBookingClaimLink}
                onCreateTicketClaimLink={props.onCreateTicketClaimLink}
                onUnassignTicket={props.onUnassignTicket}
                onContribute={props.onContribute}
                onCancelBooking={props.onCancelBooking}
                onAddGroupMember={props.onAddGroupMember}
                onRemoveGroupMember={props.onRemoveGroupMember}
              />
            ) : (
              <EventTicketCard key={`event-${item.id}`} item={item} />
            ),
          )}
        </div>
      )}
    </AppSectionCard>
  );
}

function BookingTicketCard(props: {
  item: BookingHubItem;
  expanded: boolean;
  setExpanded: (next: boolean) => void;
  ticketForms: Record<string, { assignedEmail: string; assignedName: string }>;
  setTicketForms: React.Dispatch<
    React.SetStateAction<Record<string, { assignedEmail: string; assignedName: string }>>
  >;
  poolPaymentMethods: Record<string, "balance" | "chapa">;
  setPoolPaymentMethods: React.Dispatch<
    React.SetStateAction<Record<string, "balance" | "chapa">>
  >;
  groupMemberForms: Record<string, string>;
  setGroupMemberForms: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  openQrTickets: Record<string, boolean>;
  setOpenQrTickets: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  ticketShareLinks: Record<string, string>;
  bookingShareLinks: Record<string, string>;
  copiedShareTicketId: string | null;
  copiedShareBookingId: string | null;
  submittingItemId: string | null;
  onClaimTicket: (ticketId: string) => Promise<void>;
  onAssignTicket: (ticketId: string) => Promise<void>;
  onCreateBookingClaimLink: (bookingId: string) => Promise<void>;
  onCreateTicketClaimLink: (ticketId: string) => Promise<void>;
  onUnassignTicket: (ticketId: string) => Promise<void>;
  onContribute: (poolId: string, itemId: string, partyMemberId?: string) => Promise<void>;
  onCancelBooking: (bookingId: string) => Promise<void>;
  onAddGroupMember: (partyId: string, bookingId: string) => Promise<void>;
  onRemoveGroupMember: (partyId: string, memberId: string) => Promise<void>;
}) {
  const { item } = props;
  const submitting = props.submittingItemId === item.id;
  const primaryAction = item.primaryAction;
  const canEditGroupMembers = Boolean(
    item.purchaserCanManageTickets &&
      item.booking.party &&
      (item.booking.status === "CONFIRMED" ||
        !item.booking.paymentPool ||
        (item.booking.paymentPool.status === "PENDING" &&
          item.booking.paymentPool.amountPaid === 0)),
  );
  const groupIsLocked =
    Boolean(
      item.booking.party &&
        item.booking.paymentPool &&
        item.booking.paymentPool.status === "PENDING" &&
        item.booking.paymentPool.amountPaid > 0,
    );
  const mapUrl = buildGoogleMapsUrl({
    addressLabel: item.booking.slot.addressLabel,
    latitude: item.booking.slot.latitude,
    longitude: item.booking.slot.longitude,
  });
  const hasDetails =
    item.booking.tickets.length > 0 ||
    Boolean(item.booking.party) ||
    Boolean(item.booking.paymentPool);
  const poolShareableSeatCount = item.booking.tickets.filter(
    (ticket) =>
      ticket.status === "ASSIGNMENT_PENDING" &&
      !ticket.assignedUserId &&
      !ticket.assignedEmail &&
      !ticket.assignedName,
  ).length;
  const supportsPoolClaimLink = Boolean(
    item.purchaserCanManageTickets &&
      item.booking.productType === "MONTHLY" &&
      item.booking.status === "PENDING" &&
      item.booking.paymentPool?.status === "PENDING" &&
      item.booking.paymentPool.amountPaid === 0 &&
      poolShareableSeatCount > 0,
  );
  const bookingShareLink = props.bookingShareLinks[item.id] ?? "";
  const showPoolPaymentSelector = Boolean(
    item.booking.paymentPool?.status === "PENDING" &&
      item.purchaserCanManageTickets &&
      primaryAction.type !== "pay_share",
  );

  return (
    <Card className="space-y-5 p-4 sm:p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <Badge variant="accent">{formatProductTypeLabel(item.booking.productType)}</Badge>
            <Badge variant={item.section === "needs_action" ? "default" : "success"}>
              {formatBookingStatusLabel(item.booking.status)}
            </Badge>
            {item.booking.paymentPool ? (
              <Badge variant="default">
                {formatPoolStatusLabel(item.booking.paymentPool.status)}
              </Badge>
            ) : null}
          </div>

          <div className="space-y-1">
            <h3 className="text-xl font-semibold tracking-[-0.03em] text-[var(--color-text-primary)]">
              {item.title}
            </h3>
            <p className="text-sm text-[var(--color-text-secondary)]">{item.subtitle}</p>
            <p className="text-sm text-[var(--color-text-secondary)]">
              {item.booking.quantity} spot{item.booking.quantity === 1 ? "" : "s"} ·{" "}
              {formatCurrency(item.booking.totalAmount, item.booking.currency)}
            </p>
            {item.booking.slot.addressLabel || mapUrl ? (
              <div className="flex flex-wrap items-center gap-2 text-sm text-[var(--color-text-secondary)]">
                {item.booking.slot.addressLabel ? (
                  <span>{item.booking.slot.addressLabel}</span>
                ) : null}
                {mapUrl ? (
                  <a
                    href={mapUrl}
                    target="_blank"
                    rel="noreferrer"
                    className={cn(
                      buttonVariants("ghost", "sm"),
                      "h-auto min-h-0 px-2 py-1 text-xs",
                    )}
                  >
                    Open map
                  </a>
                ) : null}
              </div>
                ) : null}
            <p className="text-sm text-[var(--color-text-muted)]">{item.helperText}</p>
            {getBookingStatusHelper(item.booking.status) ? (
              <p className="text-xs leading-6 text-[var(--color-text-muted)]">
                What happens now: {getBookingStatusHelper(item.booking.status)}
              </p>
            ) : null}
          </div>
        </div>

        <div className="flex flex-col gap-2 sm:min-w-[220px]">
          {primaryAction.type === "pay_share" ? (
            <>
              <Select
                value={props.poolPaymentMethods[primaryAction.poolId] ?? "balance"}
                onChange={(event) =>
                  props.setPoolPaymentMethods((current) => ({
                    ...current,
                    [primaryAction.poolId]: event.target.value as "balance" | "chapa",
                  }))
                }
              >
                <option value="balance">Meda balance</option>
                <option value="chapa">Chapa</option>
              </Select>
              <Button
                type="button"
                className="w-full"
                disabled={submitting}
                onClick={() => void props.onContribute(primaryAction.poolId, item.id)}
              >
                {submitting ? "Processing..." : primaryAction.label}
              </Button>
              {hasDetails ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => props.setExpanded(!props.expanded)}
                >
                  {props.expanded ? "Hide details" : "More details"}
                </Button>
              ) : null}
            </>
          ) : primaryAction.type === "claim_ticket" ? (
            <>
              <Button
                type="button"
                className="w-full"
                disabled={props.submittingItemId === primaryAction.ticketId}
                onClick={() => void props.onClaimTicket(primaryAction.ticketId)}
              >
                {props.submittingItemId === primaryAction.ticketId
                  ? "Processing..."
                  : primaryAction.label}
              </Button>
              {hasDetails ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => props.setExpanded(!props.expanded)}
                >
                  {props.expanded ? "Hide details" : "More details"}
                </Button>
              ) : null}
            </>
          ) : primaryAction.type === "add_player_names" ? (
            <Button type="button" className="w-full" onClick={() => props.setExpanded(!props.expanded)}>
              {props.expanded ? "Hide player names" : primaryAction.label}
            </Button>
          ) : (
            <Button type="button" variant="secondary" className="w-full" onClick={() => props.setExpanded(!props.expanded)}>
              {props.expanded ? "Hide details" : primaryAction.label}
            </Button>
          )}

          {item.canCancel ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={submitting}
              onClick={() => void props.onCancelBooking(item.id)}
            >
              {submitting ? "Cancelling..." : "Cancel booking"}
            </Button>
          ) : null}
        </div>
      </div>

      {item.booking.paymentPool ? (
        <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-control-bg)] p-4">
          <div className="flex flex-col gap-2 text-sm text-[var(--color-text-secondary)]">
            <p className="font-medium text-[var(--color-text-primary)]">
              {getPoolStatusHelper(item.booking.paymentPool.status)}
            </p>
            <p>
              Group payment: {formatCurrency(item.booking.paymentPool.amountPaid, item.booking.currency)} /{" "}
              {formatCurrency(item.booking.paymentPool.totalAmount, item.booking.currency)}
            </p>
            <p>
              Remaining: {formatCurrency(item.booking.paymentPool.outstandingAmount, item.booking.currency)}
            </p>
            <p>Deadline: {new Date(item.booking.paymentPool.expiresAt).toLocaleString()}</p>
            <p className="rounded-[var(--radius-sm)] bg-white/5 px-3 py-2 text-xs leading-6 text-[var(--color-text-muted)]">
              Important: if time runs out before everyone pays, any money already paid goes
              back to each person&apos;s Meda balance automatically.
            </p>
            <p className="text-xs leading-6 text-[var(--color-text-muted)]">
              Organizer: keeps the group together and can edit members before money starts moving.
              Members: each person pays their own share before the deadline.
            </p>
            {showPoolPaymentSelector ? (
              <div className="grid gap-2 pt-2 sm:grid-cols-[220px_minmax(0,1fr)] sm:items-center">
                <Select
                  value={props.poolPaymentMethods[item.booking.paymentPool.id] ?? "balance"}
                  onChange={(event) =>
                    props.setPoolPaymentMethods((current) => ({
                      ...current,
                      [item.booking.paymentPool!.id]:
                        event.target.value as "balance" | "chapa",
                    }))
                  }
                >
                  <option value="balance">Meda balance</option>
                  <option value="chapa">Chapa</option>
                </Select>
                <p className="text-xs leading-6 text-[var(--color-text-muted)]">
                  This payment method is used when you pay a member&apos;s share on their behalf.
                </p>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      {item.booking.party ? (
        <div className="space-y-3 rounded-[var(--radius-md)] border border-[var(--color-border)] p-4">
          <div className="space-y-1">
            <p className="text-sm font-semibold text-[var(--color-text-primary)]">
              Group members
            </p>
            <p className="text-sm text-[var(--color-text-secondary)]">
              {item.booking.party.memberCount} / {item.booking.slot.capacity} spots filled
            </p>
            {groupIsLocked ? (
              <p className="text-xs leading-6 text-[var(--color-text-muted)]">
                This list locks after payments start. You can still change player names below.
              </p>
            ) : null}
          </div>

          <div className="grid gap-3">
            {item.booking.party.members
              .filter((member) => member.status !== "REMOVED")
              .map((member) => {
                const contribution = item.booking.paymentPool?.contributions.find(
                  (entry) => entry.partyMemberId === member.id,
                );
                const memberPaymentItemId = `pay:${member.id}`;
                const removable =
                  canEditGroupMembers &&
                  member.userId !== item.booking.party?.ownerId &&
                  item.booking.party?.ownerId !== member.userId;
                const payableByOrganizer = Boolean(
                  item.purchaserCanManageTickets &&
                    item.booking.paymentPool?.status === "PENDING" &&
                    contribution &&
                    contribution.status !== "PAID" &&
                    contribution.expectedAmount > contribution.paidAmount + 0.009 &&
                    member.userId !== item.booking.party?.ownerId,
                );

                return (
                  <div
                    key={member.id}
                    className="flex flex-col gap-3 rounded-[var(--radius-md)] border border-[var(--color-border)] p-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-[var(--color-text-primary)]">
                        {member.displayName || member.invitedEmail || "Group member"}
                      </p>
                      <p className="text-xs text-[var(--color-text-muted)]">
                        {member.invitedEmail ?? "Already on Meda"}
                        {contribution
                          ? ` · Share ${formatCurrency(
                              contribution.expectedAmount,
                              item.booking.currency,
                            )}`
                          : ""}
                      </p>
                    </div>

                    {payableByOrganizer || removable ? (
                      <div className="flex flex-wrap gap-2">
                        {payableByOrganizer ? (
                          <Button
                            type="button"
                            size="sm"
                            disabled={props.submittingItemId === memberPaymentItemId}
                            onClick={() =>
                              void props.onContribute(
                                item.booking.paymentPool!.id,
                                memberPaymentItemId,
                                member.id,
                              )
                            }
                          >
                            {props.submittingItemId === memberPaymentItemId
                              ? "Processing..."
                              : "Pay this share"}
                          </Button>
                        ) : null}
                        {removable ? (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            disabled={props.submittingItemId === member.id}
                            onClick={() =>
                              void props.onRemoveGroupMember(item.booking.party!.id, member.id)
                            }
                          >
                            {props.submittingItemId === member.id ? "Removing..." : "Remove"}
                          </Button>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                );
              })}
          </div>

          {canEditGroupMembers && item.booking.party.memberCount < item.booking.slot.capacity ? (
            <div className="grid gap-3 md:grid-cols-[1fr_auto]">
              <Input
                type="email"
                value={props.groupMemberForms[item.id] ?? ""}
                placeholder="Add another player by email"
                onChange={(event) =>
                  props.setGroupMemberForms((current) => ({
                    ...current,
                    [item.id]: event.target.value,
                  }))
                }
              />
              <Button
                type="button"
                disabled={submitting}
                onClick={() => void props.onAddGroupMember(item.booking.party!.id, item.id)}
              >
                {submitting ? "Adding..." : "Add member"}
              </Button>
            </div>
          ) : null}
        </div>
      ) : null}

      {props.expanded && item.booking.tickets.length > 0 ? (
        <div className="space-y-3">
          {supportsPoolClaimLink ? (
            <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-control-bg)] p-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div className="space-y-1">
                  <p className="text-sm font-medium text-[var(--color-text-primary)]">
                    Share one claim link for the whole pool
                  </p>
                  <p className="text-xs leading-6 text-[var(--color-text-muted)]">
                    Each person who claims this link takes one open spot and gets their own payment
                    share in Tickets. {poolShareableSeatCount} open seat
                    {poolShareableSeatCount === 1 ? "" : "s"} remaining.
                  </p>
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  disabled={props.submittingItemId === item.id}
                  onClick={() => void props.onCreateBookingClaimLink(item.id)}
                >
                  {props.submittingItemId === item.id
                    ? "Creating..."
                    : props.copiedShareBookingId === item.id
                      ? "Copied"
                      : "Create pool claim link"}
                </Button>
              </div>
              {bookingShareLink ? (
                <div className="mt-3 grid gap-2 md:grid-cols-[1fr_auto]">
                  <Input value={bookingShareLink} readOnly />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={props.submittingItemId === item.id}
                    onClick={() => void props.onCreateBookingClaimLink(item.id)}
                  >
                    {props.copiedShareBookingId === item.id ? "Copied" : "Copy again"}
                  </Button>
                </div>
              ) : null}
            </div>
          ) : null}
          <div className="space-y-1">
            <p className="text-sm font-semibold text-[var(--color-text-primary)]">Player names</p>
            <p className="text-xs leading-6 text-[var(--color-text-muted)]">
              Default for families: type the player&apos;s name and leave the email blank to keep
              that ticket under your account. Add an email only if that person should sign in and
              hold their own ticket in Meda.
            </p>
          </div>
          <div className="grid gap-3">
            {item.booking.tickets.map((ticket, index) => {
              const form = props.ticketForms[ticket.id] ?? {
                assignedEmail: ticket.assignedEmail ?? "",
                assignedName: ticket.assignedName ?? "",
              };
              const claimable = item.claimableTicketIds.includes(ticket.id);
              const shareable =
                !supportsPoolClaimLink &&
                item.purchaserCanManageTickets &&
                ticket.status === "ASSIGNMENT_PENDING" &&
                !ticket.assignedUserId &&
                !ticket.assignedEmail &&
                !ticket.assignedName;
              const shareLink = props.ticketShareLinks[ticket.id] ?? "";

              return (
                <div
                  key={ticket.id}
                  className="rounded-[var(--radius-md)] border border-[var(--color-border)] p-4"
                >
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div className="space-y-2">
                      <div className="flex flex-wrap gap-2">
                        <Badge variant="default">Seat {index + 1}</Badge>
                        <Badge variant={ticket.status === "CHECKED_IN" ? "success" : "default"}>
                          {formatTicketStatusLabel(ticket.status)}
                        </Badge>
                      </div>
                      <p className="text-sm text-[var(--color-text-secondary)]">
                        {ticket.assigneeDisplayName || ticket.assignedEmail || "No player name yet"}
                      </p>
                      {getTicketStatusHelper(ticket.status) ? (
                        <p className="text-xs leading-6 text-[var(--color-text-muted)]">
                          {getTicketStatusHelper(ticket.status)}
                        </p>
                      ) : null}
                      {ticket.assignedName && !ticket.assignedEmail && !ticket.assignedUserId ? (
                        <p className="text-xs leading-6 text-[var(--color-text-muted)]">
                          Managed under your account as a dependent ticket.
                        </p>
                      ) : null}
                    </div>

                    {claimable ? (
                      <div className="flex flex-wrap gap-2">
                        <Button
                          type="button"
                          size="sm"
                          disabled={props.submittingItemId === ticket.id}
                          onClick={() => void props.onClaimTicket(ticket.id)}
                        >
                          {props.submittingItemId === ticket.id ? "Processing..." : "Claim ticket"}
                        </Button>
                        {(item.booking.status === "CONFIRMED" ||
                          item.booking.status === "COMPLETED") &&
                        ticket.status !== "ASSIGNMENT_PENDING" ? (
                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            onClick={() =>
                              props.setOpenQrTickets((current) => ({
                                ...current,
                                [ticket.id]: !current[ticket.id],
                              }))
                            }
                          >
                            {props.openQrTickets[ticket.id] ? "Hide QR" : "Show QR"}
                          </Button>
                        ) : null}
                      </div>
                    ) : (item.booking.status === "CONFIRMED" ||
                        item.booking.status === "COMPLETED") &&
                      ticket.status !== "ASSIGNMENT_PENDING" ? (
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={() =>
                          props.setOpenQrTickets((current) => ({
                            ...current,
                            [ticket.id]: !current[ticket.id],
                          }))
                        }
                      >
                        {props.openQrTickets[ticket.id] ? "Hide QR" : "Show QR"}
                      </Button>
                    ) : null}
                  </div>

                  {props.openQrTickets[ticket.id] ? (
                    <div className="mt-4 flex flex-col items-start gap-3 rounded-[var(--radius-md)] bg-[var(--color-control-bg)] p-3">
                      <Image
                        src={`/api/tickets/${ticket.id}/qr`}
                        alt={`QR code for seat ${index + 1}`}
                        width={144}
                        height={144}
                        unoptimized
                        className="rounded-xl border border-[var(--color-border)] bg-white p-2"
                      />
                      <p className="text-xs leading-6 text-[var(--color-text-muted)]">
                        This QR works only after the booking is fully paid and the player name is saved.
                      </p>
                    </div>
                  ) : null}

                  {item.purchaserCanManageTickets && ticket.status !== "CHECKED_IN" ? (
                    <div className="mt-4 space-y-2">
                      <div className="grid gap-3 md:grid-cols-[1fr_1fr_auto_auto]">
                        <Input
                          value={form.assignedName}
                          placeholder="Player or dependent name"
                          onChange={(event) =>
                            props.setTicketForms((current) => ({
                              ...current,
                              [ticket.id]: {
                                ...form,
                                assignedName: event.target.value,
                              },
                            }))
                          }
                        />
                        <Input
                          type="email"
                          value={form.assignedEmail}
                          placeholder="Email only if they need their own Meda login"
                          onChange={(event) =>
                            props.setTicketForms((current) => ({
                              ...current,
                              [ticket.id]: {
                                ...form,
                                assignedEmail: event.target.value,
                              },
                            }))
                          }
                        />
                        <Button
                          type="button"
                          size="sm"
                          disabled={props.submittingItemId === ticket.id}
                          onClick={() => void props.onAssignTicket(ticket.id)}
                        >
                          {props.submittingItemId === ticket.id ? "Saving..." : "Save player"}
                        </Button>
                        {(ticket.assignedEmail || ticket.assignedUserId || ticket.assignedName) ? (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            disabled={props.submittingItemId === ticket.id}
                            onClick={() => void props.onUnassignTicket(ticket.id)}
                          >
                            Remove
                          </Button>
                        ) : null}
                      </div>
                      <p className="text-xs leading-6 text-[var(--color-text-muted)]">
                        Leave the email blank for your child or another dependent. That ticket will
                        stay under your account and still get its own QR code.
                      </p>
                      {shareable ? (
                        <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-control-bg)] p-3">
                          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                            <div className="space-y-1">
                              <p className="text-sm font-medium text-[var(--color-text-primary)]">
                                Or send a claim link
                              </p>
                              <p className="text-xs leading-6 text-[var(--color-text-muted)]">
                                Anyone with this link can sign in, or create an account first, then
                                claim this ticket into their own Meda account.
                              </p>
                            </div>
                            <Button
                              type="button"
                              variant="secondary"
                              size="sm"
                              disabled={props.submittingItemId === ticket.id}
                              onClick={() => void props.onCreateTicketClaimLink(ticket.id)}
                            >
                              {props.submittingItemId === ticket.id
                                ? "Creating..."
                                : props.copiedShareTicketId === ticket.id
                                  ? "Copied"
                                  : "Create claim link"}
                            </Button>
                          </div>
                          {shareLink ? (
                            <div className="mt-3 grid gap-2 md:grid-cols-[1fr_auto]">
                              <Input value={shareLink} readOnly />
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                disabled={props.submittingItemId === ticket.id}
                                onClick={() => void props.onCreateTicketClaimLink(ticket.id)}
                              >
                                {props.copiedShareTicketId === ticket.id ? "Copied" : "Copy again"}
                              </Button>
                            </div>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      ) : null}
    </Card>
  );
}

function EventTicketCard({ item }: { item: EventHubItem }) {
  return (
    <Card className="space-y-4 p-4 sm:p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-2">
          <div className="flex flex-wrap gap-2">
            <Badge variant="accent">Match</Badge>
            <Badge variant={item.section === "past" ? "default" : "success"}>
              {item.statusLabel}
            </Badge>
          </div>
          <h3 className="text-xl font-semibold tracking-[-0.03em] text-[var(--color-text-primary)]">
            {item.title}
          </h3>
          <p className="text-sm text-[var(--color-text-secondary)]">{item.subtitle}</p>
          {item.locationLabel || item.mapUrl ? (
            <div className="flex flex-wrap items-center gap-2 text-sm text-[var(--color-text-secondary)]">
              {item.locationLabel ? <span>{item.locationLabel}</span> : null}
              {item.mapUrl ? (
                <a
                  href={item.mapUrl}
                  target="_blank"
                  rel="noreferrer"
                  className={cn(
                    buttonVariants("ghost", "sm"),
                    "h-auto min-h-0 px-2 py-1 text-xs",
                  )}
                >
                  Open map
                </a>
              ) : null}
            </div>
          ) : null}
          <p className="text-sm text-[var(--color-text-secondary)]">
            {item.ticketCount} ticket{item.ticketCount === 1 ? "" : "s"}
            {item.checkedInCount > 0 ? ` · ${item.checkedInCount} checked in` : ""}
          </p>
          <p className="text-sm text-[var(--color-text-muted)]">{item.helperText}</p>
        </div>

        <Link
          href={item.href}
          className={cn(buttonVariants("secondary", "md"), "inline-flex rounded-full")}
        >
          {item.primaryAction.label}
        </Link>
      </div>
    </Card>
  );
}

function SummaryPill({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-full border border-[rgba(125,211,252,0.18)] bg-[rgba(255,255,255,0.04)] px-4 py-2 text-sm text-[var(--color-text-secondary)]">
      <span className="font-semibold text-[var(--color-text-primary)]">{value}</span> {label}
    </div>
  );
}
