-- AlterTable
ALTER TABLE "events"
ADD COLUMN "series_id" UUID,
ADD COLUMN "is_recurring" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "recurrence_kind" VARCHAR(20),
ADD COLUMN "recurrence_interval" INTEGER,
ADD COLUMN "recurrence_weekdays" VARCHAR(32),
ADD COLUMN "recurrence_until" TIMESTAMPTZ(6),
ADD COLUMN "occurrence_index" INTEGER,
ADD COLUMN "is_series_master" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "events_series_id_idx" ON "events"("series_id");

-- CreateIndex
CREATE INDEX "events_event_datetime_idx" ON "events"("event_datetime");
