/**
 * CreateEventForm -- Main event creation and edit form.
 *
 * Orchestrates form sections (basics, schedule, recurrence, location, capacity, image)
 * and live preview. Used on /create-events and admin event edit pages.
 */

"use client";

import Image from "next/image";
import { Input } from "@/app/components/ui/input";
import { Select } from "@/app/components/ui/select";
import { Textarea } from "@/app/components/ui/textarea";
import { Button } from "@/app/components/ui/button";
import { Badge } from "@/app/components/ui/badge";
import { useCreateEventForm } from "./useCreateEventForm";
import { ScheduleSection } from "./ScheduleSection";
import { RecurrenceSection } from "./RecurrenceSection";
import { LocationSection } from "./LocationSection";
import { EventFormPreview } from "./EventFormPreview";
import type { CreateEventFormProps } from "./types";

export default function CreateEventForm(props: CreateEventFormProps) {
  const {
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
  } = useCreateEventForm(props);

  return (
    <div className="grid gap-8 lg:grid-cols-[1.5fr_1fr]">
      <form
        className="relative z-20 space-y-7 rounded-2xl border border-white/6 bg-[#0f1f2d]/80 px-6 py-8 shadow-xl shadow-black/30 backdrop-blur"
        onSubmit={handleSubmit}
      >
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-sm uppercase tracking-[0.16em] text-[#7ccfff]">
              Event basics
            </p>
            <h2 className="text-xl font-semibold text-white">Details</h2>
          </div>
          <Badge className="bg-white/10 text-sm text-[var(--color-text-secondary)]">
            TZ: {timezone || "Auto"}
          </Badge>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="md:col-span-2">
            <label
              htmlFor="eventName"
              className="mb-1 block text-sm font-medium text-[var(--color-text-secondary)]"
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
              className="mb-1 block text-sm font-medium text-[var(--color-text-secondary)]"
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
              className="mb-1 block text-sm font-medium text-[var(--color-text-secondary)]"
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

        <ScheduleSection
          startDate={form.startDate}
          startTime={form.startTime}
          endDate={form.endDate}
          endTime={form.endTime}
          timezone={timezone}
          startMinDate={startMinDate}
          endMinDate={endMinDate}
          onStartChange={(date, time) =>
            setForm((prev) => ({ ...prev, startDate: date, startTime: time }))
          }
          onEndChange={(date, time) =>
            setForm((prev) => ({ ...prev, endDate: date, endTime: time }))
          }
        />

        <RecurrenceSection
          isRecurring={form.isRecurring}
          recurrenceFrequency={form.recurrenceFrequency}
          recurrenceInterval={form.recurrenceInterval}
          recurrenceUntil={form.recurrenceUntil}
          recurrenceWeekdays={form.recurrenceWeekdays}
          onRecurrenceChange={onRecurrenceChange}
        />

        <div>
          <label
            htmlFor="description"
            className="mb-1 block text-sm font-medium text-[var(--color-text-secondary)]"
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
          <div className="mt-1 text-sm text-[var(--color-text-muted)]">
            Keep it crisp. Players decide fast.
          </div>
        </div>

        <LocationSection
          location={form.location}
          latitude={form.latitude}
          longitude={form.longitude}
          locStatus={locStatus}
          onLocationChange={handleChange}
          onCoordsChange={(lat, lng) =>
            setForm((prev) => ({
              ...prev,
              latitude: lat.toString(),
              longitude: lng.toString(),
            }))
          }
          onUseMyLocation={handleUseMyLocation}
        />

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label
              htmlFor="capacity"
              className="mb-1 block text-sm font-medium text-[var(--color-text-secondary)]"
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
              className="mb-1 block text-sm font-medium text-[var(--color-text-secondary)]"
            >
              Event image (≤6MB)
            </label>
            <input
              type="file"
              id="image"
              name="image"
              accept="image/*"
              className="block w-full text-[var(--color-text-secondary)]"
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
            <div className="mb-3 space-y-2 rounded-xl border border-white/10 bg-[#0f1f2d] p-3 text-sm text-[var(--color-text-secondary)]">
              <label className="inline-flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={applyToSeries}
                  onChange={(e) => setApplyToSeries(e.target.checked)}
                />
                Apply edits to all occurrences in this series
              </label>
              {applyToSeries ? (
                <p className="text-sm text-[var(--color-text-secondary)]">
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

      <EventFormPreview preview={preview} timezone={timezone} />
    </div>
  );
}
