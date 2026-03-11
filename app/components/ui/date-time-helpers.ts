/**
 * Date/time picker helper functions.
 *
 * Parsing, formatting, and styling utilities for EventDateTimePicker.
 */

import type { DPDay } from "@rehookify/datepicker";
import { cn } from "./cn";

export const pad = (value: number) => String(value).padStart(2, "0");

export function normalizeTimeParts(raw?: string) {
  const safe = raw && raw.includes(":") ? raw : "00:00";
  const [hourPart = "0", minutePart = "0"] = safe.split(":");
  const hours = Number(hourPart);
  const minutes = Number(minutePart);
  return {
    hours: Number.isNaN(hours) ? 0 : hours,
    minutes: Number.isNaN(minutes) ? 0 : minutes,
  };
}

export function parseDateTimeValue(
  dateValue?: string,
  timeValue?: string,
): Date | undefined {
  if (!dateValue) return undefined;

  const [year, month, day] = dateValue.split("-").map((part) => Number(part));
  if ([year, month, day].some((part) => Number.isNaN(part))) return undefined;

  const { hours, minutes } = normalizeTimeParts(timeValue);
  return new Date(year, month - 1, day, hours, minutes);
}

export const formatDateForInput = (date: Date) =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

export const formatTimeForInput = (date: Date) =>
  `${pad(date.getHours())}:${pad(date.getMinutes())}`;

export function getDayButtonClasses(day: DPDay) {
  return cn(
    "flex h-11 items-center justify-center rounded-xl text-sm font-semibold transition",
    day.selected
      ? "bg-gradient-to-r from-[#7ccfff] to-[#8be8ff] text-[#062037] shadow"
      : day.inCurrentMonth
        ? "text-[#d7e9ff]"
        : "text-[#6f8aa6]",
    day.disabled
      ? "cursor-not-allowed opacity-30"
      : "hover:bg-[#18324b] hover:text-[#dff4ff]",
  );
}

export function getTimeButtonClasses(selected: boolean, disabled: boolean) {
  return cn(
    "w-full rounded-2xl border px-3 py-2 text-sm font-medium transition",
    selected
      ? "border-[#7ccfff]/60 bg-[#7ccfff]/18 text-[#e9f7ff] shadow-inner"
      : "border-transparent bg-[#0f1f2d]/80 text-[#c1d9ef] hover:border-[#7ccfff]/35 hover:bg-[#14304b]",
    disabled && "cursor-not-allowed opacity-30",
  );
}
