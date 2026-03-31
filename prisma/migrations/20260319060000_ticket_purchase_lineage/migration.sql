ALTER TABLE "eventattendees"
  ADD COLUMN IF NOT EXISTS "purchaser_user_id" UUID,
  ADD COLUMN IF NOT EXISTS "payment_id" UUID;

UPDATE "eventattendees"
SET "purchaser_user_id" = "user_id"
WHERE "purchaser_user_id" IS NULL;

WITH expanded_payments AS (
  SELECT
    p."payment_id",
    p."event_id",
    p."user_id",
    ROW_NUMBER() OVER (
      PARTITION BY p."event_id", p."user_id"
      ORDER BY COALESCE(p."fulfilled_at", p."verified_at", p."created_at"), p."payment_id", gs.n
    ) AS payment_seq
  FROM "payments" p
  CROSS JOIN LATERAL generate_series(1, GREATEST(p."quantity", 1)) AS gs(n)
  WHERE p."status" = 'succeeded'
),
ranked_attendees AS (
  SELECT
    ea."attendee_id",
    ea."event_id",
    ea."user_id",
    ROW_NUMBER() OVER (
      PARTITION BY ea."event_id", ea."user_id"
      ORDER BY ea."created_at", ea."attendee_id"
    ) AS attendee_seq
  FROM "eventattendees" ea
  WHERE ea."payment_id" IS NULL
)
UPDATE "eventattendees" ea
SET "payment_id" = ep."payment_id"
FROM ranked_attendees ra
JOIN expanded_payments ep
  ON ep."event_id" = ra."event_id"
 AND ep."user_id" = ra."user_id"
 AND ep.payment_seq = ra.attendee_seq
WHERE ea."attendee_id" = ra."attendee_id"
  AND ea."payment_id" IS NULL;

ALTER TABLE "eventattendees"
  ALTER COLUMN "purchaser_user_id" SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'eventattendees_payment_id_fkey'
      AND conrelid = 'eventattendees'::regclass
  ) THEN
    ALTER TABLE "eventattendees"
    ADD CONSTRAINT "eventattendees_payment_id_fkey"
    FOREIGN KEY ("payment_id") REFERENCES "payments"("payment_id")
    ON DELETE SET NULL
    ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "eventattendees_event_id_purchaser_user_id_idx"
ON "eventattendees"("event_id", "purchaser_user_id");

CREATE INDEX IF NOT EXISTS "eventattendees_payment_id_idx"
ON "eventattendees"("payment_id");

ALTER TABLE "refunds"
  ADD COLUMN IF NOT EXISTS "payment_id" UUID;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'refunds_payment_id_fkey'
      AND conrelid = 'refunds'::regclass
  ) THEN
    ALTER TABLE "refunds"
    ADD CONSTRAINT "refunds_payment_id_fkey"
    FOREIGN KEY ("payment_id") REFERENCES "payments"("payment_id")
    ON DELETE SET NULL
    ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "refunds_payment_id_idx"
ON "refunds"("payment_id");
