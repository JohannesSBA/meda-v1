ALTER TABLE "reminder_log"
ALTER COLUMN "event_id" DROP NOT NULL;

ALTER TABLE "reminder_log"
ADD COLUMN IF NOT EXISTS "booking_id" UUID;

CREATE UNIQUE INDEX IF NOT EXISTS "reminder_log_booking_user_type_key"
ON "reminder_log"("booking_id", "user_id", "reminder_type");
