/**
 * ScheduleSection -- Start and end date/time pickers for event creation.
 *
 * Renders the "Schedule" card with EventDateTimePicker for start and end.
 * Uses local timezone; min date for end is derived from start.
 */

"use client";

import { EventDateTimePicker } from "@/app/components/ui/event-date-time-picker";

type ScheduleSectionProps = {
  startDate: string;
  startTime: string;
  endDate: string;
  endTime: string;
  timezone: string;
  startMinDate: Date | undefined;
  endMinDate: Date | undefined;
  onStartChange: (date: string, time: string) => void;
  onEndChange: (date: string, time: string) => void;
};

export function ScheduleSection({
  startDate,
  startTime,
  endDate,
  endTime,
  timezone,
  startMinDate,
  endMinDate,
  onStartChange,
  onEndChange,
}: ScheduleSectionProps) {
  return (
    <div className="space-y-4 rounded-xl border border-white/8 bg-[#0f2336] p-4 shadow-inner shadow-black/20">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-white">Schedule</p>
          <p className="text-sm text-[var(--color-text-muted)]">
            Choose date and time in your local timezone
          </p>
        </div>
        <span className="text-sm text-[var(--color-text-muted)]">
          Local: {timezone || "device"}
        </span>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2 rounded-xl border border-white/10 bg-[#112030] p-3">
          <p className="text-sm uppercase tracking-wider text-[#7ccfff]">
            Starts
          </p>
          <EventDateTimePicker
            id="startDateTime"
            label="Start date & time"
            dateValue={startDate}
            timeValue={startTime}
            onChange={onStartChange}
            placeholder="Select start date & time"
            minuteInterval={15}
            minDate={startMinDate}
          />
        </div>
        <div className="space-y-2 rounded-xl border border-white/10 bg-[#112030] p-3">
          <p className="text-sm uppercase tracking-wider text-[#7ccfff]">
            Ends
          </p>
          <EventDateTimePicker
            id="endDateTime"
            label="End date & time"
            dateValue={endDate}
            timeValue={endTime}
            onChange={onEndChange}
            minDate={endMinDate}
            placeholder="Select end date & time"
            minuteInterval={15}
          />
        </div>
      </div>
    </div>
  );
}
