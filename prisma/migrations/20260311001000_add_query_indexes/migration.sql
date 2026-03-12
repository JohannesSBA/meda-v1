CREATE INDEX IF NOT EXISTS "eventattendees_user_id_idx"
ON "eventattendees"("user_id");

CREATE INDEX IF NOT EXISTS "invitations_event_id_user_id_status_idx"
ON "invitations"("event_id", "user_id", "status");

CREATE INDEX IF NOT EXISTS "saved_events_user_id_created_at_idx"
ON "saved_events"("user_id", "created_at");

CREATE INDEX IF NOT EXISTS "event_waitlist_event_id_created_at_idx"
ON "event_waitlist"("event_id", "created_at");

CREATE INDEX IF NOT EXISTS "ticket_scan_event_id_scanned_at_idx"
ON "ticket_scan"("event_id", "scanned_at");
