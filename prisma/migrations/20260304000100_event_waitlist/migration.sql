CREATE TABLE IF NOT EXISTS "event_waitlist" (
  "waitlist_id" UUID NOT NULL,
  "event_id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "event_waitlist_pkey" PRIMARY KEY ("waitlist_id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "event_waitlist_event_id_user_id_key"
ON "event_waitlist"("event_id", "user_id");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'event_waitlist_event_id_fkey'
  ) THEN
    ALTER TABLE "event_waitlist"
    ADD CONSTRAINT "event_waitlist_event_id_fkey"
    FOREIGN KEY ("event_id") REFERENCES "events"("event_id")
    ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
