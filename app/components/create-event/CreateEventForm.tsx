/**
 * CreateEventForm -- Main event creation and edit form.
 */

"use client";

import Image from "next/image";
import { Input } from "@/app/components/ui/input";
import { Select } from "@/app/components/ui/select";
import { Textarea } from "@/app/components/ui/textarea";
import { Button } from "@/app/components/ui/button";
import { Badge } from "@/app/components/ui/badge";
import { Card } from "@/app/components/ui/card";
import { Stack } from "@/app/components/ui/primitives";
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
    creatorRole,
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
    confirmationDialog,
  } = useCreateEventForm(props);

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1.45fr)_minmax(320px,0.75fr)] xl:items-start">
      <form className="space-y-6" onSubmit={handleSubmit}>
        <Card className="p-6 sm:p-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-2">
              <p className="heading-kicker">Event basics</p>
              <h2 className="section-title">Core details</h2>
              <p className="text-sm leading-6 text-[var(--color-text-secondary)]">
                Start with the title, category, and pricing. Everything below follows the same spacing rhythm.
              </p>
            </div>
            <Badge variant="accent">TZ: {timezone || "Auto"}</Badge>
          </div>

          <div className="mt-8 grid gap-5 md:grid-cols-2">
            <label className="md:col-span-2">
              <span className="field-label">Event name</span>
              <Input
                type="text"
                id="eventName"
                name="eventName"
                required
                placeholder="Friday Night 5v5"
                value={form.eventName}
                onChange={handleChange}
              />
            </label>

            <label>
              <span className="field-label">Category</span>
              <Select id="category" name="categoryId" value={form.categoryId} onChange={handleChange}>
                {categories.map((category) => (
                  <option value={category.categoryId} key={category.categoryId}>
                    {category.categoryName}
                  </option>
                ))}
              </Select>
            </label>

            <label>
              <span className="field-label">Price (ETB)</span>
              <Input
                type="number"
                id="price"
                name="price"
                min="0"
                step="1"
                placeholder="0 for free"
                value={form.price}
                onChange={handleChange}
              />
            </label>

            {mode === "create" && creatorRole === "pitch_owner" ? (
              <label>
                <span className="field-label">Promo code</span>
                <Input
                  type="text"
                  id="promoCode"
                  name="promoCode"
                  placeholder="Optional"
                  value={form.promoCode}
                  onChange={handleChange}
                />
              </label>
            ) : null}

            <div className="md:col-span-2">
              <ScheduleSection
                startDate={form.startDate}
                startTime={form.startTime}
                endDate={form.endDate}
                endTime={form.endTime}
                timezone={timezone}
                startMinDate={startMinDate}
                endMinDate={endMinDate}
                onStartChange={(date, time) => setForm((prev) => ({ ...prev, startDate: date, startTime: time }))}
                onEndChange={(date, time) => setForm((prev) => ({ ...prev, endDate: date, endTime: time }))}
              />
            </div>

            <div className="md:col-span-2">
              <RecurrenceSection
                isRecurring={form.isRecurring}
                recurrenceFrequency={form.recurrenceFrequency}
                recurrenceInterval={form.recurrenceInterval}
                recurrenceUntil={form.recurrenceUntil}
                recurrenceWeekdays={form.recurrenceWeekdays}
                onRecurrenceChange={onRecurrenceChange}
              />
            </div>

            <label className="md:col-span-2">
              <span className="field-label">Description</span>
              <Textarea
                id="description"
                name="description"
                rows={5}
                placeholder="Format, skill level, what to bring, parking notes, and anything players should know."
                value={form.description}
                onChange={handleChange}
              />
              <p className="mt-2 text-sm text-[var(--color-text-muted)]">Lead with the format and level so players can self-select quickly.</p>
            </label>

            <div className="md:col-span-2">
              <LocationSection
                location={form.location}
                latitude={form.latitude}
                longitude={form.longitude}
                locStatus={locStatus}
                onLocationChange={handleChange}
                onCoordsChange={(lat, lng) => setForm((prev) => ({ ...prev, latitude: lat.toString(), longitude: lng.toString() }))}
                onUseMyLocation={handleUseMyLocation}
              />
            </div>

            <label>
              <span className="field-label">Capacity</span>
              <Input
                type="number"
                id="capacity"
                name="capacity"
                min="1"
                placeholder="10"
                value={form.capacity}
                onChange={handleChange}
              />
            </label>

            <div>
              <span className="field-label">Event image</span>
              <label className="flex min-h-12 cursor-pointer items-center justify-center rounded-[var(--radius-md)] border border-dashed border-[var(--color-border-strong)] bg-white/[0.03] px-4 text-sm font-medium text-[var(--color-text-secondary)] hover:border-[rgba(125,211,252,0.42)] hover:text-[var(--color-text-primary)]">
                <input type="file" id="image" name="image" accept="image/*" className="sr-only" onChange={handleImageChange} />
                Upload image (max 6MB)
              </label>
              {form.imagePreview ? (
                <div className="mt-3 overflow-hidden rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[rgba(255,255,255,0.02)]">
                  <Image src={form.imagePreview} alt="Event preview" width={640} height={360} className="h-auto w-full object-cover" />
                </div>
              ) : null}
            </div>
          </div>
        </Card>

        <Card className="p-6 sm:p-8">
          <Stack gap="md">
            {mode === "edit" && form.isRecurring && initialEvent?.seriesId ? (
              <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-white/[0.03] p-4 text-sm text-[var(--color-text-secondary)]">
                <label className="inline-flex items-center gap-2 font-medium text-[var(--color-text-primary)]">
                  <input type="checkbox" checked={applyToSeries} onChange={(e) => setApplyToSeries(e.target.checked)} />
                  Apply edits to all occurrences in this series
                </label>
                {applyToSeries ? (
                  <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
                    This will update {initialEvent.seriesCount ?? 1} occurrence{(initialEvent.seriesCount ?? 1) === 1 ? "" : "s"}.
                  </p>
                ) : null}
              </div>
            ) : null}

            <Button type="submit" disabled={submitting} variant="primary" size="lg" className="w-full rounded-full sm:w-auto sm:px-8">
              {submitting ? "Saving..." : mode === "create" ? "Create event" : "Save changes"}
            </Button>
          </Stack>
        </Card>
      </form>

      <EventFormPreview preview={preview} timezone={timezone} />
      {confirmationDialog}
    </div>
  );
}
