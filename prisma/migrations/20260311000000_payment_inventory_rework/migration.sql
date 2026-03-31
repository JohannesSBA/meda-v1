DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type
    WHERE typname = 'payment_provider'
  ) THEN
    CREATE TYPE "payment_provider" AS ENUM ('balance', 'chapa');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum
    WHERE enumlabel = 'requires_refund'
      AND enumtypid = 'payment_status'::regtype
  ) THEN
    ALTER TYPE "payment_status" ADD VALUE 'requires_refund';
  END IF;
END $$;

ALTER TABLE "payments"
  ADD COLUMN IF NOT EXISTS "unit_price_etb" DECIMAL(10, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "quantity" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS "provider" "payment_provider" NOT NULL DEFAULT 'chapa',
  ADD COLUMN IF NOT EXISTS "reservation_expires_at" TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "verified_at" TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "fulfilled_at" TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "failure_reason" VARCHAR(255);

WITH attendee_totals AS (
  SELECT "event_id", COUNT(*)::INTEGER AS attendee_count
  FROM "eventattendees"
  GROUP BY "event_id"
)
UPDATE "events" AS e
SET "capacity" = e."capacity" + COALESCE(a.attendee_count, 0)
FROM attendee_totals AS a
WHERE e."event_id" = a."event_id"
  AND e."capacity" IS NOT NULL;

UPDATE "payments" AS p
SET
  "provider" = CASE
    WHEN p."telebirr_prepay_id" LIKE 'BALANCE-%' THEN 'balance'::"payment_provider"
    ELSE 'chapa'::"payment_provider"
  END,
  "unit_price_etb" = CASE
    WHEN e."price_field" IS NOT NULL AND e."price_field" > 0
      THEN e."price_field"::DECIMAL(10, 2)
    ELSE COALESCE(p."amount_etb", 0)
  END,
  "quantity" = CASE
    WHEN e."price_field" IS NOT NULL AND e."price_field" > 0
      THEN GREATEST(1, ROUND((p."amount_etb" / e."price_field"::DECIMAL(10, 2)))::INTEGER)
    ELSE 1
  END,
  "fulfilled_at" = CASE
    WHEN p."status" = 'succeeded' THEN COALESCE(p."fulfilled_at", p."updated_at")
    ELSE p."fulfilled_at"
  END,
  "verified_at" = CASE
    WHEN p."status" IN ('succeeded', 'failed', 'canceled')
      THEN COALESCE(p."verified_at", p."updated_at")
    ELSE p."verified_at"
  END
FROM "events" AS e
WHERE e."event_id" = p."event_id";

CREATE INDEX IF NOT EXISTS "payments_event_id_status_reservation_expires_at_idx"
ON "payments"("event_id", "status", "reservation_expires_at");

CREATE INDEX IF NOT EXISTS "payments_provider_status_reservation_expires_at_idx"
ON "payments"("provider", "status", "reservation_expires_at");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'payments_provider_telebirr_prepay_id_key'
      AND conrelid = 'payments'::regclass
  ) THEN
    ALTER TABLE "payments"
    ADD CONSTRAINT "payments_provider_telebirr_prepay_id_key"
    UNIQUE ("provider", "telebirr_prepay_id");
  END IF;
END $$;
