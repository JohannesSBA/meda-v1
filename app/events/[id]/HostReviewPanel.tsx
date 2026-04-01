"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/app/components/ui/button";
import type { EventReviewState } from "@/services/hostReviews";

const REVIEW_TAGS = [
  { value: "well_organized", label: "Well organized" },
  { value: "good_communication", label: "Good communication" },
  { value: "accurate_listing", label: "Accurate listing" },
  { value: "started_on_time", label: "Started on time" },
  { value: "friendly_host", label: "Friendly host" },
  { value: "poor_organization", label: "Poor organization" },
  { value: "misleading_listing", label: "Misleading listing" },
  { value: "started_late", label: "Started late" },
] as const;

export function HostReviewPanel({ eventId, reviewState }: { eventId: string; reviewState: EventReviewState | null }) {
  const [rating, setRating] = useState(0);
  const [tags, setTags] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(Boolean(reviewState?.hasReviewed));

  if (!reviewState) return null;
  if (!reviewState.eligible || done) {
    return (
      <div className="rounded-xl border border-[var(--color-border)] bg-[#0f1f2d] px-4 py-3 text-sm text-[var(--color-text-secondary)]">
        {done || reviewState.code === "already_reviewed"
          ? "Thanks — you already reviewed this host for this event."
          : "Host review opens only for attended bookings after the event."}
      </div>
    );
  }

  async function submit() {
    if (rating < 1 || rating > 5) {
      toast.error("Choose a rating from 1 to 5 stars.");
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch("/api/host-reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId, rating, tags }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.error || "Failed to submit host review");
      }
      setDone(true);
      toast.success("Thanks for rating this host.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to submit host review";
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[#0f1f2d] p-4">
      <p className="text-sm font-semibold text-white">Rate this host</p>
      <div className="mt-2 flex gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <button key={star} type="button" onClick={() => setRating(star)} className="text-xl">
            {star <= rating ? "★" : "☆"}
          </button>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {REVIEW_TAGS.map((tag) => {
          const selected = tags.includes(tag.value);
          return (
            <button
              key={tag.value}
              type="button"
              onClick={() =>
                setTags((current) =>
                  selected ? current.filter((entry) => entry !== tag.value) : [...current, tag.value],
                )
              }
              className={`rounded-full border px-2 py-1 text-xs ${selected ? "border-[var(--color-brand)] text-white" : "border-[var(--color-border)] text-[var(--color-text-secondary)]"}`}
            >
              {tag.label}
            </button>
          );
        })}
      </div>
      <Button className="mt-4" disabled={submitting} onClick={submit}>
        {submitting ? "Submitting..." : "Submit review"}
      </Button>
    </div>
  );
}
