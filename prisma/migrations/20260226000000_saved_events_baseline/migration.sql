CREATE TABLE IF NOT EXISTS "saved_events" (
  "saved_event_id" UUID NOT NULL,
  "event_id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "saved_events_pkey" PRIMARY KEY ("saved_event_id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "saved_events_event_id_user_id_key"
ON "saved_events"("event_id", "user_id");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'saved_events_event_id_fkey'
  ) THEN
    ALTER TABLE "saved_events"
    ADD CONSTRAINT "saved_events_event_id_fkey"
    FOREIGN KEY ("event_id") REFERENCES "events"("event_id")
    ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;