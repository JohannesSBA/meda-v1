/**
 * CreateEventForm -- Guided event creation and edit form.
 */

"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import { Input } from "@/app/components/ui/input";
import { Select } from "@/app/components/ui/select";
import { Textarea } from "@/app/components/ui/textarea";
import { Button } from "@/app/components/ui/button";
import { Badge } from "@/app/components/ui/badge";
import { Card } from "@/app/components/ui/card";
import { Stack } from "@/app/components/ui/primitives";
import { InlineStatusBanner } from "@/app/components/ui/inline-status-banner";
import { AppSectionCard } from "@/app/components/ui/app-section-card";
import { useCreateEventForm, type CreateEventFormState } from "./useCreateEventForm";
import { ScheduleSection } from "./ScheduleSection";
import { RecurrenceSection } from "./RecurrenceSection";
import { LocationSection } from "./LocationSection";
import { EventFormPreview } from "./EventFormPreview";
import type { CreateEventFormProps } from "./types";

type EventStepId = "basics" | "time" | "location" | "pricing" | "preview" | "confirm";

type EventStep = {
  id: EventStepId;
  label: string;
  title: string;
  description: string;
};

const eventSteps: EventStep[] = [
  {
    id: "basics",
    label: "Basics",
    title: "Start with the match basics",
    description: "Add the match name, category, and a short description so people know what this is.",
  },
  {
    id: "time",
    label: "Time",
    title: "Set the date and time",
    description: "Pick when the match starts and ends. Turn on recurrence only if this repeats.",
  },
  {
    id: "location",
    label: "Location",
    title: "Choose the exact place",
    description: "Use the full address and map pin so players can trust where they are going.",
  },
  {
    id: "pricing",
    label: "Pricing",
    title: "Set price and capacity",
    description: "Keep this simple: how many people can join, and how much does each ticket cost?",
  },
  {
    id: "preview",
    label: "Image",
    title: "Add an image and check the preview",
    description: "A good image helps people trust the match faster. You can still publish without one.",
  },
  {
    id: "confirm",
    label: "Confirm",
    title: "Review everything before you publish",
    description: "Make sure the details feel clear, then create the match or save your changes.",
  },
];

function buildStepWarnings(form: CreateEventFormState, timezone: string, isEdit: boolean) {
  const warnings: Record<EventStepId, string[]> = {
    basics: [],
    time: [],
    location: [],
    pricing: [],
    preview: [],
    confirm: [],
  };

  if (!form.eventName.trim()) warnings.basics.push("Add a clear match name.");
  if (!form.categoryId.trim()) warnings.basics.push("Choose a category.");
  if (!form.description.trim()) warnings.basics.push("Add a short description so players know what to expect.");

  if (!form.startDate || !form.startTime) warnings.time.push("Choose the start date and time.");
  if (!form.endDate || !form.endTime) warnings.time.push("Choose the end date and time.");
  if (form.startDate && form.startTime && form.endDate && form.endTime) {
    const start = new Date(`${form.startDate}T${form.startTime}`);
    const end = new Date(`${form.endDate}T${form.endTime}`);
    if (end <= start) warnings.time.push("The end time must be after the start time.");
  }
  if (form.isRecurring && !form.recurrenceUntil) {
    warnings.time.push("Set when the repeating series should stop.");
  }

  if (!form.location.trim()) warnings.location.push("Add the place name or address.");
  if (!form.latitude.trim() || !form.longitude.trim()) {
    warnings.location.push("Use the map pin or coordinates so people can find the place.");
  }

  if (!form.capacity.trim()) warnings.pricing.push("Choose how many players can join.");
  if (form.capacity && Number(form.capacity) <= 0) warnings.pricing.push("Capacity must be at least 1.");
  if (form.price && Number(form.price) < 0) warnings.pricing.push("Price cannot be negative.");

  if (!form.imagePreview) warnings.preview.push("Adding an image is optional, but it makes the match feel more trustworthy.");
  if (!timezone) warnings.preview.push("Timezone will use the player device if it is not set yet.");

  if (!isEdit && warnings.basics.length + warnings.time.length + warnings.location.length + warnings.pricing.length > 0) {
    warnings.confirm.push("Finish the earlier steps before publishing.");
  }

  return warnings;
}

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

  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [showMobilePreview, setShowMobilePreview] = useState(false);

  const currentStep = eventSteps[currentStepIndex];
  const stepWarnings = useMemo(
    () => buildStepWarnings(form, timezone, mode === "edit"),
    [form, mode, timezone],
  );

  function goToStep(index: number) {
    setCurrentStepIndex(Math.min(Math.max(index, 0), eventSteps.length - 1));
  }

  function goNext() {
    goToStep(currentStepIndex + 1);
  }

  function goBack() {
    goToStep(currentStepIndex - 1);
  }

  const warningsForCurrentStep = stepWarnings[currentStep.id];

  const shouldShowPreview =
    showMobilePreview || currentStep.id === "preview" || currentStep.id === "confirm";

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.8fr)] xl:items-start">
      <form className="space-y-6" onSubmit={handleSubmit}>
        <Card className="space-y-5 p-4 sm:p-6 lg:p-7">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="space-y-2">
                <p className="heading-kicker">{mode === "create" ? "Create match" : "Edit match"}</p>
                <h2 className="text-2xl font-semibold tracking-[-0.04em] text-[var(--color-text-primary)] sm:text-3xl">
                  {currentStep.title}
                </h2>
                <p className="max-w-3xl text-sm leading-7 text-[var(--color-text-secondary)] sm:text-base">
                  {currentStep.description}
                </p>
              </div>
              <Badge variant="accent">TZ: {timezone || "Auto"}</Badge>
            </div>

            <div
              role="tablist"
              aria-label="Create match steps"
              className="inline-flex w-full flex-wrap gap-2 rounded-[24px] border border-[rgba(125,211,252,0.14)] bg-[rgba(255,255,255,0.04)] p-2"
            >
              {eventSteps.map((step, index) => {
                const isActive = step.id === currentStep.id;
                const hasWarnings = stepWarnings[step.id].length > 0;
                return (
                  <button
                    key={step.id}
                    type="button"
                    role="tab"
                    aria-selected={isActive}
                    onClick={() => goToStep(index)}
                    className={`min-h-11 rounded-full px-4 py-2 text-left text-sm font-semibold transition ${
                      isActive
                        ? "bg-[var(--color-accent-soft)] text-[var(--color-text-primary)]"
                        : "text-[var(--color-text-secondary)] hover:bg-[var(--color-control-bg-hover)] hover:text-[var(--color-text-primary)]"
                    }`}
                  >
                    <span className="block">{index + 1}. {step.label}</span>
                    {hasWarnings ? (
                      <span className="block text-xs font-medium text-[var(--color-text-muted)]">
                        Needs attention
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          </div>

          {warningsForCurrentStep.length > 0 ? (
            <InlineStatusBanner
              title="Check these before you move on."
              description={
                <ul className="list-disc space-y-1 pl-5">
                  {warningsForCurrentStep.map((warning) => (
                    <li key={warning}>{warning}</li>
                  ))}
                </ul>
              }
              tone="warning"
            />
          ) : (
            <InlineStatusBanner
              title="This step looks good."
              description="You can keep going, or still change anything before you publish."
              tone="success"
            />
          )}
        </Card>

        {currentStep.id === "basics" ? (
          <AppSectionCard
            headingKicker="Basics"
            title="Tell players what this match is"
            description="Lead with the format and level so people can decide quickly if this is right for them."
          >
            <div className="grid gap-5 md:grid-cols-2">
              <label className="md:col-span-2">
                <span className="field-label">Match name</span>
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
                <Select
                  id="category"
                  name="categoryId"
                  defaultValue={categories[0]?.categoryId}
                  value={form.categoryId}
                  onChange={handleChange}
                >
                  {categories.map((category) => (
                    <option value={category.categoryId} key={category.categoryId}>
                      {category.categoryName}
                    </option>
                  ))}
                </Select>
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

              <label className="md:col-span-2">
                <span className="field-label">Description</span>
                <Textarea
                  id="description"
                  name="description"
                  rows={6}
                  placeholder="Format, skill level, what to bring, parking notes, and anything players should know."
                  value={form.description}
                  onChange={handleChange}
                />
                <p className="mt-2 text-sm text-[var(--color-text-muted)]">
                  A short, practical description works better than a long one.
                </p>
              </label>
            </div>
          </AppSectionCard>
        ) : null}

        {currentStep.id === "time" ? (
          <AppSectionCard
            headingKicker="Time"
            title="Pick when this match happens"
            description="Most people understand one clear date and time. Only use recurrence if you are sure this repeats."
          >
            <Stack gap="lg">
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

              <details
                open={form.isRecurring}
                className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-white/[0.03] p-4"
              >
                <summary className="cursor-pointer list-none text-sm font-semibold text-[var(--color-text-primary)]">
                  {form.isRecurring ? "Recurring settings are on" : "Optional: make this a repeating match"}
                </summary>
                <div className="mt-4">
                  <RecurrenceSection
                    isRecurring={form.isRecurring}
                    recurrenceFrequency={form.recurrenceFrequency}
                    recurrenceInterval={form.recurrenceInterval}
                    recurrenceUntil={form.recurrenceUntil}
                    recurrenceWeekdays={form.recurrenceWeekdays}
                    onRecurrenceChange={onRecurrenceChange}
                  />
                </div>
              </details>
            </Stack>
          </AppSectionCard>
        ) : null}

        {currentStep.id === "location" ? (
          <AppSectionCard
            headingKicker="Location"
            title="Drop the exact pin"
            description="Players trust the match more when the map location is exact, especially if the place is hard to find."
          >
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
          </AppSectionCard>
        ) : null}

        {currentStep.id === "pricing" ? (
          <AppSectionCard
            headingKicker="Pricing"
            title="Keep the numbers easy to understand"
            description="If this is free, leave the price at 0. If it costs money, use the ticket price people should expect to pay."
          >
            <div className="grid gap-5 md:grid-cols-2">
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
            </div>
          </AppSectionCard>
        ) : null}

        {currentStep.id === "preview" ? (
          <AppSectionCard
            headingKicker="Image"
            title="Add an image if you have one"
            description="A strong image helps the match feel real. If you do not have one yet, you can still continue."
          >
            <div className="space-y-4">
              <div>
                <span className="field-label">Match image</span>
                <label className="flex min-h-12 cursor-pointer items-center justify-center rounded-[var(--radius-md)] border border-dashed border-[var(--color-border-strong)] bg-white/[0.03] px-4 text-sm font-medium text-[var(--color-text-secondary)] hover:border-[rgba(125,211,252,0.42)] hover:text-[var(--color-text-primary)]">
                  <input
                    type="file"
                    id="image"
                    name="image"
                    accept="image/*"
                    className="sr-only"
                    onChange={handleImageChange}
                  />
                  Upload image (max 6MB)
                </label>
              </div>

              {form.imagePreview ? (
                <div className="overflow-hidden rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[rgba(255,255,255,0.02)]">
                  <Image
                    src={form.imagePreview}
                    alt="Event preview"
                    width={640}
                    height={360}
                    className="h-auto w-full object-cover"
                  />
                </div>
              ) : null}
            </div>
          </AppSectionCard>
        ) : null}

        {currentStep.id === "confirm" ? (
          <AppSectionCard
            headingKicker="Confirm"
            title="Review the details before you publish"
            description="If something looks hard to understand here, players will probably feel the same way on the live page."
          >
            <Stack gap="lg">
              <div className="grid gap-3 md:grid-cols-2">
                <ReviewRow label="Match name" value={form.eventName || "Missing"} />
                <ReviewRow
                  label="Category"
                  value={
                    categories.find((category) => category.categoryId === form.categoryId)?.categoryName ??
                    "Missing"
                  }
                />
                <ReviewRow
                  label="Start"
                  value={
                    form.startDate && form.startTime
                      ? `${form.startDate} ${form.startTime}`
                      : "Missing"
                  }
                />
                <ReviewRow
                  label="End"
                  value={
                    form.endDate && form.endTime ? `${form.endDate} ${form.endTime}` : "Missing"
                  }
                />
                <ReviewRow label="Location" value={form.location || "Missing"} />
                <ReviewRow label="Capacity" value={form.capacity || "Missing"} />
                <ReviewRow label="Price" value={form.price ? `ETB ${form.price}` : "Free"} />
                <ReviewRow
                  label="Repeat"
                  value={form.isRecurring ? `Yes, until ${form.recurrenceUntil || "not set"}` : "No"}
                />
              </div>

              {mode === "edit" && form.isRecurring && initialEvent?.seriesId ? (
                <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-white/[0.03] p-4 text-sm text-[var(--color-text-secondary)]">
                  <label className="inline-flex items-center gap-2 font-medium text-[var(--color-text-primary)]">
                    <input
                      type="checkbox"
                      checked={applyToSeries}
                      onChange={(event) => setApplyToSeries(event.target.checked)}
                    />
                    Apply edits to all matches in this repeating series
                  </label>
                  {applyToSeries ? (
                    <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
                      This will update {initialEvent.seriesCount ?? 1} match
                      {(initialEvent.seriesCount ?? 1) === 1 ? "" : "es"}.
                    </p>
                  ) : null}
                </div>
              ) : null}
            </Stack>
          </AppSectionCard>
        ) : null}

        <Card className="p-4 sm:p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-sm leading-6 text-[var(--color-text-secondary)]">
              Step {currentStepIndex + 1} of {eventSteps.length}
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button
                type="button"
                variant="ghost"
                size="md"
                disabled={currentStepIndex === 0 || submitting}
                onClick={goBack}
              >
                Back
              </Button>
              {currentStepIndex < eventSteps.length - 1 ? (
                <Button type="button" variant="primary" size="md" onClick={goNext}>
                  Continue
                </Button>
              ) : (
                <Button
                  type="submit"
                  disabled={submitting}
                  variant="primary"
                  size="lg"
                  className="rounded-full sm:px-8"
                >
                  {submitting ? "Saving..." : mode === "create" ? "Create match" : "Save changes"}
                </Button>
              )}
            </div>
          </div>
        </Card>
      </form>

      <div className="space-y-4 xl:sticky xl:top-[calc(var(--header-height)+32px)]">
        <div className="xl:hidden">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="w-full rounded-full"
            onClick={() => setShowMobilePreview((current) => !current)}
          >
            {showMobilePreview ? "Hide live preview" : "Show live preview"}
          </Button>
        </div>

        {shouldShowPreview ? (
          <EventFormPreview preview={preview} timezone={timezone} />
        ) : (
          <div className="hidden xl:block">
            <EventFormPreview preview={preview} timezone={timezone} />
          </div>
        )}
      </div>

      {confirmationDialog}
    </div>
  );
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-control-bg)] p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--color-text-muted)]">
        {label}
      </p>
      <p className="mt-2 text-sm leading-6 text-[var(--color-text-primary)]">{value}</p>
    </div>
  );
}
