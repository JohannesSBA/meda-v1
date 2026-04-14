"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Card } from "@/app/components/ui/card";
import { Badge } from "@/app/components/ui/badge";
import { Button, buttonVariants } from "@/app/components/ui/button";
import { Select } from "@/app/components/ui/select";
import { OverlayPortal } from "@/app/components/ui/overlay-portal";
import { browserApi } from "@/lib/browserApi";
import { getErrorMessage } from "@/lib/errorMessage";
import { cn } from "@/app/components/ui/cn";
import { buildGoogleMapsUrl } from "@/lib/location";
import { formatProductTypeLabel, uiCopy } from "@/lib/uiCopy";
import {
  buildOfferCards,
  formatSlotTimeRange,
  getOfferNextAvailableLabel,
  getOfferPriceLabel,
  getSlotChargeBreakdown,
  getSlotDayKey,
  getSlotDisplayPrice,
  type SlotOfferGroupingSlot,
} from "@/lib/slots/offerGrouping";

const PUBLIC_SLOT_LOOKAHEAD_DAYS = 180;
const SlotLocationsMap = dynamic(() => import("./SlotLocationsMap"), { ssr: false });

type SlotSummary = SlotOfferGroupingSlot;

function formatCurrency(value: number, currency = "ETB") {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(value);
}

function renderStars(rating: number) {
  const rounded = Math.max(0, Math.min(5, Math.round(rating)));
  return "★★★★★".slice(0, rounded) + "☆☆☆☆☆".slice(0, 5 - rounded);
}

export function SlotMarketplace() {
  const router = useRouter();

  const [slots, setSlots] = useState<SlotSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSlotId, setSelectedSlotId] = useState<string>("");
  const [productFilter, setProductFilter] = useState<"ALL" | "DAILY" | "MONTHLY">("ALL");
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
  const selectedSlotSummaryLabel = selectedSlot
    ? `${selectedSlot.pitchName} · ${new Date(selectedSlot.startsAt).toLocaleDateString()}`
    : null;
  const selectedOffer =
    offerCards.find((offer) => offer.slots.some((slot) => slot.id === selectedSlotId)) ??
    offerCards[0] ??
    null;
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
    const pricing = getSlotChargeBreakdown(selectedSlot);
    return {
      ticketSubtotal: pricing.ticketSubtotalEtb,
      surchargeTotal: pricing.surchargeTotalEtb,
    };
  }, [selectedSlot]);

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

    void load();

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

          <div className="hidden flex-wrap gap-2 text-sm text-[var(--color-text-secondary)] sm:flex">
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
                              {renderStars(selectedOfferSlot?.hostAverageRating ?? 0)}{" "}
                              {(selectedOfferSlot?.hostAverageRating ?? 0).toFixed(1)} ·{" "}
                              {(selectedOfferSlot?.hostReviewCount ?? 0) > 0
                                ? `${selectedOfferSlot?.hostReviewCount ?? 0} review${
                                    (selectedOfferSlot?.hostReviewCount ?? 0) === 1 ? "" : "s"
                                  }`
                                : "No reviews yet"}
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
                            {selectedOfferSlot ? (
                              <Button
                                type="button"
                                size="sm"
                                onClick={() => router.push(`/play/slots/${selectedOfferSlot.id}`)}
                              >
                                Book this pitch
                              </Button>
                            ) : null}
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

        <Card id="booking-checkout" className="space-y-4 p-3 sm:p-6 xl:sticky xl:top-[calc(var(--header-height)+24px)]">
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
              <p className="text-sm text-[var(--color-text-secondary)]">
                Group setup and checkout now happen on a dedicated step-by-step booking page.
              </p>
              <Button
                type="button"
                variant="primary"
                className="w-full"
                onClick={() => router.push(`/play/slots/${selectedSlot.id}`)}
              >
                Continue to booking steps
              </Button>
            </div>
          )}
        </Card>
      </div>
      {selectedSlot ? (
        <div className="fixed inset-x-0 bottom-3 z-40 px-3 sm:hidden">
          <Button
            type="button"
            className="h-12 w-full rounded-full"
            onClick={() => {
              router.push(`/play/slots/${selectedSlot.id}`);
            }}
          >
            Continue to booking steps · {selectedSlotSummaryLabel}
          </Button>
        </div>
      ) : null}
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
