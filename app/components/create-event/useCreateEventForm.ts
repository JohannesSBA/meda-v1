/**
 * useCreateEventForm -- Custom hook for event creation/edit form state and handlers.
 *
 * Manages form state, auth session, initial data hydration, submit logic,
 * geolocation, and derived values (preview, min dates).
 */

import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth/client";
import type { User } from "@neondatabase/auth/types";
import {
  combineLocalDateAndTime,
  toDateInput,
  toTimeInput,
  toLocalDateTime,
  type InitialEventData,
  type CreateEventFormProps,
} from "./types";
import type { Category } from "@/app/types/catagory";

export type CreateEventFormState = {
  eventName: string;
  categoryId: string;
  description: string;
  image: File | null;
  imagePreview: string;
  startDate: string;
  startTime: string;
  endDate: string;
  endTime: string;
  location: string;
  latitude: string;
  longitude: string;
  capacity: string;
  price: string;
  isRecurring: boolean;
  recurrenceFrequency: string;
  recurrenceInterval: string;
  recurrenceUntil: string;
  recurrenceWeekdays: string;
};

export function useCreateEventForm({
  categories,
  mode = "create",
  initialEvent,
}: CreateEventFormProps) {
  const [form, setForm] = useState<CreateEventFormState>({
    eventName: "",
    categoryId: categories[0]?.categoryId ?? "",
    description: "",
    image: null,
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
    let cancelled = false;
    authClient.getSession().then((result) => {
      if (!cancelled && result.data?.user) {
        setUser(result.data.user);
      }
    });
    return () => { cancelled = true; };
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

  useEffect(() => {
    setTimezone(Intl.DateTimeFormat().resolvedOptions().timeZone);
  }, []);

  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >,
  ) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

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

  const onRecurrenceChange = (field: string, value: string | boolean) => {
    if (field === "isRecurring") {
      setForm((prev) => ({ ...prev, isRecurring: value as boolean }));
    } else {
      setForm((prev) => ({ ...prev, [field]: value }));
    }
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

  return {
    form,
    setForm,
    submitting,
    applyToSeries,
    setApplyToSeries,
    timezone,
    locStatus,
    mode,
    initialEvent,
    categories,
    preview,
    startMinDate,
    endMinDate,
    handleChange,
    handleImageChange,
    handleSubmit,
    handleUseMyLocation,
    onRecurrenceChange,
  };
}
