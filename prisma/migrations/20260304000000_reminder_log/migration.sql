CREATE TABLE IF NOT EXISTS "reminder_log" (
  "reminder_log_id" UUID NOT NULL,
  "event_id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "reminder_type" VARCHAR(20) NOT NULL,
  "sent_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "reminder_log_pkey" PRIMARY KEY ("reminder_log_id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "reminder_log_event_user_type_key"
ON "reminder_log"("event_id", "user_id", "reminder_type");
