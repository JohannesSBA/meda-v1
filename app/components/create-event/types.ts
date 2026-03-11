/**
 * Types, constants, and utility functions for the CreateEventForm.
 *
 * Used for date/time conversion, form state shape, and recurrence weekday options.
 */

import type { Category } from "@/app/types/catagory";

export const WEEKDAY_OPTIONS = [
  { label: "Sun", value: "0" },
  { label: "Mon", value: "1" },
  { label: "Tue", value: "2" },
  { label: "Wed", value: "3" },
  { label: "Thu", value: "4" },
  { label: "Fri", value: "5" },
  { label: "Sat", value: "6" },
] as const;

export type InitialEventData = {
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

export type CreateEventFormProps = {
  categories: Category[];
  mode?: "create" | "edit";
  initialEvent?: InitialEventData;
};

export function combineLocalDateAndTime(date: string, time: string) {
  if (!date || !time) return "";
  return `${date}T${time}`;
}

export function toDateInput(value?: string | null) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function toTimeInput(value?: string | null) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const hour = String(d.getHours()).padStart(2, "0");
  const minute = String(d.getMinutes()).padStart(2, "0");
  return `${hour}:${minute}`;
}

export function toLocalDateTime(date: string, time: string) {
  if (!date) return undefined;
  const parsed = new Date(`${date}T${time || "00:00"}`);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}
