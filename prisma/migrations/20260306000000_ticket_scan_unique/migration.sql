-- Add UNIQUE constraint on ticket_scan(attendee_id) to prevent double-scanning
-- This enforces at the database level that each ticket can only be scanned once,
-- which together with ON CONFLICT DO NOTHING in application code prevents race conditions.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'ticket_scan_attendee_id_key'
      AND conrelid = 'ticket_scan'::regclass
  ) THEN
    ALTER TABLE "ticket_scan"
    ADD CONSTRAINT "ticket_scan_attendee_id_key" UNIQUE ("attendee_id");
  END IF;
END $$;
