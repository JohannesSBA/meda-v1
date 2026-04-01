"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/app/components/ui/badge";
import { Button } from "@/app/components/ui/button";
import { Card } from "@/app/components/ui/card";
import { Input } from "@/app/components/ui/input";
import { Select } from "@/app/components/ui/select";
import { Stack } from "@/app/components/ui/primitives";
import { Textarea } from "@/app/components/ui/textarea";
import { MapPicker } from "@/app/components/create-event/MapPicker";
import { browserApi } from "@/lib/browserApi";
import { getErrorMessage } from "@/lib/errorMessage";
import type { Category } from "@/app/types/catagory";

type CalendarView = "month" | "week" | "day";

type OwnerSubscription = {
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
  subscription: OwnerSubscription;
  checkoutUrl?: string | null;
  txRef?: string | null;
  feeAmountEtb?: number;
  paymentMethod?: "balance" | "chapa";
};

type SubscriptionConfirmationResponse = {
  ok: boolean;
  status: "confirmed" | "already_confirmed" | "processing" | "failed";
  subscription: OwnerSubscription;
};

type PitchSummary = {
  id: string;
  name: string;
  description: string | null;
  pictureUrl: string | null;
  addressLabel: string | null;
  latitude: number | null;
  longitude: number | null;
  categoryId: string;
  categoryName: string;
  isActive: boolean;
  slotCount: number;
  activeScheduleCount: number;
  latestSubscriptionStatus: string | null;
};

type OwnerSlot = {
  id: string;
  pitchId: string;
  pitchName: string;
  categoryId: string;
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
  assignedTicketCount: number;
  checkedInCount: number;
  utilization: number;
  revenueSummaryEtb: number;
  bookings: Array<{
    id: string;
    status: string;
    quantity: number;
    totalAmount: number;
    customerId: string | null;
    customerName: string;
    customerEmail: string | null;
    partyId: string | null;
    partyName: string | null;
    poolId: string | null;
    poolStatus: string | null;
    poolAmountPaid: number | null;
    poolTotalAmount: number | null;
    poolExpiresAt: string | null;
    soldTickets: number;
    assignedTickets: number;
    checkedInTickets: number;
    createdAt: string;
  }>;
};

type CalendarDaySummary = {
  date: string;
  slotCount: number;
  bookingCount: number;
  assignedTicketCount: number;
  checkedInCount: number;
  utilization: number;
  revenueSummaryEtb: number;
};

type CalendarPayload = {
  view: CalendarView;
  from: string;
  to: string;
  slots: OwnerSlot[];
  days: CalendarDaySummary[];
  totals: {
    slotCount: number;
    bookingCount: number;
    assignedTicketCount: number;
    checkedInCount: number;
    revenueSummaryEtb: number;
    utilization: number;
  };
};

type OwnerOperationsWorkspaceProps = {
  categories: Category[];
  initialSubscription: OwnerSubscription;
  initialPitches: PitchSummary[];
};

type PitchFormState = {
  name: string;
  description: string;
  pictureUrl: string;
  addressLabel: string;
  latitude: string;
  longitude: string;
  categoryId: string;
};

type ScheduleFormState = {
  dayOfWeek: string;
  startTime: string;
  endTime: string;
};

type SlotFormState = {
  pitchId: string;
  categoryId: string;
  startDate: string;
  endDate: string;
  startTime: string;
  endTime: string;
  capacity: string;
  price: string;
  productType: "DAILY" | "MONTHLY";
  status: "OPEN" | "BLOCKED";
  requiresParty: boolean;
  notes: string;
};

const weekdayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const DEFAULT_PITCH_COORDINATES = {
  latitude: "9.015240",
  longitude: "38.814349",
};
const BOOKING_INCREMENT_HOURS = 2;
const BOOKING_INCREMENT_MS = BOOKING_INCREMENT_HOURS * 60 * 60 * 1000;

function startOfLocalDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function endOfLocalDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);
}

function startOfLocalWeek(date: Date) {
  const start = startOfLocalDay(date);
  start.setDate(start.getDate() - start.getDay());
  return start;
}

function endOfLocalWeek(date: Date) {
  const end = startOfLocalWeek(date);
  end.setDate(end.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return end;
}

function startOfLocalMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function endOfLocalMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);
}

function getCalendarRange(anchorDate: Date, view: CalendarView) {
  if (view === "day") {
    return {
      from: startOfLocalDay(anchorDate),
      to: endOfLocalDay(anchorDate),
    };
  }
  if (view === "week") {
    return {
      from: startOfLocalWeek(anchorDate),
      to: endOfLocalWeek(anchorDate),
    };
  }
  return {
    from: startOfLocalWeek(startOfLocalMonth(anchorDate)),
    to: endOfLocalWeek(endOfLocalMonth(anchorDate)),
  };
}

function shiftAnchorDate(anchorDate: Date, view: CalendarView, direction: -1 | 1) {
  const next = new Date(anchorDate);
  if (view === "day") {
    next.setDate(next.getDate() + direction);
    return next;
  }
  if (view === "week") {
    next.setDate(next.getDate() + direction * 7);
    return next;
  }
  next.setMonth(next.getMonth() + direction);
  return next;
}

function toDateInput(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

function toTimeInput(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function combineLocalDateAndTimeToIso(date: string, time: string) {
  if (!date || !time) return "";
  const value = new Date(`${date}T${time}`);
  return Number.isNaN(value.getTime()) ? "" : value.toISOString();
}

function buildRecurringSlotWindows(args: {
  startDate: string;
  endDate: string;
  startTime: string;
  endTime: string;
}) {
  if (!args.startDate || !args.endDate || !args.startTime || !args.endTime) {
    return {
      dayCount: 0,
      slotsPerDay: 0,
      leftoverMinutesPerDay: 0,
      windows: [] as Array<{
        startsAt: string;
        endsAt: string;
      }>,
    };
  }

  const rangeStart = new Date(`${args.startDate}T00:00:00`);
  const rangeEnd = new Date(`${args.endDate}T00:00:00`);
  const dailyStart = new Date(`${args.startDate}T${args.startTime}`);
  const dailyEnd = new Date(`${args.startDate}T${args.endTime}`);

  if (
    Number.isNaN(rangeStart.getTime()) ||
    Number.isNaN(rangeEnd.getTime()) ||
    Number.isNaN(dailyStart.getTime()) ||
    Number.isNaN(dailyEnd.getTime()) ||
    rangeEnd.getTime() < rangeStart.getTime() ||
    dailyEnd.getTime() <= dailyStart.getTime()
  ) {
    return {
      dayCount: 0,
      slotsPerDay: 0,
      leftoverMinutesPerDay: 0,
      windows: [] as Array<{
        startsAt: string;
        endsAt: string;
      }>,
    };
  }

  const dailyWindowMinutes = Math.round(
    (dailyEnd.getTime() - dailyStart.getTime()) / (1000 * 60),
  );
  const slotsPerDay = Math.floor(dailyWindowMinutes / (BOOKING_INCREMENT_HOURS * 60));
  const leftoverMinutesPerDay =
    dailyWindowMinutes - slotsPerDay * BOOKING_INCREMENT_HOURS * 60;
  const windows: Array<{
    startsAt: string;
    endsAt: string;
  }> = [];
  const now = Date.now();

  for (
    let cursor = new Date(rangeStart);
    cursor.getTime() <= rangeEnd.getTime();
    cursor = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate() + 1)
  ) {
    const dayKey = getDayKey(cursor);
    let chunkStart = new Date(`${dayKey}T${args.startTime}`);
    const chunkBoundary = new Date(`${dayKey}T${args.endTime}`);

    while (chunkStart.getTime() + BOOKING_INCREMENT_MS <= chunkBoundary.getTime()) {
      const chunkEnd = new Date(chunkStart.getTime() + BOOKING_INCREMENT_MS);
      if (chunkStart.getTime() > now) {
        windows.push({
          startsAt: chunkStart.toISOString(),
          endsAt: chunkEnd.toISOString(),
        });
      }
      chunkStart = chunkEnd;
    }
  }

  const dayCount = Math.floor(
    (rangeEnd.getTime() - rangeStart.getTime()) / (1000 * 60 * 60 * 24),
  ) + 1;

  return {
    dayCount,
    slotsPerDay,
    leftoverMinutesPerDay,
    windows,
  };
}

function formatCurrency(value: number, currency = "ETB") {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(value);
}

function formatCalendarHeading(anchorDate: Date, view: CalendarView) {
  if (view === "day") {
    return anchorDate.toLocaleDateString(undefined, {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  }
  if (view === "week") {
    const { from, to } = getCalendarRange(anchorDate, "week");
    return `${from.toLocaleDateString(undefined, { month: "short", day: "numeric" })} - ${to.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}`;
  }
  return anchorDate.toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });
}

function buildMonthGrid(anchorDate: Date) {
  const { from, to } = getCalendarRange(anchorDate, "month");
  const days: Date[] = [];
  for (let cursor = new Date(from); cursor <= to; cursor.setDate(cursor.getDate() + 1)) {
    days.push(new Date(cursor));
  }
  return days;
}

function getDayKey(value: Date | string) {
  const date = typeof value === "string" ? new Date(value) : value;
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

function getStatusTone(status: OwnerSlot["status"]) {
  if (status === "OPEN") return "success";
  if (status === "BLOCKED") return "default";
  if (status === "BOOKED" || status === "RESERVED") return "accent";
  return "default";
}

function formatPitchLocation(pitch: PitchSummary | null) {
  if (!pitch) return "Pick a place to keep going.";
  if (pitch.addressLabel?.trim()) return pitch.addressLabel.trim();
  if (
    typeof pitch.latitude === "number" &&
    Number.isFinite(pitch.latitude) &&
    typeof pitch.longitude === "number" &&
    Number.isFinite(pitch.longitude)
  ) {
    return `${pitch.latitude.toFixed(4)}, ${pitch.longitude.toFixed(4)}`;
  }
  return "No map pin yet.";
}

export function OwnerOperationsWorkspace({
  categories,
  initialSubscription,
  initialPitches,
}: OwnerOperationsWorkspaceProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [subscription, setSubscription] = useState<OwnerSubscription>(initialSubscription);
  const [pitches, setPitches] = useState<PitchSummary[]>(initialPitches);
  const [selectedPitchId, setSelectedPitchId] = useState(initialPitches[0]?.id ?? "");
  const [calendarView, setCalendarView] = useState<CalendarView>("month");
  const [anchorDate, setAnchorDate] = useState(() => new Date());
  const [calendar, setCalendar] = useState<CalendarPayload | null>(null);
  const [calendarLoading, setCalendarLoading] = useState(false);
  const [subscriptionPending, setSubscriptionPending] = useState(false);
  const [subscriptionPaymentMethod, setSubscriptionPaymentMethod] = useState<
    "balance" | "chapa"
  >("balance");
  const [subscriptionConfirming, setSubscriptionConfirming] = useState(false);
  const [pitchPending, setPitchPending] = useState(false);
  const [editingPitchId, setEditingPitchId] = useState<string | null>(null);
  const [schedulePending, setSchedulePending] = useState(false);
  const [slotPending, setSlotPending] = useState(false);
  const [locStatus, setLocStatus] = useState<"idle" | "locating" | "error" | "done">("idle");
  const [pitchForm, setPitchForm] = useState<PitchFormState>({
    name: "",
    description: "",
    pictureUrl: "",
    addressLabel: "",
    latitude: DEFAULT_PITCH_COORDINATES.latitude,
    longitude: DEFAULT_PITCH_COORDINATES.longitude,
    categoryId: "",
  });
  const [scheduleForm, setScheduleForm] = useState<ScheduleFormState>({
    dayOfWeek: "1",
    startTime: "18:00",
    endTime: "20:00",
  });
  const [slotForm, setSlotForm] = useState<SlotFormState>({
    pitchId: initialPitches[0]?.id ?? "",
    categoryId: "",
    startDate: toDateInput(new Date().toISOString()),
    endDate: toDateInput(new Date().toISOString()),
    startTime: "18:00",
    endTime: "20:00",
    capacity: "10",
    price: "0",
    productType: "DAILY",
    status: "OPEN",
    requiresParty: false,
    notes: "",
  });
  const [editingSlotId, setEditingSlotId] = useState<string | null>(null);
  const [selectedDayKey, setSelectedDayKey] = useState(getDayKey(new Date()));

  const daySummaryByDate = useMemo(
    () => new Map((calendar?.days ?? []).map((day) => [day.date, day])),
    [calendar?.days],
  );
  const subscriptionTxRef = searchParams.get("subscription_tx_ref");
  const visibleSlots = useMemo(() => {
    const slots = calendar?.slots ?? [];
    if (calendarView === "day") {
      return slots;
    }
    return slots.filter((slot) => getDayKey(slot.startsAt) === selectedDayKey);
  }, [calendar?.slots, calendarView, selectedDayKey]);

  useEffect(() => {
    setSlotForm((prev) => ({
      ...prev,
      pitchId: selectedPitchId,
    }));
  }, [selectedPitchId]);

  useEffect(() => {
    const nextDayKey = getDayKey(anchorDate);
    setSelectedDayKey(nextDayKey);
    if (!editingSlotId) {
      setSlotForm((prev) => ({
        ...prev,
        startDate: nextDayKey,
        endDate: nextDayKey,
      }));
    }
  }, [anchorDate, calendarView, editingSlotId]);

  useEffect(() => {
    let cancelled = false;

    async function loadCalendar() {
      setCalendarLoading(true);
      try {
        const { from, to } = getCalendarRange(anchorDate, calendarView);
        const search = new URLSearchParams({
          ownerView: "true",
          view: calendarView,
          from: from.toISOString(),
          to: to.toISOString(),
        });
        if (selectedPitchId) {
          search.set("pitchId", selectedPitchId);
        }

        const payload = await browserApi.get<CalendarPayload>(`/api/slots?${search.toString()}`);
        if (!cancelled) {
          setCalendar(payload);
        }
      } catch (error) {
        if (!cancelled) {
          toast.error(getErrorMessage(error) || "Failed to load owner calendar");
        }
      } finally {
        if (!cancelled) {
          setCalendarLoading(false);
        }
      }
    }

    void loadCalendar();

    return () => {
      cancelled = true;
    };
  }, [anchorDate, calendarView, selectedPitchId]);

  useEffect(() => {
    if (!subscriptionTxRef || subscriptionConfirming) {
      return;
    }

    let cancelled = false;

    async function confirmSubscription() {
      setSubscriptionConfirming(true);
      try {
        const result = await browserApi.post<SubscriptionConfirmationResponse>(
          "/api/pitch-subscriptions/confirm",
          { txRef: subscriptionTxRef },
        );

        if (cancelled) return;

        setSubscription(result.subscription);
        if (result.ok) {
          toast.success(
            result.status === "already_confirmed"
              ? "Your host plan was already active."
              : "Your host plan payment was confirmed.",
          );
        } else {
          toast.error(
            result.status === "failed"
              ? "The host plan payment failed."
              : "The host plan payment is still processing.",
          );
        }

        const nextParams = new URLSearchParams(searchParams.toString());
        nextParams.delete("subscription_tx_ref");
        router.replace(nextParams.toString() ? `/host?${nextParams.toString()}` : "/host");
        router.refresh();
      } catch (error) {
        if (!cancelled) {
          toast.error(getErrorMessage(error) || "Failed to confirm the host plan payment");
        }
      } finally {
        if (!cancelled) {
          setSubscriptionConfirming(false);
        }
      }
    }

    void confirmSubscription();

    return () => {
      cancelled = true;
    };
  }, [router, searchParams, subscriptionConfirming, subscriptionTxRef]);

  async function refreshPitches() {
    const data = await browserApi.get<{ pitches: PitchSummary[] }>("/api/pitches");
    setPitches(data.pitches ?? []);
    if (data.pitches.length > 0 && !data.pitches.some((pitch) => pitch.id === selectedPitchId)) {
      setSelectedPitchId(data.pitches[0].id);
    }
  }

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
      router.refresh();
      toast.success(
        action === "start"
          ? "Your host plan is on"
          : action === "renew"
            ? "Your host plan was renewed"
            : "Your host plan was stopped",
      );
    } catch (error) {
      toast.error(getErrorMessage(error) || "Failed to update subscription");
    } finally {
      setSubscriptionPending(false);
    }
  }

  function handlePitchMapChange(latitude: number, longitude: number) {
    setPitchForm((prev) => ({
      ...prev,
      latitude: latitude.toFixed(6),
      longitude: longitude.toFixed(6),
    }));
    setLocStatus("done");
  }

  function handleUseMyLocation() {
    if (typeof window === "undefined" || !("geolocation" in navigator)) {
      setLocStatus("error");
      toast.error("Location is not available on this device.");
      return;
    }

    setLocStatus("locating");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setPitchForm((prev) => ({
          ...prev,
          latitude: position.coords.latitude.toFixed(6),
          longitude: position.coords.longitude.toFixed(6),
        }));
        setLocStatus("done");
      },
      () => {
        setLocStatus("error");
        toast.error("We could not find your spot. You can still tap the map.");
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
      },
    );
  }

  function resetPitchForm() {
    setEditingPitchId(null);
    setPitchForm({
      name: "",
      description: "",
      pictureUrl: "",
      addressLabel: "",
      latitude: DEFAULT_PITCH_COORDINATES.latitude,
      longitude: DEFAULT_PITCH_COORDINATES.longitude,
      categoryId: "",
    });
    setLocStatus("idle");
  }

  function populatePitchForm(pitch: PitchSummary) {
    setEditingPitchId(pitch.id);
    setSelectedPitchId(pitch.id);
    setPitchForm({
      name: pitch.name,
      description: pitch.description ?? "",
      pictureUrl: pitch.pictureUrl ?? "",
      addressLabel: pitch.addressLabel ?? "",
      latitude:
        typeof pitch.latitude === "number" && Number.isFinite(pitch.latitude)
          ? pitch.latitude.toFixed(6)
          : DEFAULT_PITCH_COORDINATES.latitude,
      longitude:
        typeof pitch.longitude === "number" && Number.isFinite(pitch.longitude)
          ? pitch.longitude.toFixed(6)
          : DEFAULT_PITCH_COORDINATES.longitude,
      categoryId: pitch.categoryId ?? "",
    });
    setLocStatus(
      pitch.addressLabel ||
        (typeof pitch.latitude === "number" && typeof pitch.longitude === "number")
        ? "done"
        : "idle",
    );
  }

  async function handleSavePitch(event: React.FormEvent) {
    event.preventDefault();
    setPitchPending(true);
    try {
      const data = editingPitchId
        ? await browserApi.patch<{ pitch: PitchSummary }>(`/api/pitches/${editingPitchId}`, pitchForm)
        : await browserApi.post<{ pitch: PitchSummary }>("/api/pitches", pitchForm);
      await refreshPitches();
      setSelectedPitchId(data.pitch.id);
      resetPitchForm();
      toast.success(
        editingPitchId
          ? "Place details updated. The map pin is saved."
          : "Your place is ready. Now add open times.",
      );
    } catch (error) {
      toast.error(
        getErrorMessage(error) ||
          (editingPitchId ? "Failed to update place details" : "Failed to save place"),
      );
    } finally {
      setPitchPending(false);
    }
  }

  async function handleCreateSchedule(event: React.FormEvent) {
    event.preventDefault();
    if (!selectedPitchId) {
      toast.error("Create a place before adding open days");
      return;
    }
    setSchedulePending(true);
    try {
      await browserApi.post(`/api/pitches/${selectedPitchId}/schedules`, {
        dayOfWeek: Number(scheduleForm.dayOfWeek),
        startTime: scheduleForm.startTime,
        endTime: scheduleForm.endTime,
      });
      await refreshPitches();
      toast.success("Open days saved");
    } catch (error) {
      toast.error(getErrorMessage(error) || "Failed to save availability rule");
    } finally {
      setSchedulePending(false);
    }
  }

  function populateSlotForm(slot: OwnerSlot) {
    setEditingSlotId(slot.id);
    setSelectedPitchId(slot.pitchId);
    setSlotForm({
      pitchId: slot.pitchId,
      categoryId: slot.categoryId,
      startDate: toDateInput(slot.startsAt),
      endDate: toDateInput(slot.startsAt),
      startTime: toTimeInput(slot.startsAt),
      endTime: toTimeInput(slot.endsAt),
      capacity: String(slot.capacity),
      price: String(slot.price),
      productType: slot.productType,
      status: slot.status === "BLOCKED" ? "BLOCKED" : "OPEN",
      requiresParty: slot.requiresParty,
      notes: slot.notes ?? "",
    });
  }

  function resetSlotForm() {
    setEditingSlotId(null);
    setSlotForm((prev) => ({
      ...prev,
      pitchId: selectedPitchId,
      categoryId: "",
      startDate: selectedDayKey,
      endDate: selectedDayKey,
      startTime: "18:00",
      endTime: "20:00",
      capacity: "10",
      price: "0",
      productType: "DAILY",
      status: "OPEN",
      requiresParty: false,
      notes: "",
    }));
  }

  function handleSelectDay(dayKey: string) {
    setSelectedDayKey(dayKey);
    if (!editingSlotId) {
      setSlotForm((prev) => ({
        ...prev,
        startDate: dayKey,
        endDate: dayKey,
      }));
    }
  }

  function openCreateSlot(status: SlotFormState["status"]) {
    setEditingSlotId(null);
    setSlotForm((prev) => ({
      ...prev,
      pitchId: selectedPitchId,
      startDate: selectedDayKey,
      endDate: selectedDayKey,
      startTime: prev.startTime || "18:00",
      endTime: prev.endTime || "20:00",
      status,
      requiresParty: status === "BLOCKED" ? false : prev.requiresParty,
    }));

    document.getElementById("owner-slot-form")?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }

  async function handleSaveSlot(event: React.FormEvent) {
    event.preventDefault();
    if (!slotForm.pitchId) {
      toast.error("Select a place before saving booking times");
      return;
    }

    setSlotPending(true);
    try {
      if (editingSlotId) {
        const startsAt = combineLocalDateAndTimeToIso(slotForm.startDate, slotForm.startTime);
        const endsAt = combineLocalDateAndTimeToIso(slotForm.startDate, slotForm.endTime);

        if (!startsAt || !endsAt) {
          toast.error("Choose a valid booking day and time");
          return;
        }
        if (new Date(startsAt).getTime() <= Date.now()) {
          toast.error("Choose a future day and time for this booking window");
          return;
        }

        const payload = {
          pitchId: slotForm.pitchId,
          categoryId: slotForm.categoryId || undefined,
          startsAt,
          endsAt,
          capacity: Number(slotForm.capacity),
          price: Number(slotForm.price),
          currency: "ETB",
          productType: slotForm.productType,
          status: slotForm.status,
          requiresParty: slotForm.productType === "MONTHLY" ? true : slotForm.requiresParty,
          notes: slotForm.notes || undefined,
        };

        await browserApi.patch(`/api/slots/${editingSlotId}`, payload);
        toast.success("Booking time updated");
      } else {
        if (!slotForm.startDate || !slotForm.endDate) {
          toast.error("Choose the first day and last day for this booking range");
          return;
        }

        const rangeStart = new Date(`${slotForm.startDate}T00:00:00`);
        const rangeEnd = new Date(`${slotForm.endDate}T00:00:00`);
        if (
          Number.isNaN(rangeStart.getTime()) ||
          Number.isNaN(rangeEnd.getTime()) ||
          rangeEnd.getTime() < rangeStart.getTime()
        ) {
          toast.error("The last day must be the same as or later than the first day");
          return;
        }
        if (slotWindowPlan.slotsPerDay === 0) {
          toast.error("Choose at least 2 hours each day so people can book 2-hour blocks");
          return;
        }
        if (slotWindowPlan.windows.length === 0) {
          toast.error("No future 2-hour booking times were created from that range");
          return;
        }

        const result = await browserApi.post<{
          createdCount: number;
          firstStartsAt: string;
          lastEndsAt: string;
        }>("/api/slots", {
          pitchId: slotForm.pitchId,
          categoryId: slotForm.categoryId || undefined,
          windows: slotWindowPlan.windows,
          capacity: Number(slotForm.capacity),
          price: Number(slotForm.price),
          currency: "ETB",
          productType: slotForm.productType,
          status: slotForm.status,
          requiresParty: slotForm.productType === "MONTHLY" ? true : slotForm.requiresParty,
          notes: slotForm.notes || undefined,
        });
        toast.success(
          result.createdCount === 1
            ? "1 booking time created"
            : `${result.createdCount} booking times created`,
        );
        if (slotWindowPlan.leftoverMinutesPerDay > 0) {
          toast.message(
            `The last ${slotWindowPlan.leftoverMinutesPerDay} minute${slotWindowPlan.leftoverMinutesPerDay === 1 ? "" : "s"} each day was left unused so every booking stays 2 hours long.`,
          );
        }
      }

      resetSlotForm();
      const refreshed = await browserApi.get<CalendarPayload>(
        `/api/slots?ownerView=true&view=${calendarView}&from=${getCalendarRange(anchorDate, calendarView).from.toISOString()}&to=${getCalendarRange(anchorDate, calendarView).to.toISOString()}${selectedPitchId ? `&pitchId=${selectedPitchId}` : ""}`,
      );
      setCalendar(refreshed);
      await refreshPitches();
    } catch (error) {
      toast.error(getErrorMessage(error) || "Failed to save slot");
    } finally {
      setSlotPending(false);
    }
  }

  async function handleDeleteSlot(slotId: string) {
    if (!window.confirm("Delete this slot? This cannot be undone.")) {
      return;
    }

    setSlotPending(true);
    try {
      await browserApi.delete(`/api/slots/${slotId}`);
      if (editingSlotId === slotId) {
        resetSlotForm();
      }
      const refreshed = await browserApi.get<CalendarPayload>(
        `/api/slots?ownerView=true&view=${calendarView}&from=${getCalendarRange(anchorDate, calendarView).from.toISOString()}&to=${getCalendarRange(anchorDate, calendarView).to.toISOString()}${selectedPitchId ? `&pitchId=${selectedPitchId}` : ""}`,
      );
      setCalendar(refreshed);
      await refreshPitches();
      toast.success("Booking time deleted");
    } catch (error) {
      toast.error(getErrorMessage(error) || "Failed to delete slot");
    } finally {
      setSlotPending(false);
    }
  }

  const selectedPitch = pitches.find((pitch) => pitch.id === selectedPitchId) ?? null;
  const totalRevenue = calendar?.totals.revenueSummaryEtb ?? 0;
  const slotWindowPlan = useMemo(
    () =>
      buildRecurringSlotWindows({
        startDate: slotForm.startDate,
        endDate: slotForm.endDate,
        startTime: slotForm.startTime,
        endTime: slotForm.endTime,
      }),
    [slotForm.endDate, slotForm.endTime, slotForm.startDate, slotForm.startTime],
  );
  const monthlyReservationTotal =
    slotForm.productType === "MONTHLY"
      ? Math.max(0, Number(slotForm.price) || 0) * Math.max(1, Number(slotForm.capacity) || 1)
      : 0;

  return (
    <Stack gap="xl">
      <div className="grid gap-4 xl:grid-cols-4">
        <MetricCard
          label="Host plan"
          value={
            subscription?.entitlementActive
              ? `${
                  subscription.gracePeriodActive
                    ? subscription.graceDaysRemaining
                    : subscription.daysRemaining
                } day${
                  (subscription.gracePeriodActive
                    ? subscription.graceDaysRemaining
                    : subscription.daysRemaining) === 1
                    ? ""
                    : "s"
                } left`
              : "Inactive"
          }
          detail={
            subscription?.gracePeriodActive
              ? `Grace period ends ${new Date(subscription.graceEndsAt ?? subscription.endsAt).toLocaleDateString()}`
              : subscription?.status ?? "Turn this on before you add booking times."
          }
          accent={Boolean(subscription?.entitlementActive)}
        />
        <MetricCard
          label="Your places"
          value={String(pitches.length)}
          detail={`${pitches.filter((pitch) => pitch.isActive).length} active places people can book`}
        />
        <MetricCard
          label="Open times"
          value={String(calendar?.totals.slotCount ?? 0)}
          detail={`${calendar?.totals.bookingCount ?? 0} bookings in this view`}
        />
        <MetricCard
          label="Money in"
          value={formatCurrency(totalRevenue)}
          detail={`Space used ${Math.round((calendar?.totals.utilization ?? 0) * 100)}%`}
        />
      </div>

      <Card className="space-y-4 p-5 sm:p-6">
        <div className="space-y-2">
          <p className="heading-kicker">Easy steps</p>
          <h2 className="section-title">Do these three things in order.</h2>
          <p className="text-sm leading-7 text-[var(--color-text-secondary)]">
            1. Name your place and drop the map pin. 2. Pick the days you are usually open.
            3. Add a time people can book and pay for.
          </p>
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          <SimpleStepCard
            step="1"
            title="Name your place"
                    body="Start with the place name, address, and map pin so players know where to go."
          />
          <SimpleStepCard
            step="2"
            title="Pick open days"
            body="Add the days and hours you normally want this place to be available."
          />
          <SimpleStepCard
            step="3"
            title="Make a booking time"
            body="Choose a day, a start time, an end time, and a price. Then people can book it."
          />
        </div>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
        <Stack gap="lg">
          <Card className="space-y-4 p-5 sm:p-6">
            <div className="space-y-2">
              <p className="heading-kicker">Before you start</p>
              <h2 className="section-title">Turn on your host plan</h2>
              <p className="text-sm leading-7 text-[var(--color-text-secondary)]">
                This unlocks place setup and bookable time slots. If you still use the old event
                flow, that keeps its one-time fee fallback.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Badge variant={subscription?.entitlementActive ? "success" : "default"}>
                {subscription?.status ?? "NOT_STARTED"}
              </Badge>
              {subscription?.gracePeriodActive ? (
                <Badge variant="accent">
                  Grace ends {new Date(subscription.graceEndsAt ?? subscription.endsAt).toLocaleDateString()}
                </Badge>
              ) : null}
              {subscription?.renewalAt ? (
                <Badge variant="accent">
                  Renews {new Date(subscription.renewalAt).toLocaleDateString()}
                </Badge>
              ) : null}
            </div>

            <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_180px] sm:items-end">
              <label className="block">
                <span className="field-label">How do you want to pay?</span>
                <Select
                  value={subscriptionPaymentMethod}
                  onChange={(event) =>
                    setSubscriptionPaymentMethod(
                      event.target.value as "balance" | "chapa",
                    )
                  }
                  disabled={subscriptionPending || subscriptionConfirming}
                >
                  <option value="balance">Use my Meda balance</option>
                  <option value="chapa">Pay with Chapa</option>
                </Select>
              </label>
              <div className="rounded-[18px] border border-[var(--color-border)] bg-[var(--color-control-bg)] px-4 py-3 text-sm leading-6 text-[var(--color-text-secondary)]">
                <p className="font-semibold text-[var(--color-text-primary)]">
                  Fee: {formatCurrency(subscription?.feeAmountEtb ?? 1500)}
                </p>
                <p>You get 30 days plus a 15-day grace period if you renew late.</p>
              </div>
            </div>

            <p className="text-sm leading-7 text-[var(--color-text-secondary)]">
              We email you before the host plan expires. If it runs out, you still get 15 days to
              renew before booking tools lock.
            </p>

            <div className="grid gap-2 sm:grid-cols-3">
              <Button
                type="button"
                variant="primary"
                onClick={() => void handleSubscriptionAction("start")}
                disabled={
                  subscriptionPending ||
                  subscriptionConfirming ||
                  Boolean(subscription?.entitlementActive)
                }
              >
                {subscriptionPending ? "Working..." : "Start plan"}
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={() => void handleSubscriptionAction("renew")}
                disabled={subscriptionPending || subscriptionConfirming}
              >
                {subscriptionPending ? "Working..." : "Renew plan"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => void handleSubscriptionAction("cancel")}
                disabled={subscriptionPending || subscriptionConfirming || !subscription}
              >
                {subscriptionPending ? "Working..." : "Stop plan"}
              </Button>
            </div>
          </Card>

          <Card className="space-y-4 p-5 sm:p-6">
            <div className="space-y-2">
              <p className="heading-kicker">Step 1</p>
              <h2 className="section-title">Name your place and pin it on the map</h2>
              <p className="text-sm leading-7 text-[var(--color-text-secondary)]">
                Keep this simple. Give the place a name, type the address people will recognize,
                then tap the map so players can find it fast.
              </p>
            </div>

            {selectedPitch ? (
              <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-control-bg)] p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-[var(--color-text-primary)]">
                      Current place
                    </p>
                    <p className="text-sm text-[var(--color-text-secondary)]">
                      {selectedPitch.name}
                    </p>
                    <p className="text-xs leading-6 text-[var(--color-text-muted)]">
                      {formatPitchLocation(selectedPitch)}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => populatePitchForm(selectedPitch)}
                    >
                      Edit this place
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={resetPitchForm}
                    >
                      Create new place
                    </Button>
                  </div>
                </div>
              </div>
            ) : null}

            <form className="space-y-4" onSubmit={handleSavePitch}>
              <label className="block">
                <span className="field-label">What is this place called?</span>
                <Input
                  value={pitchForm.name}
                  onChange={(event) =>
                    setPitchForm((prev) => ({ ...prev, name: event.target.value }))
                  }
                  placeholder="Meda Arena A"
                />
              </label>

              <label className="block">
                <span className="field-label">What sport is this for?</span>
                <Select
                  value={pitchForm.categoryId}
                  onChange={(event) =>
                    setPitchForm((prev) => ({ ...prev, categoryId: event.target.value }))
                  }
                >
                  <option value="">Use soccer default</option>
                  {categories.map((category) => (
                    <option key={category.categoryId} value={category.categoryId}>
                      {category.categoryName}
                    </option>
                  ))}
                </Select>
              </label>

              <div className="space-y-3 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-control-bg)] p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-[var(--color-text-primary)]">
                      Put it on the map
                    </p>
                    <p className="text-sm text-[var(--color-text-secondary)]">
                      Type the place name and tap the map pin where people should go.
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={handleUseMyLocation}
                  >
                    {locStatus === "locating" ? "Finding my spot..." : "Use my location"}
                  </Button>
                </div>

                <label className="block">
                  <span className="field-label">Where should people go?</span>
                  <Input
                    value={pitchForm.addressLabel}
                    onChange={(event) =>
                      setPitchForm((prev) => ({
                        ...prev,
                        addressLabel: event.target.value,
                      }))
                    }
                    placeholder="Bole, next to Friendship Park"
                  />
                </label>

                <MapPicker
                  latitude={pitchForm.latitude}
                  longitude={pitchForm.longitude}
                  onChange={handlePitchMapChange}
                />

                <div className="grid gap-2 sm:grid-cols-2">
                  <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-black/10 px-3 py-2 text-sm text-[var(--color-text-secondary)]">
                    <span className="font-semibold text-[var(--color-text-primary)]">Lat:</span>{" "}
                    {pitchForm.latitude}
                  </div>
                  <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-black/10 px-3 py-2 text-sm text-[var(--color-text-secondary)]">
                    <span className="font-semibold text-[var(--color-text-primary)]">Lng:</span>{" "}
                    {pitchForm.longitude}
                  </div>
                </div>
              </div>

              <label className="block">
                <span className="field-label">Tell people something helpful</span>
                <Textarea
                  rows={4}
                  value={pitchForm.description}
                  onChange={(event) =>
                    setPitchForm((prev) => ({ ...prev, description: event.target.value }))
                  }
                    placeholder="Indoor five-a-side place with evening lighting."
                />
              </label>

              <label className="block">
                <span className="field-label">Place image URL (optional)</span>
                <Input
                  value={pitchForm.pictureUrl}
                  onChange={(event) =>
                    setPitchForm((prev) => ({ ...prev, pictureUrl: event.target.value }))
                  }
                  placeholder="https://..."
                />
              </label>

              <div className="grid gap-2 sm:grid-cols-2">
                <Button type="submit" variant="primary" className="w-full" disabled={pitchPending}>
                  {pitchPending
                    ? "Saving..."
                    : editingPitchId
                      ? "Save place details"
                      : "Save place"}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  className="w-full"
                  disabled={pitchPending}
                  onClick={resetPitchForm}
                >
                  {editingPitchId ? "Stop editing" : "Clear form"}
                </Button>
              </div>
            </form>
          </Card>

          <Card className="space-y-4 p-5 sm:p-6">
            <div className="space-y-2">
              <p className="heading-kicker">Step 2</p>
              <h2 className="section-title">Choose the days you are usually open</h2>
              <p className="text-sm leading-7 text-[var(--color-text-secondary)]">
                Pick one place, then add the days and times you normally want it available.
              </p>
            </div>

            <form className="space-y-4" onSubmit={handleCreateSchedule}>
              <label className="block">
                <span className="field-label">Which place?</span>
                <Select
                  value={selectedPitchId}
                  onChange={(event) => setSelectedPitchId(event.target.value)}
                >
                  <option value="">Select place</option>
                  {pitches.map((pitch) => (
                    <option key={pitch.id} value={pitch.id}>
                      {pitch.name}
                    </option>
                  ))}
                </Select>
              </label>

              <div className="grid gap-4 sm:grid-cols-3">
                <label className="block">
                  <span className="field-label">Day</span>
                  <Select
                    value={scheduleForm.dayOfWeek}
                    onChange={(event) =>
                      setScheduleForm((prev) => ({ ...prev, dayOfWeek: event.target.value }))
                    }
                  >
                    {weekdayLabels.map((label, index) => (
                      <option key={label} value={index}>
                        {label}
                      </option>
                    ))}
                  </Select>
                </label>
                <label className="block">
                  <span className="field-label">Start time</span>
                  <Input
                    type="time"
                    value={scheduleForm.startTime}
                    onChange={(event) =>
                      setScheduleForm((prev) => ({ ...prev, startTime: event.target.value }))
                    }
                  />
                </label>
                <label className="block">
                  <span className="field-label">End time</span>
                  <Input
                    type="time"
                    value={scheduleForm.endTime}
                    onChange={(event) =>
                      setScheduleForm((prev) => ({ ...prev, endTime: event.target.value }))
                    }
                  />
                </label>
              </div>

              <Button
                type="submit"
                variant="secondary"
                className="w-full"
                disabled={schedulePending || !selectedPitchId}
              >
                {schedulePending ? "Saving..." : "Save open days"}
              </Button>

              {selectedPitch ? (
                <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-control-bg)] p-4 text-sm text-[var(--color-text-secondary)]">
                  <p className="font-semibold text-[var(--color-text-primary)]">
                    Working on {selectedPitch.name}
                  </p>
                  <p className="mt-1">{formatPitchLocation(selectedPitch)}</p>
                  <p className="mt-1">
                    {selectedPitch.activeScheduleCount} saved open-day rule
                    {selectedPitch.activeScheduleCount === 1 ? "" : "s"}.
                  </p>
                </div>
              ) : null}
            </form>
          </Card>

          <Card className="space-y-4 p-5 sm:p-6">
            <div className="space-y-2">
              <p className="heading-kicker">{editingSlotId ? "Edit booking time" : "Step 3"}</p>
              <h2 className="section-title">
                {editingSlotId ? "Change this booking time" : "Open booking times for a date range"}
              </h2>
              <p className="text-sm leading-7 text-[var(--color-text-secondary)]">
                {editingSlotId
                  ? "You are editing one 2-hour booking time."
                  : "Pick the first day, the last day, and the hours you want open each day. We will turn that into simple 2-hour booking times people can reserve."}
              </p>
            </div>

            <form id="owner-slot-form" className="space-y-4" onSubmit={handleSaveSlot}>
              <label className="block">
                <span className="field-label">Which place?</span>
                <Select
                  value={slotForm.pitchId}
                  onChange={(event) =>
                    setSlotForm((prev) => ({ ...prev, pitchId: event.target.value }))
                  }
                >
                  <option value="">Select place</option>
                  {pitches.map((pitch) => (
                    <option key={pitch.id} value={pitch.id}>
                      {pitch.name}
                    </option>
                  ))}
                </Select>
              </label>

              {editingSlotId ? (
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="block">
                    <span className="field-label">Day</span>
                    <Input
                      type="date"
                      value={slotForm.startDate}
                      onChange={(event) =>
                        setSlotForm((prev) => ({
                          ...prev,
                          startDate: event.target.value,
                          endDate: event.target.value,
                        }))
                      }
                    />
                  </label>
                  <label className="block">
                    <span className="field-label">Sport</span>
                    <Select
                      value={slotForm.categoryId}
                      onChange={(event) =>
                        setSlotForm((prev) => ({ ...prev, categoryId: event.target.value }))
                      }
                    >
                      <option value="">Use soccer default</option>
                      {categories.map((category) => (
                        <option key={category.categoryId} value={category.categoryId}>
                          {category.categoryName}
                        </option>
                      ))}
                    </Select>
                  </label>
                </div>
              ) : (
                <div className="grid gap-4 sm:grid-cols-3">
                  <label className="block">
                    <span className="field-label">First day</span>
                    <Input
                      type="date"
                      value={slotForm.startDate}
                      onChange={(event) =>
                        setSlotForm((prev) => ({ ...prev, startDate: event.target.value }))
                      }
                    />
                  </label>
                  <label className="block">
                    <span className="field-label">Last day</span>
                    <Input
                      type="date"
                      value={slotForm.endDate}
                      onChange={(event) =>
                        setSlotForm((prev) => ({ ...prev, endDate: event.target.value }))
                      }
                    />
                  </label>
                  <label className="block">
                    <span className="field-label">Sport</span>
                    <Select
                      value={slotForm.categoryId}
                      onChange={(event) =>
                        setSlotForm((prev) => ({ ...prev, categoryId: event.target.value }))
                      }
                    >
                      <option value="">Use soccer default</option>
                      {categories.map((category) => (
                        <option key={category.categoryId} value={category.categoryId}>
                          {category.categoryName}
                        </option>
                      ))}
                    </Select>
                  </label>
                </div>
              )}

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="field-label">Start time</span>
                  <Input
                    type="time"
                    value={slotForm.startTime}
                    onChange={(event) =>
                      setSlotForm((prev) => ({ ...prev, startTime: event.target.value }))
                    }
                  />
                </label>
                <label className="block">
                  <span className="field-label">End time</span>
                  <Input
                    type="time"
                    value={slotForm.endTime}
                    onChange={(event) =>
                      setSlotForm((prev) => ({ ...prev, endTime: event.target.value }))
                    }
                  />
                </label>
              </div>

              {!editingSlotId ? (
                <div className="rounded-[var(--radius-md)] border border-[rgba(125,211,252,0.22)] bg-[var(--color-accent-soft)] p-4 text-sm text-[var(--color-text-secondary)]">
                  {slotWindowPlan.slotsPerDay > 0 ? (
                    <div className="space-y-2">
                      <p className="font-semibold text-[var(--color-text-primary)]">
                        We will create {slotWindowPlan.windows.length} bookable time
                        {slotWindowPlan.windows.length === 1 ? "" : "s"}.
                      </p>
                      <p>
                        That is {slotWindowPlan.slotsPerDay} booking time
                        {slotWindowPlan.slotsPerDay === 1 ? "" : "s"} each day for{" "}
                        {slotWindowPlan.dayCount} day
                        {slotWindowPlan.dayCount === 1 ? "" : "s"}.
                      </p>
                      <p>Every player booking is always exactly 2 hours long.</p>
                      {slotWindowPlan.leftoverMinutesPerDay > 0 ? (
                        <p>
                          The last {slotWindowPlan.leftoverMinutesPerDay} minute
                          {slotWindowPlan.leftoverMinutesPerDay === 1 ? "" : "s"} each day will stay
                          closed so the booking times stay simple.
                        </p>
                      ) : null}
                    </div>
                  ) : (
                    <p>
                      Pick at least 2 hours between the start and end time so we can make bookable
                      2-hour blocks.
                    </p>
                  )}
                </div>
              ) : null}

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="field-label">How many people can join?</span>
                  <Input
                    type="number"
                    min="1"
                    value={slotForm.capacity}
                    onChange={(event) =>
                      setSlotForm((prev) => ({ ...prev, capacity: event.target.value }))
                    }
                  />
                </label>
                <label className="block">
                  <span className="field-label">Price per player spot</span>
                  <Input
                    type="number"
                    min="0"
                    value={slotForm.price}
                    onChange={(event) =>
                      setSlotForm((prev) => ({ ...prev, price: event.target.value }))
                    }
                  />
                </label>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="field-label">Booking type</span>
                  <Select
                    value={slotForm.productType}
                    onChange={(event) =>
                      setSlotForm((prev) => {
                        const nextProductType =
                          event.target.value as SlotFormState["productType"];
                        return {
                          ...prev,
                          productType: nextProductType,
                          requiresParty:
                            nextProductType === "MONTHLY" ? true : prev.requiresParty,
                        };
                      })
                    }
                  >
                    <option value="DAILY">Single visit</option>
                    <option value="MONTHLY">Monthly group booking</option>
                  </Select>
                </label>
                <label className="block">
                  <span className="field-label">What should people see?</span>
                  <Select
                    value={slotForm.status}
                    onChange={(event) =>
                      setSlotForm((prev) => ({
                        ...prev,
                        status: event.target.value as SlotFormState["status"],
                      }))
                    }
                  >
                    <option value="OPEN">Open</option>
                    <option value="BLOCKED">Blocked</option>
                  </Select>
                </label>
              </div>

              {slotForm.productType === "MONTHLY" ? (
                <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-control-bg)] px-4 py-3 text-sm text-[var(--color-text-secondary)]">
                  <p className="font-semibold text-[var(--color-text-primary)]">
                    Monthly group rule
                  </p>
                  <p className="mt-1">
                    This booking reserves the whole pitch. Total group payment will be{" "}
                    <span className="font-semibold text-[var(--color-text-primary)]">
                      {formatCurrency(monthlyReservationTotal)}
                    </span>{" "}
                    because it uses all {Math.max(1, Number(slotForm.capacity) || 1)} player spots.
                  </p>
                </div>
              ) : null}

              <label className="flex items-center gap-3 rounded-[var(--radius-md)] border border-[var(--color-border)] px-4 py-3 text-sm text-[var(--color-text-secondary)]">
                <input
                  type="checkbox"
                  checked={slotForm.requiresParty}
                  disabled={slotForm.productType === "MONTHLY"}
                  onChange={(event) =>
                    setSlotForm((prev) => ({ ...prev, requiresParty: event.target.checked }))
                  }
                />
                {slotForm.productType === "MONTHLY"
                  ? "Full group required for monthly bookings"
                  : "Only show this booking time to full groups"}
              </label>

              <label className="block">
                <span className="field-label">Helpful note</span>
                <Textarea
                  rows={3}
                  value={slotForm.notes}
                  onChange={(event) =>
                    setSlotForm((prev) => ({ ...prev, notes: event.target.value }))
                  }
                  placeholder="Floodlit, indoor, parking nearby, or any helpful note."
                />
              </label>

              <div className="grid gap-2 sm:grid-cols-2">
                <Button
                  type="submit"
                  variant="primary"
                  className="w-full"
                  disabled={slotPending || !subscription?.entitlementActive}
                >
                  {slotPending
                    ? "Saving..."
                    : editingSlotId
                      ? "Save booking time"
                      : "Create booking time"}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  className="w-full"
                  onClick={resetSlotForm}
                  disabled={slotPending}
                >
                  Start over
                </Button>
              </div>
            </form>
          </Card>
        </Stack>

        <Stack gap="lg">
          <Card className="space-y-5 p-5 sm:p-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="space-y-2">
                <p className="heading-kicker">Calendar</p>
                <h2 className="section-title">Tap a day, then add or edit booking times</h2>
                <p className="text-sm leading-7 text-[var(--color-text-secondary)]">
                  Tap a day to focus it. Tap a booking time to load it into the form on the left.
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                {(["month", "week", "day"] as const).map((view) => (
                  <Button
                    key={view}
                    type="button"
                    variant={calendarView === view ? "primary" : "secondary"}
                    size="sm"
                    onClick={() => setCalendarView(view)}
                  >
                    {view}
                  </Button>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setAnchorDate((prev) => shiftAnchorDate(prev, calendarView, -1))}
                >
                  Previous
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setAnchorDate(new Date())}
                >
                  Today
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setAnchorDate((prev) => shiftAnchorDate(prev, calendarView, 1))}
                >
                  Next
                </Button>
              </div>

              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <p className="text-sm font-semibold text-[var(--color-text-primary)]">
                  {formatCalendarHeading(anchorDate, calendarView)}
                </p>
                <Select
                  value={selectedPitchId}
                  onChange={(event) => setSelectedPitchId(event.target.value)}
                >
                  <option value="">All places</option>
                  {pitches.map((pitch) => (
                    <option key={pitch.id} value={pitch.id}>
                      {pitch.name}
                    </option>
                  ))}
                </Select>
              </div>
            </div>

              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => openCreateSlot("OPEN")}
                >
                  Add booking time
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => openCreateSlot("BLOCKED")}
                >
                  Block this time
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                onClick={() =>
                  document
                    .getElementById("host-reports")
                    ?.scrollIntoView({ behavior: "smooth", block: "start" })
                }
              >
                See money and people
              </Button>
            </div>

            {calendarLoading ? (
              <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] p-8 text-center text-sm text-[var(--color-text-secondary)]">
                Loading calendar...
              </div>
            ) : calendarView === "month" ? (
              <div className="grid grid-cols-7 gap-2">
                {weekdayLabels.map((label) => (
                  <div
                    key={label}
                    className="px-2 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-text-muted)]"
                  >
                    {label}
                  </div>
                ))}
                {buildMonthGrid(anchorDate).map((day) => {
                  const dayKey = getDayKey(day);
                  const summary = daySummaryByDate.get(dayKey);
                  const inMonth = day.getMonth() === anchorDate.getMonth();
                  const active = selectedDayKey === dayKey;

                  return (
                    <button
                      key={dayKey}
                      type="button"
                      onClick={() => handleSelectDay(dayKey)}
                      className={`min-h-28 rounded-[var(--radius-md)] border p-3 text-left transition ${
                        active
                          ? "border-[rgba(125,211,252,0.42)] bg-[rgba(125,211,252,0.12)]"
                          : "border-[var(--color-border)] bg-[var(--color-control-bg)] hover:border-[rgba(125,211,252,0.28)]"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span
                          className={`text-sm font-semibold ${
                            inMonth ? "text-[var(--color-text-primary)]" : "text-[var(--color-text-muted)]"
                          }`}
                        >
                          {day.getDate()}
                        </span>
                        {summary?.slotCount ? (
                          <Badge variant="accent">{summary.slotCount} times</Badge>
                        ) : null}
                      </div>
                      <div className="mt-3 space-y-1 text-xs text-[var(--color-text-secondary)]">
                        <p>{summary?.bookingCount ?? 0} bookings</p>
                        <p>{Math.round((summary?.utilization ?? 0) * 100)}% utilized</p>
                        <p>{formatCurrency(summary?.revenueSummaryEtb ?? 0)}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="grid gap-3">
                {(calendar?.days ?? []).map((day) => (
                  <button
                    key={day.date}
                    type="button"
                    onClick={() => handleSelectDay(day.date)}
                    className={`rounded-[var(--radius-md)] border px-4 py-3 text-left transition ${
                      selectedDayKey === day.date
                        ? "border-[rgba(125,211,252,0.42)] bg-[rgba(125,211,252,0.12)]"
                        : "border-[var(--color-border)] bg-[var(--color-control-bg)]"
                    }`}
                  >
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="text-sm font-semibold text-[var(--color-text-primary)]">
                          {new Date(`${day.date}T00:00:00`).toLocaleDateString(undefined, {
                            weekday: "long",
                            month: "short",
                            day: "numeric",
                          })}
                        </p>
                        <p className="text-xs text-[var(--color-text-secondary)]">
                          {day.slotCount} slots, {day.bookingCount} bookings,{" "}
                          {Math.round(day.utilization * 100)}% utilized
                        </p>
                      </div>
                      <Badge variant="accent">{formatCurrency(day.revenueSummaryEtb)}</Badge>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </Card>

          <Card className="space-y-4 p-5 sm:p-6">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-1">
                <p className="heading-kicker">Booking times</p>
                <h2 className="section-title">
                  {calendarView === "day"
                    ? "Times in this day"
                    : `Booking times for ${new Date(`${selectedDayKey}T00:00:00`).toLocaleDateString()}`}
                </h2>
              </div>
              <Badge variant="default">{visibleSlots.length} slots</Badge>
            </div>

            <div className="grid gap-3">
              {visibleSlots.length === 0 ? (
                <div className="rounded-[var(--radius-md)] border border-dashed border-[var(--color-border)] px-4 py-8 text-sm text-[var(--color-text-secondary)]">
                  No booking times in this window yet.
                </div>
              ) : (
                visibleSlots.map((slot) => (
                  <div
                    key={slot.id}
                    className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-control-bg)] p-4"
                  >
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div className="space-y-2">
                        <div className="flex flex-wrap gap-2">
                          <Badge variant={getStatusTone(slot.status)}>{slot.status}</Badge>
                          <Badge variant="default">{slot.productType}</Badge>
                          {slot.requiresParty ? <Badge variant="accent">Group required</Badge> : null}
                        </div>
                        <p className="text-base font-semibold text-[var(--color-text-primary)]">
                          {slot.pitchName}
                        </p>
                        <p className="text-sm text-[var(--color-text-secondary)]">
                          {new Date(slot.startsAt).toLocaleTimeString([], {
                            hour: "numeric",
                            minute: "2-digit",
                          })}{" "}
                          -{" "}
                          {new Date(slot.endsAt).toLocaleTimeString([], {
                            hour: "numeric",
                            minute: "2-digit",
                          })}
                        </p>
                        <p className="text-sm text-[var(--color-text-secondary)]">
                          {slot.bookingCount} bookings, {slot.assignedTicketCount} assigned,{" "}
                          {slot.checkedInCount} checked in
                        </p>
                        <p className="text-sm text-[var(--color-text-secondary)]">
                          {slot.capacity} capacity, {Math.round(slot.utilization * 100)}%
                          utilized, {formatCurrency(slot.revenueSummaryEtb)}
                        </p>
                        {slot.notes ? (
                          <p className="text-sm text-[var(--color-text-secondary)]">{slot.notes}</p>
                        ) : null}
                      </div>

                      <div className="flex gap-2">
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          onClick={() => populateSlotForm(slot)}
                        >
                          Edit
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => void handleDeleteSlot(slot.id)}
                        >
                          Delete
                        </Button>
                      </div>
                    </div>

                    {slot.bookings.length > 0 ? (
                      <div className="mt-4 space-y-3 border-t border-[var(--color-border)] pt-4">
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-text-muted)]">
                          Linked bookings
                        </p>
                        {slot.bookings.map((booking) => (
                          <div
                            key={booking.id}
                            className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-black/10 px-4 py-3"
                          >
                            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                              <div className="space-y-1">
                                <div className="flex flex-wrap gap-2">
                                  <Badge variant="default">{booking.status}</Badge>
                                  {booking.poolStatus ? (
                                    <Badge variant="accent">{booking.poolStatus}</Badge>
                                  ) : null}
                                </div>
                                <p className="text-sm font-semibold text-[var(--color-text-primary)]">
                                  {booking.customerName}
                                </p>
                                <p className="text-xs text-[var(--color-text-muted)]">
                                  {booking.customerEmail ?? booking.partyName ?? "No customer email"}
                                </p>
                              </div>

                              <div className="grid gap-1 text-sm text-[var(--color-text-secondary)]">
                                <p>
                                  {booking.quantity} seats, {formatCurrency(booking.totalAmount)}
                                </p>
                                <p>
                                  {booking.assignedTickets}/{booking.soldTickets} assigned,{" "}
                                  {booking.checkedInTickets} checked in
                                </p>
                                {booking.poolStatus ? (
                                  <p>
                                    Pool {formatCurrency(booking.poolAmountPaid ?? 0)} /{" "}
                                    {formatCurrency(booking.poolTotalAmount ?? 0)}
                                  </p>
                                ) : null}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </div>
                ))
              )}
            </div>
          </Card>
        </Stack>
      </div>
    </Stack>
  );
}

function MetricCard({
  label,
  value,
  detail,
  accent = false,
}: {
  label: string;
  value: string;
  detail: string;
  accent?: boolean;
}) {
  return (
    <div
      className={`rounded-[var(--radius-md)] border p-4 ${
        accent
          ? "border-[rgba(52,211,153,0.22)] bg-[rgba(52,211,153,0.12)]"
          : "border-[var(--color-border)] bg-[var(--color-control-bg)]"
      }`}
    >
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

function SimpleStepCard({
  step,
  title,
  body,
}: {
  step: string;
  title: string;
  body: string;
}) {
  return (
    <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-control-bg)] p-4">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--color-accent-soft)] text-sm font-semibold text-[var(--color-text-primary)]">
          {step}
        </div>
        <p className="text-sm font-semibold text-[var(--color-text-primary)]">{title}</p>
      </div>
      <p className="mt-3 text-sm leading-6 text-[var(--color-text-secondary)]">{body}</p>
    </div>
  );
}
