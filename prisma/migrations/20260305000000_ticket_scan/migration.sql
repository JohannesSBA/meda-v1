CREATE TABLE IF NOT EXISTS "ticket_scan" (
  "scan_id" UUID NOT NULL,
  "attendee_id" UUID NOT NULL,
  "event_id" UUID NOT NULL,
  "scanned_by_user_id" UUID NOT NULL,
  "scanned_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "ticket_scan_pkey" PRIMARY KEY ("scan_id")
);

CREATE INDEX IF NOT EXISTS "ticket_scan_attendee_id_idx"
ON "ticket_scan"("attendee_id");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ticket_scan_attendee_id_fkey'
  ) THEN
    ALTER TABLE "ticket_scan"
    ADD CONSTRAINT "ticket_scan_attendee_id_fkey"
    FOREIGN KEY ("attendee_id") REFERENCES "eventattendees"("attendee_id")
    ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ticket_scan_event_id_fkey'
  ) THEN
    ALTER TABLE "ticket_scan"
    ADD CONSTRAINT "ticket_scan_event_id_fkey"
    FOREIGN KEY ("event_id") REFERENCES "events"("event_id")
    ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
