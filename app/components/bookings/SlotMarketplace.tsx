"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Card } from "@/app/components/ui/card";
import { Badge } from "@/app/components/ui/badge";
import { Button, buttonVariants } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { Select } from "@/app/components/ui/select";
import { Textarea } from "@/app/components/ui/textarea";
import { useConfirmDialog } from "@/app/components/ui/confirm-dialog";
import { OverlayPortal } from "@/app/components/ui/overlay-portal";
import { browserApi, BrowserApiError } from "@/lib/browserApi";
import { getErrorMessage } from "@/lib/errorMessage";
import { authClient } from "@/lib/auth/client";
import { cn } from "@/app/components/ui/cn";
import { computeTicketChargeBreakdown } from "@/lib/ticketPricing";
import { buildGoogleMapsUrl } from "@/lib/location";
import { formatProductTypeLabel, uiCopy } from "@/lib/uiCopy";

const PUBLIC_SLOT_LOOKAHEAD_DAYS = 180;
const SlotLocationsMap = dynamic(() => import("./SlotLocationsMap"), { ssr: false });

type SlotSummary = {
  id: string;
  pitchId: string;
  pitchName: string;
  addressLabel: string | null;
  latitude: number | null;
  longitude: number | null;
  categoryName: string;
  startsAt: string;
  endsAt: string;
  capacity: number;
  price: number;
  currency: string;
  productType: "DAILY" | "MONTHLY";
  status: "OPEN" | "RESERVED" | "BOOKED" | "BLOCKED" | "CANCELLED";
  requiresParty: boolean;
  notes: string | null;
  bookingCount: number;
  soldQuantity: number;
  remainingCapacity: number;
};

type PartySummary = {
  id: string;
  name: string | null;
  status: string;
  members: Array<{
    id: string;
    displayName: string;
    invitedEmail: string | null;
    status: string;
  }>;
};

type SlotOffer = {
  key: string;
  pitchId: string;
  pitchName: string;
  addressLabel: string | null;
  latitude: number | null;
  longitude: number | null;
  categoryName: string;
  productType: "DAILY" | "MONTHLY";
  capacity: number;
  price: number;
  currency: string;
  requiresParty: boolean;
  notes: string | null;
  slots: SlotSummary[];
  bookingCount: number;
  dayOptions: Array<{
    dateKey: string;
    startsAt: string;
    label: string;
    count: number;
  }>;
};

function formatCurrency(value: number, currency = "ETB") {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(value);
}

function getSlotDisplayPrice(slot: Pick<SlotSummary, "productType" | "price" | "capacity">) {
  return slot.productType === "MONTHLY" ? slot.price * slot.capacity : slot.price;
}

function getSlotChargeBreakdown(
  slot: Pick<SlotSummary, "price" | "capacity" | "productType">,
  quantity?: number,
) {
  const effectiveQuantity = quantity ?? (slot.productType === "MONTHLY" ? slot.capacity : 1);
  return computeTicketChargeBreakdown({
    unitPriceEtb: slot.price,
    quantity: effectiveQuantity,
  });
}

function getSlotOfferKey(slot: SlotSummary) {
  return [
    slot.pitchId,
    slot.productType,
    slot.categoryName,
    String(slot.capacity),
    String(slot.price),
    slot.currency,
    slot.requiresParty ? "group" : "solo",
    slot.notes?.trim().toLowerCase() ?? "",
  ].join("::");
}

function getSlotDayKey(startsAt: string) {
  const date = new Date(startsAt);
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

function formatSlotDayLabel(startsAt: string, short = false) {
  return new Date(startsAt).toLocaleDateString(undefined, {
    weekday: short ? "short" : "long",
    month: short ? "short" : "long",
    day: "numeric",
  });
}

function formatSlotTimeRange(slot: Pick<SlotSummary, "startsAt" | "endsAt">) {
  return `${new Date(slot.startsAt).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  })} - ${new Date(slot.endsAt).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  })}`;
}

function buildOfferCards(slots: SlotSummary[]) {
  const sortedSlots = [...slots].sort(
    (left, right) => new Date(left.startsAt).getTime() - new Date(right.startsAt).getTime(),
  );
  const grouped = new Map<string, SlotOffer>();

  for (const slot of sortedSlots) {
    const key = getSlotOfferKey(slot);
    const existing = grouped.get(key);
    if (existing) {
      existing.slots.push(slot);
      existing.bookingCount += slot.bookingCount;
      continue;
    }

    grouped.set(key, {
      key,
      pitchId: slot.pitchId,
      pitchName: slot.pitchName,
      addressLabel: slot.addressLabel,
      latitude: slot.latitude,
      longitude: slot.longitude,
      categoryName: slot.categoryName,
      productType: slot.productType,
      capacity: slot.capacity,
      price: slot.price,
      currency: slot.currency,
      requiresParty: slot.requiresParty,
      notes: slot.notes,
      slots: [slot],
      bookingCount: slot.bookingCount,
      dayOptions: [],
    });
  }

  const offers = Array.from(grouped.values());
  for (const offer of offers) {
    const dayMap = new Map<
      string,
      { dateKey: string; startsAt: string; label: string; count: number }
    >();
    for (const slot of offer.slots) {
      const dateKey = getSlotDayKey(slot.startsAt);
      const existing = dayMap.get(dateKey);
      if (existing) {
        existing.count += 1;
      } else {
        dayMap.set(dateKey, {
          dateKey,
          startsAt: slot.startsAt,
          label: formatSlotDayLabel(slot.startsAt, true),
          count: 1,
        });
      }
    }

    offer.dayOptions = Array.from(dayMap.values()).sort(
      (left, right) => new Date(left.startsAt).getTime() - new Date(right.startsAt).getTime(),
    );
  }

  return offers;
}

function getOfferPriceLabel(
  offer: Pick<SlotOffer, "productType" | "price" | "capacity" | "currency">,
) {
  if (offer.productType === "MONTHLY") {
    const pricing = getSlotChargeBreakdown(offer);
    return `${formatCurrency(pricing.totalAmountEtb, offer.currency)} full pitch`;
  }
  const pricing = getSlotChargeBreakdown(offer, 1);
  return `${formatCurrency(pricing.totalAmountEtb, offer.currency)} per spot`;
}

function getOfferNextAvailableLabel(offer: Pick<SlotOffer, "slots">) {
  const nextSlot = [...offer.slots].sort(
    (left, right) => new Date(left.startsAt).getTime() - new Date(right.startsAt).getTime(),
  )[0];
  if (!nextSlot) return null;
  return `${formatSlotDayLabel(nextSlot.startsAt)} · ${formatSlotTimeRange(nextSlot)}`;
}

export function SlotMarketplace() {
  const router = useRouter();
  const reserveWholePitchDialog = useConfirmDialog();
  const { data: sessionData } = authClient.useSession();
  const currentUser = (sessionData?.user ?? null) as {
    id?: string;
    email?: string | null;
  } | null;

  const [slots, setSlots] = useState<SlotSummary[]>([]);
  const [groups, setGroups] = useState<PartySummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [selectedSlotId, setSelectedSlotId] = useState<string>("");
  const [productFilter, setProductFilter] = useState<"ALL" | "DAILY" | "MONTHLY">("ALL");
  const [quantity, setQuantity] = useState("1");
  const [paymentMethod, setPaymentMethod] = useState<"balance" | "chapa">("chapa");
  const [selectedGroupId, setSelectedGroupId] = useState("");
  const [groupName, setGroupName] = useState("");
  const [memberEmails, setMemberEmails] = useState("");
  const [selectedDayByOffer, setSelectedDayByOffer] = useState<Record<string, string>>({});
  const [isMapOpen, setIsMapOpen] = useState(false);
  const [focusedOfferKey, setFocusedOfferKey] = useState<string | null>(null);

  const discoverableSlots = useMemo(
    () =>
      slots.filter(
        (slot) =>
          slot.productType !== "MONTHLY" ||
          (slot.status === "OPEN" && slot.remainingCapacity >= slot.capacity),
      ),
    [slots],
  );

  const filteredSlots = useMemo(
    () =>
      discoverableSlots.filter((slot) =>
        productFilter === "ALL" ? true : slot.productType === productFilter,
      ),
    [discoverableSlots, productFilter],
  );

  const offerCards = useMemo(() => buildOfferCards(filteredSlots), [filteredSlots]);

  const selectedSlot =
    filteredSlots.find((slot) => slot.id === selectedSlotId) ??
    discoverableSlots.find((slot) => slot.id === selectedSlotId) ??
    null;
  const selectedOffer =
    offerCards.find((offer) => offer.slots.some((slot) => slot.id === selectedSlotId)) ??
    offerCards[0] ??
    null;
  const selectedGroup = groups.find((group) => group.id === selectedGroupId) ?? null;
  const mappableOffers = useMemo(
    () =>
      offerCards.filter(
        (offer) =>
          (typeof offer.latitude === "number" && Number.isFinite(offer.latitude)) ||
          (typeof offer.longitude === "number" && Number.isFinite(offer.longitude)) ||
          Boolean(offer.addressLabel?.trim()),
      ),
    [offerCards],
  );

  const monthlyPreview = useMemo(() => {
    if (!selectedSlot || selectedSlot.productType !== "MONTHLY") return null;

    const normalizedCurrentUserEmail = currentUser?.email?.trim().toLowerCase() ?? "";
    const invitedEmails = [
      ...new Set(
        memberEmails
          .split(/[,\n]/)
          .map((email) => email.trim())
          .filter(Boolean)
          .map((email) => email.toLowerCase()),
      ),
    ].filter((email) => email !== normalizedCurrentUserEmail);
    const memberCount = selectedGroup ? selectedGroup.members.length : 1 + invitedEmails.length;
    const pricing = getSlotChargeBreakdown(selectedSlot);
    const totalAmount = pricing.totalAmountEtb;
    const extraMemberCount = Math.max(0, memberCount - 1);
    const perAddedMemberAmount = pricing.perTicketTotalEtb;
    const organizerAmount = Math.max(0, totalAmount - perAddedMemberAmount * extraMemberCount);

    return {
      memberCount,
      ticketSubtotal: pricing.ticketSubtotalEtb,
      surchargeTotal: pricing.surchargeTotalEtb,
      totalAmount,
      organizerAmount,
      perAddedMemberAmount,
      isTooLarge: memberCount > selectedSlot.capacity,
      deadlineLabel: "1 hour after you create the booking",
    };
  }, [currentUser?.email, memberEmails, selectedGroup, selectedSlot]);

  const dailyPreview = useMemo(() => {
    if (!selectedSlot || selectedSlot.productType !== "DAILY") return null;
    const selectedQuantity = Math.max(1, Number(quantity) || 1);
    return getSlotChargeBreakdown(selectedSlot, selectedQuantity);
  }, [quantity, selectedSlot]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      try {
        const now = new Date();
        const to = new Date(now.getTime() + PUBLIC_SLOT_LOOKAHEAD_DAYS * 24 * 60 * 60 * 1000);
        const data = await browserApi.get<{ slots?: SlotSummary[] }>(
          `/api/slots?from=${encodeURIComponent(now.toISOString())}&to=${encodeURIComponent(
            to.toISOString(),
          )}`,
          { cache: "no-store" },
        );
        if (!cancelled) {
          const nextSlots = data.slots ?? [];
          setSlots(nextSlots);
          setSelectedSlotId((current) => current || nextSlots[0]?.id || "");
        }
      } catch (error) {
        if (!cancelled) {
          toast.error(getErrorMessage(error) || "Failed to load booking times");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    async function loadGroups() {
      try {
        const data = await browserApi.get<{ parties?: PartySummary[] }>("/api/parties", {
          cache: "no-store",
        });
        if (!cancelled) {
          setGroups(data.parties ?? []);
        }
      } catch (error) {
        if (!(error instanceof BrowserApiError) || error.status !== 401) {
          toast.error(getErrorMessage(error) || "Failed to load your saved groups");
        }
      }
    }

    void Promise.all([load(), loadGroups()]);

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (offerCards.length === 0) {
      if (selectedSlotId) {
        setSelectedSlotId("");
      }
      return;
    }

    const hasSelectedSlot = offerCards.some((offer) =>
      offer.slots.some((slot) => slot.id === selectedSlotId),
    );
    if (hasSelectedSlot) return;

    const firstOffer = offerCards[0];
    const defaultDayKey =
      selectedDayByOffer[firstOffer.key] ?? firstOffer.dayOptions[0]?.dateKey ?? "";
    const nextSlotId =
      firstOffer.slots.find((slot) => getSlotDayKey(slot.startsAt) === defaultDayKey)?.id ??
      firstOffer.slots[0]?.id ??
      "";
    if (nextSlotId) {
      setSelectedSlotId(nextSlotId);
    }
  }, [offerCards, selectedDayByOffer, selectedSlotId]);

  useEffect(() => {
    if (offerCards.length === 0) return;

    setSelectedDayByOffer((current) => {
      let changed = false;
      const next = { ...current };

      for (const offer of offerCards) {
        const availableDayKeys = new Set(offer.dayOptions.map((option) => option.dateKey));
        const currentDay = next[offer.key];
        if (!currentDay || !availableDayKeys.has(currentDay)) {
          next[offer.key] = offer.dayOptions[0]?.dateKey ?? "";
          changed = true;
        }
      }

      return changed ? next : current;
    });
  }, [offerCards]);

  useEffect(() => {
    if (!selectedSlot || !selectedOffer) return;
    const selectedDayKey = getSlotDayKey(selectedSlot.startsAt);
    if (selectedDayByOffer[selectedOffer.key] === selectedDayKey) return;

    setSelectedDayByOffer((current) => ({
      ...current,
      [selectedOffer.key]: selectedDayKey,
    }));
  }, [selectedOffer, selectedDayByOffer, selectedSlot]);

  async function handleCreateBooking() {
    if (!selectedSlot) return;
    if (!currentUser?.id) {
      router.push("/auth/sign-in?redirect=%2Fplay%3Fmode%3Dslots");
      return;
    }

    setSubmitting(true);
    try {
      if (selectedSlot.productType === "DAILY") {
        const result = await browserApi.post<{
          checkoutUrl?: string | null;
          booking?: { id: string };
        }>("/api/bookings/daily", {
          slotId: selectedSlot.id,
          quantity: Math.max(1, Number(quantity) || 1),
          paymentMethod,
        });

        if (result.checkoutUrl) {
          window.location.href = result.checkoutUrl;
          return;
        }

        toast.success("Booking confirmed.");
        router.push("/tickets");
        return;
      }

      const normalizedCurrentUserEmail = currentUser.email?.trim().toLowerCase() ?? "";
      const emails = [
        ...new Set(
          memberEmails
            .split(/[,\n]/)
            .map((email) => email.trim())
            .filter(Boolean)
            .map((email) => email.toLowerCase()),
        ),
      ].filter((email) => email !== normalizedCurrentUserEmail);

      if (monthlyPreview?.isTooLarge) {
        toast.error(`This booking only fits ${selectedSlot.capacity} players.`);
        return;
      }

      await browserApi.post("/api/bookings/monthly", {
        slotId: selectedSlot.id,
        partyId: selectedGroupId || undefined,
        partyName: selectedGroupId ? undefined : groupName || undefined,
        memberEmails: selectedGroupId ? [] : emails,
      });

      toast.success("Group booking created. Finish the group payment in Tickets.");
      router.push("/tickets");
    } catch (error) {
      toast.error(getErrorMessage(error) || "Failed to create booking");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSubmitBooking() {
    if (selectedSlot?.productType === "MONTHLY") {
      const confirmed = await reserveWholePitchDialog.confirm({
        title: "Before you reserve the whole pitch",
        description:
          "Anyone you enter with an email will need a Meda account using that exact same email so their invite, payment share, and ticket match correctly. If this booking includes your child or another dependent under your own account, do not add their email here. You can save just their name later in Tickets.",
        confirmLabel: "I understand",
        cancelLabel: "Go back",
      });

      if (!confirmed) {
        return;
      }
    }

    await handleCreateBooking();
  }

  function selectOfferFromMap(offerKey: string) {
    const offer = offerCards.find((entry) => entry.key === offerKey);
    if (!offer) return;

    const preferredDayKey = selectedDayByOffer[offer.key] ?? offer.dayOptions[0]?.dateKey ?? "";
    const nextSlot =
      offer.slots.find((slot) => getSlotDayKey(slot.startsAt) === preferredDayKey) ??
      offer.slots[0];
    if (!nextSlot) return;

    setFocusedOfferKey(offer.key);
    setSelectedDayByOffer((current) => ({
      ...current,
      [offer.key]: preferredDayKey || getSlotDayKey(nextSlot.startsAt),
    }));
    setSelectedSlotId(nextSlot.id);
  }

  return (
    <>
      <div className="grid gap-3 lg:gap-6 xl:grid-cols-[minmax(0,1.1fr)_380px]">
        <Card className="space-y-4 p-3 sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="space-y-2">
              <p className="heading-kicker">{uiCopy.play.playNow}</p>
              <h2 className="section-title">Pick a time and book it.</h2>
              <p className="text-sm leading-7 text-[var(--color-text-secondary)]">
                Each card below is one booking offer. Choose a day, then pick the 2-hour time that
                works for you.
              </p>
            </div>

            <div className="flex w-full flex-wrap gap-2 sm:w-auto sm:justify-end">
              {mappableOffers.length > 0 ? (
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="rounded-full"
                  onClick={() => {
                    setFocusedOfferKey(selectedOffer?.key ?? mappableOffers[0]?.key ?? null);
                    setIsMapOpen(true);
                  }}
                >
                  See places on map
                </Button>
              ) : null}
              {(
                [
                  ["ALL", "All times"],
                  ["DAILY", "Single visit"],
                  ["MONTHLY", "Monthly group"],
                ] as const
              ).map(([value, label]) => (
                <Button
                  key={value}
                  type="button"
                  variant={productFilter === value ? "primary" : "secondary"}
                  size="sm"
                  className="min-h-11 flex-1 rounded-full sm:flex-none"
                  onClick={() => setProductFilter(value)}
                >
                  {label}
                </Button>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap gap-2 text-sm text-[var(--color-text-secondary)]">
            <StepChip index={1} label="Choose a place" active />
            <StepChip index={2} label="Choose a day" active={Boolean(selectedOffer)} />
            <StepChip index={3} label="Pick a 2-hour time" active={Boolean(selectedSlot)} />
            <StepChip index={4} label="Pay and finish" active={Boolean(selectedSlot)} />
          </div>

          {loading ? (
            <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] px-4 py-10 text-center text-sm text-[var(--color-text-secondary)]">
              Loading booking times...
            </div>
          ) : offerCards.length === 0 ? (
            <div className="rounded-[var(--radius-md)] border border-dashed border-[var(--color-border)] px-4 py-10 text-center text-sm text-[var(--color-text-secondary)]">
              No booking times are open in the next {PUBLIC_SLOT_LOOKAHEAD_DAYS} days.
            </div>
          ) : (
            <div className="grid gap-3">
              {offerCards.map((offer) => {
                const selectedDayKey =
                  selectedDayByOffer[offer.key] ?? offer.dayOptions[0]?.dateKey ?? "";
                const daySlots = offer.slots.filter(
                  (slot) => getSlotDayKey(slot.startsAt) === selectedDayKey,
                );
                const isOfferSelected = offer.slots.some((slot) => slot.id === selectedSlotId);
                const selectedOfferSlot =
                  daySlots.find((slot) => slot.id === selectedSlotId) ??
                  daySlots[0] ??
                  offer.slots[0];

                return (
                  <div
                    key={offer.key}
                    className={`rounded-[22px] border p-3.5 sm:p-5 transition ${
                      isOfferSelected
                        ? "border-[rgba(125,211,252,0.4)] bg-[linear-gradient(180deg,rgba(125,211,252,0.12),rgba(125,211,252,0.05))]"
                        : "border-[var(--color-border)] bg-[rgba(255,255,255,0.025)]"
                    }`}
                  >
                    <div className="space-y-3 sm:space-y-4">
                      <div className="flex flex-col gap-3 sm:gap-4 lg:flex-row lg:items-start lg:justify-between">
                        <div className="space-y-2.5 sm:space-y-3">
                          <div className="flex flex-wrap gap-2">
                            <Badge variant="accent">
                              {formatProductTypeLabel(offer.productType)}
                            </Badge>
                            {offer.requiresParty ? (
                              <Badge variant="default">Group required</Badge>
                            ) : null}
                            <Badge variant="default">{offer.categoryName}</Badge>
                          </div>

                          <div className="space-y-1">
                            <p className="text-lg font-semibold text-[var(--color-text-primary)]">
                              {offer.pitchName}
                            </p>
                            <p className="text-sm text-[var(--color-text-secondary)]">
                              {offer.slots.length} open 2-hour time
                              {offer.slots.length === 1 ? "" : "s"} across {offer.dayOptions.length}{" "}
                              day
                              {offer.dayOptions.length === 1 ? "" : "s"}.
                            </p>
                            {getOfferNextAvailableLabel(offer) ? (
                              <p className="text-sm text-[var(--color-text-muted)]">
                                Next open: {getOfferNextAvailableLabel(offer)}
                              </p>
                            ) : null}
                            {offer.addressLabel ? (
                              <p className="text-sm text-[var(--color-text-muted)]">
                                {offer.addressLabel}
                              </p>
                            ) : null}
                          </div>

                          <div className="flex flex-wrap gap-3 text-sm text-[var(--color-text-secondary)]">
                            <span>
                              {offer.productType === "MONTHLY"
                                ? `Whole pitch for up to ${offer.capacity} players`
                                : `${selectedOfferSlot?.remainingCapacity ?? offer.capacity} of ${offer.capacity} spots left in the selected time`}
                            </span>
                            <span>
                              {offer.bookingCount} booking{offer.bookingCount === 1 ? "" : "s"} so
                              far
                            </span>
                          </div>
                        </div>

                        <div className="flex min-w-[170px] flex-col items-start gap-2.5 sm:gap-3 lg:items-end">
                          <p className="text-xl font-semibold text-[var(--color-text-primary)]">
                            {getOfferPriceLabel(offer)}
                          </p>
                          <span className="text-sm text-[var(--color-text-muted)]">
                            Choose a day, then pick a 2-hour time
                          </span>
                          <div className="flex flex-wrap gap-2">
                            {buildGoogleMapsUrl({
                              addressLabel: offer.addressLabel,
                              latitude: offer.latitude,
                              longitude: offer.longitude,
                            }) ? (
                              <a
                                href={
                                  buildGoogleMapsUrl({
                                    addressLabel: offer.addressLabel,
                                    latitude: offer.latitude,
                                    longitude: offer.longitude,
                                  })!
                                }
                                target="_blank"
                                rel="noreferrer"
                                className={buttonVariants("ghost", "sm")}
                              >
                                Open map
                              </a>
                            ) : null}
                            {mappableOffers.some((entry) => entry.key === offer.key) ? (
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  selectOfferFromMap(offer.key);
                                  setIsMapOpen(true);
                                }}
                              >
                                View on map
                              </Button>
                            ) : null}
                          </div>
                        </div>
                      </div>

                      <div className="grid gap-3 lg:grid-cols-[220px_minmax(0,1fr)]">
                        <label className="block">
                          <span className="field-label">Day</span>
                          <Select
                            value={selectedDayKey}
                            onChange={(event) => {
                              const nextDayKey = event.target.value;
                              setSelectedDayByOffer((current) => ({
                                ...current,
                                [offer.key]: nextDayKey,
                              }));
                              const nextSlot =
                                offer.slots.find(
                                  (slot) => getSlotDayKey(slot.startsAt) === nextDayKey,
                                ) ?? offer.slots[0];
                              if (nextSlot) {
                                setSelectedSlotId(nextSlot.id);
                              }
                            }}
                          >
                            {offer.dayOptions.map((day) => (
                              <option key={day.dateKey} value={day.dateKey}>
                                {day.label} ({day.count} time{day.count === 1 ? "" : "s"})
                              </option>
                            ))}
                          </Select>
                        </label>

                        <div className="space-y-2">
                          <p className="field-label">2-hour times</p>
                          <div className="flex flex-wrap gap-2">
                            {daySlots.map((slot) => (
                              <Button
                                key={slot.id}
                                type="button"
                                variant={selectedSlotId === slot.id ? "primary" : "secondary"}
                                size="sm"
                                className="min-h-11 rounded-full"
                                onClick={() => setSelectedSlotId(slot.id)}
                              >
                                {formatSlotTimeRange(slot)}
                              </Button>
                            ))}
                          </div>
                        </div>
                      </div>

                      {offer.notes ? (
                        <p className="text-sm text-[var(--color-text-muted)]">{offer.notes}</p>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        <Card className="space-y-4 p-3 sm:p-6 xl:sticky xl:top-[calc(var(--header-height)+24px)]">
          <div className="space-y-2">
            <p className="heading-kicker">Next step</p>
            <h2 className="section-title">
              {selectedSlot?.productType === "MONTHLY"
                ? "Start a monthly group booking"
                : "Reserve this time"}
            </h2>
            <p className="text-sm leading-7 text-[var(--color-text-secondary)]">
              {selectedSlot
                ? `You are booking ${selectedSlot.pitchName} on ${new Date(
                    selectedSlot.startsAt,
                  ).toLocaleString()}.`
                : "Choose a booking time above to continue."}
            </p>
          </div>

          {!selectedSlot ? (
            <div className="rounded-[var(--radius-md)] border border-dashed border-[var(--color-border)] px-4 py-8 text-sm text-[var(--color-text-secondary)]">
              Choose a booking time to keep going.
            </div>
          ) : (
            <div className="space-y-3 sm:space-y-4">
              <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-control-bg)] p-3 sm:p-4">
                <div className="flex flex-wrap gap-2">
                  <Badge variant="accent">{formatProductTypeLabel(selectedSlot.productType)}</Badge>
                  <Badge variant="default">{selectedSlot.status}</Badge>
                </div>
                <p className="mt-3 text-lg font-semibold text-[var(--color-text-primary)]">
                  {selectedSlot.pitchName}
                </p>
                <p className="text-sm text-[var(--color-text-secondary)]">
                  {new Date(selectedSlot.startsAt).toLocaleString()} -{" "}
                  {new Date(selectedSlot.endsAt).toLocaleTimeString([], {
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                </p>
                {selectedOffer?.addressLabel || selectedSlot.addressLabel ? (
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-[var(--color-text-secondary)]">
                    <span>{selectedOffer?.addressLabel ?? selectedSlot.addressLabel}</span>
                    {buildGoogleMapsUrl({
                      addressLabel: selectedOffer?.addressLabel ?? selectedSlot.addressLabel,
                      latitude: selectedOffer?.latitude ?? selectedSlot.latitude,
                      longitude: selectedOffer?.longitude ?? selectedSlot.longitude,
                    }) ? (
                      <a
                        href={
                          buildGoogleMapsUrl({
                            addressLabel: selectedOffer?.addressLabel ?? selectedSlot.addressLabel,
                            latitude: selectedOffer?.latitude ?? selectedSlot.latitude,
                            longitude: selectedOffer?.longitude ?? selectedSlot.longitude,
                          })!
                        }
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
                    {selectedOffer &&
                    mappableOffers.some((entry) => entry.key === selectedOffer.key) ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-auto min-h-0 px-2 py-1 text-xs"
                        onClick={() => {
                          setFocusedOfferKey(selectedOffer.key);
                          setIsMapOpen(true);
                        }}
                      >
                        View nearby on map
                      </Button>
                    ) : null}
                  </div>
                ) : null}
                {selectedSlot.productType === "MONTHLY" ? (
                  <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
                    This group booking reserves all {selectedSlot.capacity} spots. The ticket total
                    is{" "}
                    {formatCurrency(
                      monthlyPreview?.ticketSubtotal ?? getSlotDisplayPrice(selectedSlot),
                      selectedSlot.currency,
                    )}
                    , plus{" "}
                    {formatCurrency(monthlyPreview?.surchargeTotal ?? 0, selectedSlot.currency)} in
                    platform fees.
                  </p>
                ) : (
                  <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
                    {selectedSlot.remainingCapacity} spaces remain. Each spot is{" "}
                    {formatCurrency(selectedSlot.price, selectedSlot.currency)} plus an ETB 15
                    platform fee.
                  </p>
                )}
                {selectedSlot.notes ? (
                  <p className="mt-2 text-sm text-[var(--color-text-muted)]">
                    {selectedSlot.notes}
                  </p>
                ) : null}
              </div>

              {selectedSlot.productType === "DAILY" ? (
                <>
                  <label className="block">
                    <span className="field-label">How many spots do you want?</span>
                    <Input
                      type="number"
                      min="1"
                      max={String(Math.max(1, selectedSlot.remainingCapacity))}
                      value={quantity}
                      onChange={(event) => setQuantity(event.target.value)}
                    />
                  </label>

                  <label className="block">
                    <span className="field-label">How do you want to pay?</span>
                    <Select
                      value={paymentMethod}
                      onChange={(event) =>
                        setPaymentMethod(event.target.value as "balance" | "chapa")
                      }
                    >
                      <option value="chapa">Chapa</option>
                      <option value="balance">Meda balance</option>
                    </Select>
                  </label>

                  {dailyPreview ? (
                    <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-accent-soft)] p-3 sm:p-4 text-sm text-[var(--color-text-secondary)]">
                      <p className="font-semibold text-[var(--color-text-primary)]">
                        Price breakdown
                      </p>
                      <div className="mt-3 grid gap-2">
                        <p>
                          Ticket price{" "}
                          {formatCurrency(dailyPreview.ticketSubtotalEtb, selectedSlot.currency)}
                        </p>
                        <p>
                          Platform fee{" "}
                          {formatCurrency(dailyPreview.surchargeTotalEtb, selectedSlot.currency)}
                        </p>
                        <p className="font-semibold text-[var(--color-text-primary)]">
                          Total now{" "}
                          {formatCurrency(dailyPreview.totalAmountEtb, selectedSlot.currency)}
                        </p>
                      </div>
                      <p className="mt-3 text-xs leading-6 text-[var(--color-text-muted)]">
                        The ETB 15 fee per ticket stays with Meda&apos;s Chapa account and does not
                        go to the host.
                      </p>
                    </div>
                  ) : null}
                </>
              ) : (
                <>
                  <label className="block">
                    <span className="field-label">Use an existing group</span>
                    <Select
                      value={selectedGroupId}
                      onChange={(event) => setSelectedGroupId(event.target.value)}
                    >
                      <option value="">Start a new group</option>
                      {groups.map((group) => (
                        <option key={group.id} value={group.id}>
                          {group.name ?? `Group ${group.id.slice(0, 8)}`} ({group.members.length}{" "}
                          members)
                        </option>
                      ))}
                    </Select>
                  </label>

                  {!selectedGroupId ? (
                    <>
                      <label className="block">
                        <span className="field-label">Group name</span>
                        <Input
                          value={groupName}
                          onChange={(event) => setGroupName(event.target.value)}
                          placeholder="Friday monthly squad"
                        />
                      </label>
                      <label className="block">
                        <span className="field-label">Player emails</span>
                        <Textarea
                          rows={5}
                          value={memberEmails}
                          onChange={(event) => setMemberEmails(event.target.value)}
                          placeholder="friend1@example.com, friend2@example.com"
                        />
                        <p className="mt-2 text-xs leading-6 text-[var(--color-text-muted)]">
                          Add emails only for people who should get their own Meda account and pay
                          their own share. If you are bringing a child or dependent under your own
                          account, add them later in Tickets by saving just their name.
                        </p>
                      </label>
                    </>
                  ) : (
                    <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-control-bg)] p-3 sm:p-4 text-sm text-[var(--color-text-secondary)]">
                      <p>
                        This group is already saved. The payment will split across those members,
                        and the total will still cover the whole pitch.
                      </p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {selectedGroup?.members.map((member) => (
                          <Badge key={member.id} variant="default">
                            {member.displayName}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}

              {monthlyPreview ? (
                <div className="rounded-[var(--radius-md)] border border-[rgba(125,211,252,0.22)] bg-[var(--color-accent-soft)] p-3 sm:p-4">
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="accent">Monthly group preview</Badge>
                    <Badge variant="default">{monthlyPreview.memberCount} members</Badge>
                  </div>
                  <div className="mt-3 grid gap-2 text-sm text-[var(--color-text-secondary)]">
                    <p>
                      Ticket price{" "}
                      {formatCurrency(monthlyPreview.ticketSubtotal, selectedSlot.currency)}
                    </p>
                    <p>
                      Platform fee{" "}
                      {formatCurrency(monthlyPreview.surchargeTotal, selectedSlot.currency)}
                    </p>
                    <p>
                      Total booking{" "}
                      {formatCurrency(monthlyPreview.totalAmount, selectedSlot.currency)}
                    </p>
                    <p>
                      Organizer pays{" "}
                      {formatCurrency(monthlyPreview.organizerAmount, selectedSlot.currency)}
                    </p>
                    <p>
                      Each added member pays{" "}
                      {formatCurrency(monthlyPreview.perAddedMemberAmount, selectedSlot.currency)}
                    </p>
                    <p>The full pitch is reserved for this group for the whole 2-hour booking.</p>
                    <p className="text-xs leading-6 text-[var(--color-text-muted)]">
                      Each added member pays one full player share, which is ticket price plus the
                      ETB 15 platform fee.
                    </p>
                    {monthlyPreview.isTooLarge ? (
                      <p className="font-semibold text-[var(--color-danger)]">
                        This group is larger than the pitch capacity.
                      </p>
                    ) : null}
                    <p>Group payment deadline {monthlyPreview.deadlineLabel}</p>
                  </div>
                </div>
              ) : null}

              <Button
                type="button"
                variant="primary"
                className="w-full"
                disabled={submitting || Boolean(monthlyPreview?.isTooLarge)}
                onClick={() => void handleSubmitBooking()}
              >
                {submitting
                  ? "Processing..."
                  : selectedSlot.productType === "MONTHLY"
                    ? "Create group booking"
                    : "Book this time"}
              </Button>

              <p className="text-xs leading-6 text-[var(--color-text-muted)]">
                Single visits create one ticket per spot. Monthly group bookings reserve the whole
                pitch and create a one-hour group payment window before they become active. If one
                of the tickets is for your child or another dependent, you can keep that ticket
                under your own account later by saving their name without adding an email.
              </p>
            </div>
          )}
        </Card>
      </div>
      {isMapOpen
        ? (
          <OverlayPortal>
            <div className="fixed inset-0 z-[75] flex items-center justify-center p-4 sm:p-6">
              <button
                type="button"
                aria-label="Close map"
                className="absolute inset-0 bg-[rgba(2,6,23,0.78)] backdrop-blur-sm"
                onClick={() => setIsMapOpen(false)}
              />
              <Card
                className="relative z-10 w-full max-w-6xl overflow-hidden border-[rgba(125,211,252,0.16)] p-0"
                role="dialog"
                aria-modal="true"
                aria-label="Booking places map"
              >
                <div className="grid max-h-[85vh] min-h-[420px] gap-0 lg:grid-cols-[minmax(0,1fr)_320px]">
                  <div className="flex min-h-[320px] flex-col gap-4 p-5 sm:p-6">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="space-y-1">
                        <p className="heading-kicker">Map</p>
                        <h3 className="text-xl font-semibold tracking-[-0.03em] text-[var(--color-text-primary)]">
                          See which places are closest to you
                        </h3>
                        <p className="text-sm text-[var(--color-text-secondary)]">
                          Tap a marker or choose a place on the right to jump straight to that
                          booking offer.
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setIsMapOpen(false)}
                      >
                        Close
                      </Button>
                    </div>

                    <SlotLocationsMap
                      offers={offerCards.map((offer) => ({
                        key: offer.key,
                        pitchName: offer.pitchName,
                        addressLabel: offer.addressLabel,
                        latitude: offer.latitude,
                        longitude: offer.longitude,
                        productTypeLabel: formatProductTypeLabel(offer.productType),
                        priceLabel: getOfferPriceLabel(offer),
                        helperLabel:
                          offer.productType === "MONTHLY"
                            ? `Whole pitch for up to ${offer.capacity} players`
                            : `${offer.capacity} spots available across open times`,
                      }))}
                      selectedOfferKey={focusedOfferKey ?? selectedOffer?.key ?? null}
                      onSelectOffer={(offerKey) => {
                        selectOfferFromMap(offerKey);
                        setFocusedOfferKey(offerKey);
                      }}
                    />
                  </div>

                  <div className="border-t border-[var(--color-border)] bg-[var(--color-control-bg)] p-5 lg:border-l lg:border-t-0 lg:p-6">
                    <div className="space-y-3">
                      <p className="text-sm font-semibold text-[var(--color-text-primary)]">
                        Available places
                      </p>
                      <div className="max-h-[56vh] space-y-3 overflow-y-auto pr-1">
                        {offerCards.map((offer) => {
                          const mapUrl = buildGoogleMapsUrl({
                            addressLabel: offer.addressLabel,
                            latitude: offer.latitude,
                            longitude: offer.longitude,
                          });
                          const isFocused =
                            (focusedOfferKey ?? selectedOffer?.key ?? null) === offer.key;
                          return (
                            <div
                              key={offer.key}
                              className={cn(
                                "rounded-[var(--radius-md)] border p-4",
                                isFocused
                                  ? "border-[rgba(125,211,252,0.4)] bg-[var(--color-accent-soft)]"
                                  : "border-[var(--color-border)] bg-[var(--color-surface)]",
                              )}
                            >
                              <div className="space-y-1">
                                <p className="font-semibold text-[var(--color-text-primary)]">
                                  {offer.pitchName}
                                </p>
                                <p className="text-sm text-[var(--color-text-secondary)]">
                                  {getOfferPriceLabel(offer)}
                                </p>
                                {offer.addressLabel ? (
                                  <p className="text-sm text-[var(--color-text-muted)]">
                                    {offer.addressLabel}
                                  </p>
                                ) : null}
                              </div>
                              <div className="mt-3 flex flex-wrap gap-2">
                                <Button
                                  type="button"
                                  size="sm"
                                  onClick={() => {
                                    selectOfferFromMap(offer.key);
                                    setFocusedOfferKey(offer.key);
                                    setIsMapOpen(false);
                                  }}
                                >
                                  Choose this place
                                </Button>
                                {mapUrl ? (
                                  <a
                                    href={mapUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    className={buttonVariants("secondary", "sm")}
                                  >
                                    Open map
                                  </a>
                                ) : null}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              </Card>
            </div>
          </OverlayPortal>
        ) : null}
      {reserveWholePitchDialog.dialog}
    </>
  );
}

function StepChip({
  index,
  label,
  active,
}: {
  index: number;
  label: string;
  active: boolean;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 rounded-full border px-3 py-1.5",
        active
          ? "border-[rgba(125,211,252,0.22)] bg-[var(--color-accent-soft)] text-[var(--color-text-primary)]"
          : "border-[var(--color-border)] bg-[var(--color-control-bg)] text-[var(--color-text-secondary)]",
      )}
    >
      <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-black/20 text-xs font-semibold">
        {index}
      </span>
      <span className="text-sm font-medium">{label}</span>
    </span>
  );
}
