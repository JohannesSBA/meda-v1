ALTER TABLE "events"
  ADD COLUMN "address_label" VARCHAR(255),
  ADD COLUMN "latitude" DOUBLE PRECISION,
  ADD COLUMN "longitude" DOUBLE PRECISION;

UPDATE "events"
SET
  "address_label" = NULLIF(BTRIM(SPLIT_PART(COALESCE("event_location", ''), '!longitude=', 1)), ''),
  "longitude" = NULLIF(SPLIT_PART(SPLIT_PART(COALESCE("event_location", ''), '!longitude=', 2), '&latitude=', 1), '')::DOUBLE PRECISION,
  "latitude" = NULLIF(SPLIT_PART(COALESCE("event_location", ''), '&latitude=', 2), '')::DOUBLE PRECISION
WHERE "event_location" IS NOT NULL;

CREATE INDEX "events_event_datetime_category_id_idx" ON "events"("event_datetime", "category_id");
CREATE INDEX "events_user_id_event_datetime_idx" ON "events"("user_id", "event_datetime");
CREATE INDEX "events_latitude_longitude_idx" ON "events"("latitude", "longitude");
