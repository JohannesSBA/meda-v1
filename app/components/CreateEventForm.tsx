"use client";
import Image from "next/image";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Category } from "../types/catagory";
import axios from "axios";
import { authClient } from "@/lib/auth/client";
import { User } from "@neondatabase/auth/types";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Input } from "./ui/input";
import { Select } from "./ui/select";
import { Textarea } from "./ui/textarea";
import { Button } from "./ui/button";
import { Card } from "./ui/card";
import { Badge } from "./ui/badge";
import { EventDateTimePicker } from "./ui/event-date-time-picker";

function combineLocalDateAndTime(date: string, time: string) {
  if (!date || !time) return "";
  return `${date}T${time}`;
}

const WEEKDAY_OPTIONS = [
  { label: "Sun", value: "0" },
  { label: "Mon", value: "1" },
  { label: "Tue", value: "2" },
  { label: "Wed", value: "3" },
  { label: "Thu", value: "4" },
  { label: "Fri", value: "5" },
  { label: "Sat", value: "6" },
] as const;

type InitialEventData = {
  eventId: string;
  eventName: string;
  categoryId: string;
  description?: string | null;
  pictureUrl?: string | null;
  eventDatetime: string;
  eventEndtime: string;
  addressLabel?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  capacity?: number | null;
  priceField?: number | null;
  isRecurring?: boolean;
  recurrenceKind?: string | null;
  recurrenceInterval?: number | null;
  recurrenceUntil?: string | null;
  recurrenceWeekdays?: string | null;
  seriesId?: string | null;
  seriesCount?: number;
};

type CreateEventFormProps = {
  categories: Category[];
  mode?: "create" | "edit";
  initialEvent?: InitialEventData;
};

function toDateInput(value?: string | null) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function toTimeInput(value?: string | null) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const hour = String(d.getHours()).padStart(2, "0");
  const minute = String(d.getMinutes()).padStart(2, "0");
  return `${hour}:${minute}`;
}

function toLocalDateTime(date: string, time: string) {
  if (!date) return undefined;
  const parsed = new Date(`${date}T${time || "00:00"}`);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

export default function CreateEventForm({
  categories,
  mode = "create",
  initialEvent,
}: CreateEventFormProps) {
  const [form, setForm] = useState({
    eventName: "",
    categoryId: categories[0]?.categoryId ?? "",
    description: "",
    image: null as File | null,
    imagePreview: "",
    startDate: "",
    startTime: "",
    endDate: "",
    endTime: "",
    location: "",
    latitude: "9.01524",
    longitude: "38.814349",
    capacity: "10",
    price: "0",
    isRecurring: false,
    recurrenceFrequency: "weekly",
    recurrenceInterval: "1",
    recurrenceUntil: "",
    recurrenceWeekdays: "1",
  });
  const [submitting, setSubmitting] = useState(false);
  const [applyToSeries, setApplyToSeries] = useState(false);
  const [timezone, setTimezone] = useState("");
  const [locStatus, setLocStatus] = useState<
    "idle" | "locating" | "error" | "done"
  >("idle");
  const [user, setUser] = useState<User | null>(null);

  const router = useRouter();

  useEffect(() => {
    authClient.getSession().then((result) => {
      if (result.data?.user) {
        setUser(result.data.user);
      }
    });
  }, []);

  useEffect(() => {
    if (!initialEvent) return;
    setForm((prev) => ({
      ...prev,
      eventName: initialEvent.eventName ?? "",
      categoryId: initialEvent.categoryId ?? categories[0]?.categoryId ?? "",
      description: initialEvent.description ?? "",
      image: null,
      imagePreview: initialEvent.pictureUrl ?? "",
      startDate: toDateInput(initialEvent.eventDatetime),
      startTime: toTimeInput(initialEvent.eventDatetime),
      endDate: toDateInput(initialEvent.eventEndtime),
      endTime: toTimeInput(initialEvent.eventEndtime),
      location: initialEvent.addressLabel ?? "",
      latitude: String(initialEvent.latitude ?? "9.01524"),
      longitude: String(initialEvent.longitude ?? "38.814349"),
      capacity:
        initialEvent.capacity == null ? "" : String(Math.max(1, initialEvent.capacity)),
      price:
        initialEvent.priceField == null ? "0" : String(Math.max(0, initialEvent.priceField)),
      isRecurring: Boolean(initialEvent.isRecurring),
      recurrenceFrequency:
        initialEvent.recurrenceKind === "daily" ||
        initialEvent.recurrenceKind === "weekly" ||
        initialEvent.recurrenceKind === "custom"
          ? initialEvent.recurrenceKind
          : "weekly",
      recurrenceInterval: String(initialEvent.recurrenceInterval ?? 1),
      recurrenceUntil: toDateInput(initialEvent.recurrenceUntil),
      recurrenceWeekdays: initialEvent.recurrenceWeekdays ?? "1",
    }));
    setApplyToSeries(Boolean(initialEvent.isRecurring && initialEvent.seriesId));
  }, [initialEvent, categories]);

  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >,
  ) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  useEffect(() => {
    setTimezone(Intl.DateTimeFormat().resolvedOptions().timeZone);
  }, []);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    if (file && file.size > 6 * 1024 * 1024) {
      toast.error("Image too large (max 6MB)");
      return;
    }
    setForm((prev) => ({ ...prev, image: file }));
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setForm((prev) => ({ ...prev, imagePreview: reader.result as string }));
      };
      reader.readAsDataURL(file);
    } else {
      setForm((prev) => ({ ...prev, imagePreview: "" }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const startDateTime = combineLocalDateAndTime(
      form.startDate,
      form.startTime,
    );
    const endDateTime = combineLocalDateAndTime(form.endDate, form.endTime);
    if (
      startDateTime &&
      endDateTime &&
      new Date(endDateTime) <= new Date(startDateTime)
    ) {
      toast.error("End time must be after start time");
      return;
    }
    if (!startDateTime || !endDateTime) {
      toast.error("Please select both start and end date/time");
      return;
    }
    if (form.isRecurring && !form.recurrenceUntil) {
      toast.error("Please set when recurrence ends");
      return;
    }
    if (
      form.isRecurring &&
      form.recurrenceFrequency === "custom" &&
      !form.recurrenceWeekdays
    ) {
      toast.error("Choose at least one weekday for custom recurrence");
      return;
    }
    setSubmitting(true);
    if (mode === "edit" && applyToSeries && (initialEvent?.seriesCount ?? 1) > 1) {
      const confirmed = window.confirm(
        `This will update ${initialEvent?.seriesCount} occurrences in this recurring series. Continue?`
      );
      if (!confirmed) {
        setSubmitting(false);
        return;
      }
    }
    const fd = new FormData();
    fd.append("eventName", form.eventName);
    fd.append("categoryId", form.categoryId);
    if (form.description) fd.append("description", form.description);
    fd.append("startDate", startDateTime);
    fd.append("endDate", endDateTime);
    fd.append("location", form.location);
    fd.append("latitude", form.latitude);
    fd.append("longitude", form.longitude);
    if (form.capacity) fd.append("capacity", form.capacity);
    if (form.price) fd.append("price", form.price);
    if (form.isRecurring) {
      fd.append("recurrenceEnabled", "true");
      fd.append("recurrenceFrequency", form.recurrenceFrequency);
      fd.append("recurrenceInterval", form.recurrenceInterval || "1");
      fd.append(
        "recurrenceUntil",
        combineLocalDateAndTime(
          form.recurrenceUntil,
          form.endTime || form.startTime,
        ),
      );
      if (form.recurrenceFrequency === "custom") {
        fd.append("recurrenceWeekdays", form.recurrenceWeekdays);
      }
    }
    if (mode === "create" && user?.id) fd.append("userId", user.id);
    if (mode === "edit" && initialEvent?.seriesId) fd.append("seriesId", initialEvent.seriesId);
    if (form.image) fd.append("image", form.image);

    try {
      if (mode === "create") {
        const res = await axios.post(
          `${process.env.NEXT_PUBLIC_BASE_URL ?? ""}/api/events/create`,
          fd,
          {
            headers: { "Content-Type": "multipart/form-data" },
          },
        );
        toast.success("Event created successfully");
        router.push(`/events/${res.data.event.eventId}`);
      } else {
        fd.append("applyToSeries", applyToSeries ? "true" : "false");
        const res = await axios.patch(
          `${process.env.NEXT_PUBLIC_BASE_URL ?? ""}/api/admin/events/${initialEvent?.eventId}`,
          fd,
          {
            headers: { "Content-Type": "multipart/form-data" },
          },
        );
        const count = Number(res.data?.updatedCount) || 1;
        toast.success(
          res.data?.bulkUpdated
            ? `Updated ${count} occurrences`
            : "Event updated successfully",
        );
        router.push("/profile");
      }
    } catch (err) {
      console.error(err);
      toast.error(mode === "create" ? "Failed to create event" : "Failed to update event");
    } finally {
      setSubmitting(false);
    }
  };

  const handleUseMyLocation = () => {
    if (!navigator.geolocation) {
      toast.error("Geolocation not supported");
      return;
    }
    setLocStatus("locating");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setForm((prev) => ({
          ...prev,
          latitude: pos.coords.latitude.toFixed(6),
          longitude: pos.coords.longitude.toFixed(6),
        }));
        setLocStatus("done");
      },
      () => {
        setLocStatus("error");
        toast.error("Could not fetch location");
      },
      { enableHighAccuracy: true, timeout: 8000 },
    );
  };

  const preview = useMemo(
    () => ({
      title: form.eventName || "Untitled event",
      date: combineLocalDateAndTime(form.startDate, form.startTime)
        ? new Date(
            combineLocalDateAndTime(form.startDate, form.startTime),
          ).toLocaleString()
        : "Date TBD",
      location: form.location || "Location pending",
      price:
        form.price && Number(form.price) > 0
          ? `ETB ${Number(form.price).toFixed(0)}`
          : "Free",
      capacity: form.capacity || "—",
    }),
    [
      form.eventName,
      form.startDate,
      form.startTime,
      form.location,
      form.price,
      form.capacity,
    ],
  );

  const endMinDate = useMemo(
    () => {
      const start = toLocalDateTime(form.startDate, form.startTime);
      if (!start) return undefined;
      return new Date(start.getTime() + 60_000);
    },
    [form.startDate, form.startTime],
  );
  const startMinDate = useMemo(() => new Date(), []);

  return (
    <div className="grid gap-8 lg:grid-cols-[1.5fr_1fr]">
      <form
        className="relative z-20 space-y-7 rounded-2xl border border-white/6 bg-[#0f1f2d]/80 px-6 py-8 shadow-xl shadow-black/30 backdrop-blur"
        onSubmit={handleSubmit}
      >
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-xs uppercase tracking-[0.18em] text-[#7ccfff]">
              Event basics
            </p>
            <h2 className="text-xl font-semibold text-white">Details</h2>
          </div>
          <Badge className="bg-white/10 text-xs text-[#b9cde4]">
            TZ: {timezone || "Auto"}
          </Badge>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="md:col-span-2">
            <label
              htmlFor="eventName"
              className="mb-1 block text-sm font-medium text-[#b9cde4]"
            >
              Event name
            </label>
            <Input
              type="text"
              id="eventName"
              name="eventName"
              required
              placeholder="e.g. Friday Night 5v5"
              className="h-12 bg-[#112030] px-4"
              value={form.eventName}
              onChange={handleChange}
            />
          </div>

          <div>
            <label
              htmlFor="category"
              className="mb-1 block text-sm font-medium text-[#b9cde4]"
            >
              Category
            </label>
            <Select
              id="category"
              name="categoryId"
              className="h-12 bg-[#112030] px-4"
              value={form.categoryId}
              onChange={handleChange}
            >
              {categories.map((category) => (
                <option value={category.categoryId} key={category.categoryId}>
                  {category.categoryName}
                </option>
              ))}
            </Select>
          </div>

          <div>
            <label
              htmlFor="price"
              className="mb-1 block text-sm font-medium text-[#b9cde4]"
            >
              Price (ETB)
            </label>
            <Input
              type="number"
              id="price"
              name="price"
              min="0"
              step="1"
              placeholder="0 for free"
              className="h-12 bg-[#112030] px-4"
              value={form.price}
              onChange={handleChange}
            />
          </div>
        </div>

        <div className="space-y-4 rounded-xl border border-white/8 bg-[#0f2336] p-4 shadow-inner shadow-black/20">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-white">Schedule</p>
              <p className="text-xs text-[#7aa8c6]">
                Choose date and time in your local timezone
              </p>
            </div>
            <span className="text-xs text-[#7aa8c6]">
              Local: {timezone || "device"}
            </span>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2 rounded-xl border border-white/10 bg-[#112030] p-3">
              <p className="text-xs uppercase tracking-wider text-[#7ccfff]">
                Starts
              </p>
              <EventDateTimePicker
                id="startDateTime"
                label="Start date & time"
                dateValue={form.startDate}
                timeValue={form.startTime}
                onChange={(date, time) =>
                  setForm((prev) => ({
                    ...prev,
                    startDate: date,
                    startTime: time,
                  }))
                }
                placeholder="Select start date & time"
                minuteInterval={15}
                minDate={startMinDate}
              />
            </div>
            <div className="space-y-2 rounded-xl border border-white/10 bg-[#112030] p-3">
              <p className="text-xs uppercase tracking-wider text-[#7ccfff]">
                Ends
              </p>
              <EventDateTimePicker
                id="endDateTime"
                label="End date & time"
                dateValue={form.endDate}
                timeValue={form.endTime}
                onChange={(date, time) =>
                  setForm((prev) => ({
                    ...prev,
                    endDate: date,
                    endTime: time,
                  }))
                }
                minDate={endMinDate}
                placeholder="Select end date & time"
                minuteInterval={15}
              />
            </div>
          </div>
        </div>

        <div className="space-y-4 rounded-xl border border-white/8 bg-[#0f2336] p-4 shadow-inner shadow-black/20">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-white">
                Recurring event
              </p>
              <p className="text-xs text-[#7aa8c6]">
                Repeat this event daily, weekly, or custom weekdays.
              </p>
            </div>
            <label className="inline-flex items-center gap-2 text-sm text-[#c7d9eb]">
              <input
                type="checkbox"
                checked={form.isRecurring}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    isRecurring: e.target.checked,
                  }))
                }
              />
              Enable
            </label>
          </div>

          {form.isRecurring ? (
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium text-[#b9cde4]">
                  Frequency
                </label>
                <Select
                  name="recurrenceFrequency"
                  value={form.recurrenceFrequency}
                  onChange={handleChange}
                  className="h-12 bg-[#112030] px-4"
                >
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="custom">Custom weekly days</option>
                </Select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-[#b9cde4]">
                  Every
                </label>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min={1}
                    name="recurrenceInterval"
                    value={form.recurrenceInterval}
                    onChange={handleChange}
                    className="h-12 w-24 bg-[#112030] px-4"
                  />
                  <span className="text-sm text-[#9fc4e4]">
                    {form.recurrenceFrequency === "daily"
                      ? "day(s)"
                      : "week(s)"}
                  </span>
                </div>
              </div>

              {form.recurrenceFrequency === "custom" ? (
                <div className="md:col-span-2">
                  <label className="mb-2 block text-sm font-medium text-[#b9cde4]">
                    On weekdays
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {WEEKDAY_OPTIONS.map((day) => {
                      const selected = new Set(
                        form.recurrenceWeekdays.split(",").filter(Boolean),
                      );
                      const isSelected = selected.has(day.value);
                      return (
                        <button
                          key={day.value}
                          type="button"
                          onClick={() => {
                            setForm((prev) => {
                              const current = new Set(
                                prev.recurrenceWeekdays
                                  .split(",")
                                  .filter(Boolean),
                              );
                              if (current.has(day.value))
                                current.delete(day.value);
                              else current.add(day.value);
                              const sorted = [...current].sort(
                                (a, b) => Number(a) - Number(b),
                              );
                              return {
                                ...prev,
                                recurrenceWeekdays: sorted.join(","),
                              };
                            });
                          }}
                          className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
                            isSelected
                              ? "border-[#22FF88] bg-[#22FF88]/20 text-[#bfffe0]"
                              : "border-white/15 bg-white/5 text-[#b9cde4] hover:border-[#22FF88]/60"
                          }`}
                        >
                          {day.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : null}

              <div>
                <label className="mb-1 block text-sm font-medium text-[#b9cde4]">
                  Repeat until
                </label>
                <Input
                  type="date"
                  name="recurrenceUntil"
                  value={form.recurrenceUntil}
                  onChange={handleChange}
                  className="h-12 bg-[#112030] px-4"
                />
              </div>
            </div>
          ) : null}
        </div>

        <div>
          <label
            htmlFor="description"
            className="mb-1 block text-sm font-medium text-[#b9cde4]"
          >
            Description
          </label>
          <Textarea
            id="description"
            name="description"
            rows={4}
            placeholder="Format, skill level, what to bring, etc."
            className="bg-[#112030] px-4 py-3"
            value={form.description}
            onChange={handleChange}
          />
          <div className="mt-1 text-xs text-[#7aa8c6]">
            Keep it crisp. Players decide fast.
          </div>
        </div>

        <div className="rounded-xl border border-white/8 bg-[#0f2336] p-4 shadow-inner shadow-black/30">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-white">Location</p>
              <p className="text-xs text-[#7aa8c6]">
                Searchable label + precise pin
              </p>
            </div>
            <Button
              type="button"
              onClick={handleUseMyLocation}
              variant="secondary"
              size="sm"
              className="rounded-full px-3"
            >
              {locStatus === "locating" ? "Locating…" : "Use my location"}
            </Button>
          </div>

          <div className="mt-3 space-y-3">
            <Input
              type="text"
              id="location"
              name="location"
              placeholder="e.g. Gulele Stadium"
              required
              className="h-12 bg-[#112030] px-4"
              value={form.location}
              onChange={handleChange}
            />

            <MapPicker
              latitude={form.latitude}
              longitude={form.longitude}
              onChange={(lat, lng) =>
                setForm((prev) => ({
                  ...prev,
                  latitude: lat.toString(),
                  longitude: lng.toString(),
                }))
              }
            />

            <div className="grid gap-3 sm:grid-cols-2 text-xs text-[#9fc4e4]">
              <div className="rounded-lg border border-white/8 bg-[#0f1f2d] px-3 py-2">
                <span className="text-[#7ccfff]">Lat</span>: {form.latitude}
              </div>
              <div className="rounded-lg border border-white/8 bg-[#0f1f2d] px-3 py-2">
                <span className="text-[#7ccfff]">Lng</span>: {form.longitude}
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label
              htmlFor="capacity"
              className="mb-1 block text-sm font-medium text-[#b9cde4]"
            >
              Capacity
            </label>
            <Input
              type="number"
              id="capacity"
              name="capacity"
              min="1"
              placeholder="eg. 10"
              className="h-12 bg-[#112030] px-4"
              value={form.capacity}
              onChange={handleChange}
            />
          </div>
          <div>
            <label
              htmlFor="image"
              className="mb-1 block text-sm font-medium text-[#b9cde4]"
            >
              Event image (≤6MB)
            </label>
            <input
              type="file"
              id="image"
              name="image"
              accept="image/*"
              className="block w-full text-[#b9cde4]"
              onChange={handleImageChange}
            />
            {form.imagePreview && (
              <div className="mt-2 overflow-hidden rounded-lg border border-white/8 bg-[#0f1f2a]">
                <Image
                  src={form.imagePreview}
                  alt="Event Preview"
                  width={640}
                  height={360}
                  className="h-auto w-full object-cover"
                />
              </div>
            )}
          </div>
        </div>

        <div>
          {mode === "edit" && form.isRecurring && initialEvent?.seriesId ? (
            <div className="mb-3 space-y-2 rounded-xl border border-white/10 bg-[#0f1f2d] p-3 text-sm text-[#c4d8ef]">
              <label className="inline-flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={applyToSeries}
                  onChange={(e) => setApplyToSeries(e.target.checked)}
                />
                Apply edits to all occurrences in this series
              </label>
              {applyToSeries ? (
                <p className="text-xs text-[#9fc4e4]">
                  This will update {initialEvent.seriesCount ?? 1} occurrence
                  {(initialEvent.seriesCount ?? 1) === 1 ? "" : "s"}.
                </p>
              ) : null}
            </div>
          ) : null}
          <Button
            type="submit"
            disabled={submitting}
            variant="primary"
            size="lg"
            className="mt-2 h-12 w-full rounded-full px-6 text-base uppercase tracking-wider"
          >
            {submitting ? "Saving…" : mode === "create" ? "Create Event" : "Save Changes"}
          </Button>
        </div>
      </form>

      <Card className="relative z-10 space-y-4 rounded-2xl bg-[#0d1d2e]/70 p-6 backdrop-blur">
        <div className="space-y-1">
          <p className="text-xs uppercase tracking-[0.2em] text-[#7ccfff]">
            Live preview
          </p>
          <div className="rounded-2xl border border-white/10 bg-linear-to-br from-[#0f2235] to-[#0b1624] p-5 shadow-lg shadow-black/30">
            <div className="flex items-center justify-between text-xs text-[#9fc4e4]">
              <span>{preview.date}</span>
              <span className="rounded-full bg-white/10 px-2 py-1 text-[11px] text-[#22FF88]">
                {preview.price}
              </span>
            </div>
            <h3 className="mt-3 text-lg font-semibold text-white">
              {preview.title}
            </h3>
            <p className="mt-1 text-sm text-[#9fc4e4]">{preview.location}</p>
            <div className="mt-3 flex items-center gap-2 text-xs text-[#7aa8c6]">
              <span className="rounded-full bg-white/5 px-2 py-1">
                Capacity: {preview.capacity}
              </span>
              <span className="rounded-full bg-white/5 px-2 py-1">
                TZ: {timezone || "local"}
              </span>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-white/8 bg-[#0f2235] p-4 text-sm text-[#b9cde4] shadow-inner shadow-black/20">
          <p className="mb-2 text-xs uppercase tracking-[0.14em] text-[#7ccfff]">
            Tips
          </p>
          <ul className="space-y-2 list-disc pl-4">
            <li>Lead with format and level so players self-select.</li>
            <li>
              Add exact pin; we’ll surface it on the map for nearby players.
            </li>
            <li>Images load best at 1200x630, under 6MB.</li>
          </ul>
        </div>
      </Card>
    </div>
  );
}

type MapPickerProps = {
  latitude: string;
  longitude: string;
  onChange: (lat: number, lng: number) => void;
};

const DEFAULT_CENTER: [number, number] = [38.7578, 9.0301]; // Addis Ababa-ish fallback

function MapPicker({ latitude, longitude, onChange }: MapPickerProps) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markerRef = useRef<mapboxgl.Marker | null>(null);
  const onChangeRef = useRef(onChange);

  const token = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;

  const [initialCoords] = useState<[number, number]>(() =>
    Number.isFinite(Number(latitude)) && Number.isFinite(Number(longitude))
      ? [Number(longitude), Number(latitude)]
      : DEFAULT_CENTER,
  );

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  const handleSelect = useCallback((lng: number, lat: number) => {
    const trimmedLng = Number(lng.toFixed(6));
    const trimmedLat = Number(lat.toFixed(6));
    onChangeRef.current(trimmedLat, trimmedLng);
  }, []);

  useEffect(() => {
    if (!mapContainerRef.current || !token) return;

    mapboxgl.accessToken = token;

    const map = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: "mapbox://styles/mapbox/streets-v12",
      center: initialCoords,
      zoom: 12,
    });
    mapRef.current = map;

    const marker = new mapboxgl.Marker({ draggable: true })
      .setLngLat(initialCoords)
      .addTo(map);
    markerRef.current = marker;

    const updateFromMarker = () => {
      const lngLat = marker.getLngLat();
      handleSelect(lngLat.lng, lngLat.lat);
    };

    marker.on("dragend", updateFromMarker);

    map.on("click", (event) => {
      marker.setLngLat(event.lngLat);
      handleSelect(event.lngLat.lng, event.lngLat.lat);
    });

    map.on("load", () => map.resize());

    return () => {
      marker.remove();
      map.remove();
    };
  }, [handleSelect, initialCoords, token]);

  // Keep marker in sync when user types coordinates manually.
  useEffect(() => {
    const map = mapRef.current;
    const marker = markerRef.current;
    const latNum = Number(latitude);
    const lngNum = Number(longitude);
    if (!map || !marker || !Number.isFinite(latNum) || !Number.isFinite(lngNum))
      return;
    const nextCoords: [number, number] = [lngNum, latNum];
    marker.setLngLat(nextCoords);
    map.easeTo({ center: nextCoords, duration: 250 });
  }, [latitude, longitude]);

  if (!token) {
    return (
      <div className="rounded-lg border border-[#22344a] bg-[#0f1f2f] p-4 text-sm text-[#b9cde4]">
        Set{" "}
        <code className="text-[#89e7ff]">NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN</code>{" "}
        to enable the map picker.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-[#89e7ff]">Pin the pitch</h3>
        <p className="text-xs text-[#b9cde4]">
          Click the map or drag the pin to set coordinates.
        </p>
      </div>
      <div
        ref={mapContainerRef}
        className="h-72 w-full overflow-hidden rounded-lg border border-[#22344a] bg-[#0b1624]"
      />
      <div className="flex gap-3 text-xs text-[#d7e9ff]">
        <div className="rounded-md bg-[#102033] px-3 py-2">
          <span className="text-[#89e7ff]">Lat:</span>{" "}
          {(Number.isFinite(Number(latitude))
            ? Number(latitude)
            : initialCoords[1]
          ).toFixed(6)}
        </div>
        <div className="rounded-md bg-[#102033] px-3 py-2">
          <span className="text-[#89e7ff]">Lng:</span>{" "}
          {(Number.isFinite(Number(longitude))
            ? Number(longitude)
            : initialCoords[0]
          ).toFixed(6)}
        </div>
      </div>
    </div>
  );
}
