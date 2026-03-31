ALTER TABLE "payments"
  ADD COLUMN "surcharge_etb" DECIMAL(10, 2) NOT NULL DEFAULT 0,
  ADD COLUMN "owner_revenue_etb" DECIMAL(10, 2) NOT NULL DEFAULT 0;

UPDATE "payments"
SET
  "surcharge_etb" = 0,
  "owner_revenue_etb" = ROUND(("unit_price_etb" * "quantity") * 0.95, 2)
WHERE "owner_revenue_etb" = 0;

ALTER TABLE "bookings"
  ADD COLUMN "surcharge_amount" DECIMAL(10, 2) NOT NULL DEFAULT 0,
  ADD COLUMN "owner_revenue_amount" DECIMAL(10, 2) NOT NULL DEFAULT 0;

UPDATE "bookings"
SET
  "surcharge_amount" = 0,
  "owner_revenue_amount" = ROUND("total_amount" * 0.95, 2)
WHERE "owner_revenue_amount" = 0;

CREATE TYPE "PayoutStatus" AS ENUM ('PENDING', 'PROCESSING', 'PAID', 'FAILED', 'CANCELED');

CREATE TABLE "pitch_owner_payouts" (
  "id" UUID NOT NULL,
  "owner_id" UUID NOT NULL,
  "amount_etb" DECIMAL(10, 2) NOT NULL,
  "currency" VARCHAR(10) NOT NULL DEFAULT 'ETB',
  "reference" VARCHAR(128) NOT NULL,
  "provider_transfer_id" VARCHAR(128),
  "status" "PayoutStatus" NOT NULL DEFAULT 'PENDING',
  "destination_business_name" VARCHAR(255),
  "destination_account_last4" VARCHAR(4),
  "destination_bank_code" VARCHAR(32),
  "callback_payload_json" JSONB,
  "failure_reason" VARCHAR(255),
  "initiated_by_user_id" UUID,
  "paid_at" TIMESTAMPTZ(6),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "pitch_owner_payouts_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "pitch_owner_payouts_reference_key" ON "pitch_owner_payouts"("reference");
CREATE INDEX "pitch_owner_payouts_owner_id_status_created_at_idx" ON "pitch_owner_payouts"("owner_id", "status", "created_at");
