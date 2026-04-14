/**
 * EventDateTimePicker -- Combined date and time picker for event creation.
 *
 * Uses @rehookify/datepicker. Renders calendar grid and time slots in a popover.
 */

"use client";

import { useDatePicker } from "@rehookify/datepicker";
import type { DPTime } from "@rehookify/datepicker";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { FaArrowLeft, FaArrowRight } from "react-icons/fa6";
import { cn } from "./cn";
import {
  parseDateTimeValue,
  formatDateForInput,
  formatTimeForInput,
  getDayButtonClasses,
  getTimeButtonClasses,
} from "./date-time-helpers";

/** Above site header (z-50), mobile overlays (~70), and sticky sidebars on create-event. */
const DATE_PICKER_Z_BACKDROP = 10_000;
const DATE_PICKER_Z_PANEL = 10_001;

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
  const [mounted, setMounted] = useState(false);
  const [panelBox, setPanelBox] = useState({ top: 0, left: 0, width: 672 });
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    setTimeout(() => {
      setMounted(true);
    }, 0);
  }, []);

  const updatePanelPosition = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger || typeof window === "undefined") return;
    const rect = trigger.getBoundingClientRect();
    const vw = window.innerWidth;
    const maxW = Math.min(672, vw - 24);
    const margin = 12;
    let left = rect.left;
    if (left + maxW > vw - margin) {
      left = Math.max(margin, vw - maxW - margin);
    }
    setPanelBox({ top: rect.bottom + 8, left, width: maxW });
  }, []);

  useLayoutEffect(() => {
    if (!isOpen) return;
    updatePanelPosition();
    const onReposition = () => updatePanelPosition();
    window.addEventListener("resize", onReposition);
    window.addEventListener("scroll", onReposition, true);
    return () => {
      window.removeEventListener("resize", onReposition);
      window.removeEventListener("scroll", onReposition, true);
    };
  }, [isOpen, updatePanelPosition]);

  const parsedDate = useMemo(
    () => parseDateTimeValue(dateValue, timeValue),
    [dateValue, timeValue],
  );

  const selectedDates = useMemo(() => (parsedDate ? [parsedDate] : []), [parsedDate]);

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
  const { addOffset, subtractOffset, dayButton, setOffset, timeButton } = propGetters;
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
                  <span className="ml-1 text-[var(--color-text-secondary)]">· {displayTime}</span>
                ) : null}
              </>
            ) : (
              <span className="text-[var(--color-text-muted)]">{placeholder}</span>
            )}
          </span>
          <svg
            className={cn(
              "h-4 w-4 text-[var(--color-text-muted)] transition-transform",
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

        {mounted && isOpen
          ? createPortal(
              <>
                <div
                  className="fixed inset-0 bg-black/40"
                  style={{ zIndex: DATE_PICKER_Z_BACKDROP }}
                  onClick={() => setIsOpen(false)}
                  aria-hidden
                />
                <div
                  ref={popoverRef}
                  id={`${id}-panel`}
                  role="dialog"
                  aria-label={`${label} picker`}
                  className="overflow-y-auto rounded-2xl border border-white/10 bg-[#0f2235]/98 p-4 shadow-2xl shadow-black/35 backdrop-blur sm:rounded-3xl sm:p-6"
                  style={{
                    position: "fixed",
                    top: panelBox.top,
                    left: panelBox.left,
                    width: panelBox.width,
                    zIndex: DATE_PICKER_Z_PANEL,
                    maxHeight: `min(80vh, calc(100dvh - ${panelBox.top}px - 12px))`,
                  }}
                >
                  <div className="flex flex-col gap-6 lg:flex-row">
                    <div className="min-w-0 flex-1 rounded-2xl border border-white/8 bg-[#0f1f2d] p-3 sm:p-4">
                      <div className="mb-4 flex items-center justify-between">
                        <button
                          type="button"
                          className="flex h-11 w-11 items-center justify-center rounded-full text-[var(--color-text-secondary)] transition hover:bg-white/8"
                          {...subtractOffset({ months: 1 })}
                        >
                          <span className="sr-only">Previous month</span>
                          <FaArrowLeft className="h-4 w-4" />
                        </button>
                        <div className="text-sm font-semibold text-[#e6f5ff]">
                          {calendar ? `${calendar.month} ${calendar.year}` : ""}
                        </div>
                        <button
                          type="button"
                          className="flex h-11 w-11 items-center justify-center rounded-full text-[var(--color-text-secondary)] transition hover:bg-white/8"
                          {...addOffset({ months: 1 })}
                        >
                          <span className="sr-only">Next month</span>
                          <FaArrowRight className="h-4 w-4" />
                        </button>
                      </div>

                      <div className="grid grid-cols-7 gap-1.5 text-center text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-text-muted)]">
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

                      <div className="mt-4 flex items-center justify-between text-xs text-[var(--color-text-muted)]">
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
                      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--color-text-muted)]">
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
                      className="h-11 rounded-full px-6 text-sm font-semibold text-[var(--color-text-secondary)] transition hover:text-[#e6f5ff]"
                      onClick={() => setIsOpen(false)}
                    >
                      Done
                    </button>
                  </div>
                </div>
              </>,
              document.body,
            )
          : null}
      </div>
    </div>
  );
}
