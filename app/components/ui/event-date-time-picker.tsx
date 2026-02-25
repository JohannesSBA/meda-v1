"use client";

import { useDatePicker } from "@rehookify/datepicker";
import type { DPDay, DPTime } from "@rehookify/datepicker";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FaArrowLeft, FaArrowRight } from "react-icons/fa6";
import { cn } from "./cn";

type EventDateTimePickerProps = {
  id: string;
  label: string;
  dateValue: string;
  timeValue: string;
  onChange: (date: string, time: string) => void;
  minDate?: Date;
  minuteInterval?: number;
  placeholder?: string;
  triggerClassName?: string;
};

const pad = (value: number) => String(value).padStart(2, "0");

const normalizeTimeParts = (raw?: string) => {
  const safe = raw && raw.includes(":") ? raw : "00:00";
  const [hourPart = "0", minutePart = "0"] = safe.split(":");
  const hours = Number(hourPart);
  const minutes = Number(minutePart);
  return {
    hours: Number.isNaN(hours) ? 0 : hours,
    minutes: Number.isNaN(minutes) ? 0 : minutes,
  };
};

const parseDateTimeValue = (
  dateValue?: string,
  timeValue?: string,
): Date | undefined => {
  if (!dateValue) return undefined;

  const [year, month, day] = dateValue.split("-").map((part) => Number(part));
  if ([year, month, day].some((part) => Number.isNaN(part))) return undefined;

  const { hours, minutes } = normalizeTimeParts(timeValue);
  return new Date(year, month - 1, day, hours, minutes);
};

const formatDateForInput = (date: Date) =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

const formatTimeForInput = (date: Date) =>
  `${pad(date.getHours())}:${pad(date.getMinutes())}`;

const getDayButtonClasses = (day: DPDay) =>
  cn(
    "flex h-10 items-center justify-center rounded-xl text-sm font-semibold transition",
    day.selected
      ? "bg-gradient-to-r from-[#7ccfff] to-[#8be8ff] text-[#062037] shadow"
      : day.inCurrentMonth
        ? "text-[#d7e9ff]"
        : "text-[#6f8aa6]",
    day.disabled
      ? "cursor-not-allowed opacity-30"
      : "hover:bg-[#18324b] hover:text-[#dff4ff]",
  );

const getTimeButtonClasses = (selected: boolean, disabled: boolean) =>
  cn(
    "w-full rounded-2xl border px-3 py-2 text-sm font-medium transition",
    selected
      ? "border-[#7ccfff]/60 bg-[#7ccfff]/18 text-[#e9f7ff] shadow-inner"
      : "border-transparent bg-[#0f1f2d]/80 text-[#c1d9ef] hover:border-[#7ccfff]/35 hover:bg-[#14304b]",
    disabled && "cursor-not-allowed opacity-30",
  );

export function EventDateTimePicker({
  id,
  label,
  dateValue,
  timeValue,
  onChange,
  minDate,
  minuteInterval = 30,
  placeholder = "Select date & time",
  triggerClassName,
}: EventDateTimePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);

  const parsedDate = useMemo(
    () => parseDateTimeValue(dateValue, timeValue),
    [dateValue, timeValue],
  );

  const selectedDates = useMemo(
    () => (parsedDate ? [parsedDate] : []),
    [parsedDate],
  );

  const handleDatesChange = useCallback(
    (dates: Date[]) => {
      const next = dates.at(-1);

      if (!next) {
        onChange("", "");
        return;
      }

      onChange(formatDateForInput(next), formatTimeForInput(next));
    },
    [onChange],
  );

  const { data, propGetters } = useDatePicker({
    selectedDates,
    onDatesChange: handleDatesChange,
    dates: {
      mode: "single",
      minDate,
    },
    calendar: {
      offsets: [0],
    },
    locale: {
      locale: "en-US",
      weekday: "short",
      monthName: "long",
      day: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    },
    time: {
      interval: minuteInterval,
      useLocales: true,
    },
  });

  const { calendars, weekDays, time } = data;
  const { addOffset, subtractOffset, dayButton, setOffset, timeButton } =
    propGetters;
  const calendar = calendars[0];

  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        popoverRef.current &&
        !popoverRef.current.contains(target) &&
        triggerRef.current &&
        !triggerRef.current.contains(target)
      ) {
        setIsOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsOpen(false);
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isOpen]);

  const displayDate = parsedDate
    ? parsedDate.toLocaleDateString(undefined, {
        weekday: "short",
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : null;

  const displayTime = timeValue
    ? parsedDate?.toLocaleTimeString(undefined, {
        hour: "numeric",
        minute: "2-digit",
      })
    : null;

  const timeSelectionExists = Boolean(timeValue);

  return (
    <div className="space-y-2">
      <label htmlFor={id} className="block text-xs uppercase tracking-[0.2em] text-[#7ccfff]">
        {label}
      </label>
      <div className="relative">
        <button
          ref={triggerRef}
          id={id}
          type="button"
          onClick={() => setIsOpen((prev) => !prev)}
          className={cn(
            "flex w-full items-center justify-between gap-3 rounded-2xl border border-white/12 bg-[#0d1b2a] px-4 py-3 text-left text-sm text-[#d8ebff] shadow-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7ccfff]/35",
            triggerClassName,
          )}
          aria-haspopup="dialog"
          aria-expanded={isOpen}
          aria-controls={`${id}-panel`}
        >
          <span className="truncate">
            {displayDate ? (
              <>
                <span>{displayDate}</span>
                {displayTime ? (
                  <span className="ml-1 text-[#9fc4e4]">· {displayTime}</span>
                ) : null}
              </>
            ) : (
              <span className="text-[#7aa8c6]">{placeholder}</span>
            )}
          </span>
          <svg
            className={cn(
              "h-4 w-4 text-[#7aa8c6] transition-transform",
              isOpen && "rotate-180",
            )}
            viewBox="0 0 20 20"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden={true}
          >
            <path
              d="M5 7.5L10 12.5L15 7.5"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>

        {isOpen ? (
          <div
            ref={popoverRef}
            id={`${id}-panel`}
            role="dialog"
            aria-label={`${label} picker`}
            className="absolute left-0 right-0 z-30 mt-2 w-full rounded-3xl border border-white/10 bg-[#0f2235]/95 p-4 shadow-2xl shadow-black/35 backdrop-blur sm:right-auto sm:w-[42rem] sm:p-6"
          >
            <div className="flex flex-col gap-6 lg:flex-row">
              <div className="min-w-0 flex-1 rounded-2xl border border-white/8 bg-[#0f1f2d] p-3 sm:p-4">
                <div className="mb-4 flex items-center justify-between">
                  <button
                    type="button"
                    className="rounded-full p-2 text-[#9fc4e4] transition hover:bg-white/8"
                    {...subtractOffset({ months: 1 })}
                  >
                    <span className="sr-only">Previous month</span>
                    <FaArrowLeft className="h-3.5 w-3.5" />
                  </button>
                  <div className="text-sm font-semibold text-[#e6f5ff]">
                    {calendar ? `${calendar.month} ${calendar.year}` : ""}
                  </div>
                  <button
                    type="button"
                    className="rounded-full p-2 text-[#9fc4e4] transition hover:bg-white/8"
                    {...addOffset({ months: 1 })}
                  >
                    <span className="sr-only">Next month</span>
                    <FaArrowRight className="h-3.5 w-3.5" />
                  </button>
                </div>

                <div className="grid grid-cols-7 gap-1.5 text-center text-[11px] font-semibold uppercase tracking-[0.18em] text-[#7aa8c6]">
                  {weekDays.map((day) => (
                    <span key={day}>{day}</span>
                  ))}
                </div>

                <div className="mt-2 grid grid-cols-7 gap-1.5">
                  {calendar?.days.map((day) => {
                    const dayProps = dayButton(day);
                    return (
                      <button
                        key={day.$date.toISOString()}
                        type="button"
                        {...dayProps}
                        className={cn(getDayButtonClasses(day), dayProps.className as string)}
                      >
                        {day.day}
                      </button>
                    );
                  })}
                </div>

                <div className="mt-4 flex items-center justify-between text-[11px] text-[#7aa8c6]">
                  <span>Week starts on Sunday</span>
                  <button
                    type="button"
                    className="font-semibold text-[#7ccfff] transition hover:text-[#9fe9ff]"
                    {...setOffset(new Date())}
                  >
                    Today
                  </button>
                </div>
              </div>

              <div className="min-w-0 flex-1 rounded-2xl border border-white/8 bg-[#0f1f2d] p-3 sm:p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#7aa8c6]">
                  Time
                </p>
                <div className="mt-2 max-h-60 overflow-y-auto pr-1">
                  <div className="grid grid-cols-2 gap-2">
                    {time.map((entry: DPTime) => {
                      const timeProps = timeButton(entry);
                      const isSelected = timeSelectionExists ? entry.selected : false;
                      return (
                        <button
                          key={`${entry.$date.toISOString()}-${entry.time}`}
                          type="button"
                          {...timeProps}
                          className={cn(
                            getTimeButtonClasses(isSelected, entry.disabled),
                            timeProps.className as string,
                          )}
                        >
                          {entry.time}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <button
                type="button"
                className="rounded-full px-4 py-2 text-sm font-semibold text-[#9fc4e4] transition hover:text-[#e6f5ff]"
                onClick={() => setIsOpen(false)}
              >
                Close
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
