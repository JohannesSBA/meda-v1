-- CreateTable
CREATE TABLE "pitch_owner_profiles" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "business_name" VARCHAR(255),
    "account_name_enc" TEXT,
    "account_number_enc" TEXT,
    "bank_code_enc" TEXT,
    "chapa_subaccount_id" VARCHAR(64),
    "split_type" VARCHAR(20),
    "split_value" DECIMAL(10,4),
    "payout_setup_verified_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pitch_owner_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "facilitators" (
    "id" UUID NOT NULL,
    "facilitator_user_id" UUID NOT NULL,
    "pitch_owner_user_id" UUID NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "facilitators_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "promo_codes" (
    "id" UUID NOT NULL,
    "code" VARCHAR(32) NOT NULL,
    "discount_type" VARCHAR(20) NOT NULL,
    "discount_value" DECIMAL(10,4) NOT NULL,
    "pitch_owner_user_id" UUID,
    "max_uses" INTEGER,
    "used_count" INTEGER NOT NULL DEFAULT 0,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "promo_codes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event_creation_fee_configs" (
    "id" UUID NOT NULL,
    "amount_etb" DECIMAL(10,2) NOT NULL,
    "effective_from" TIMESTAMPTZ(6) NOT NULL,
    "effective_to" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "event_creation_fee_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event_creation_payments" (
    "id" UUID NOT NULL,
    "pitch_owner_user_id" UUID NOT NULL,
    "event_id" UUID,
    "amount_etb" DECIMAL(10,2) NOT NULL,
    "promo_code_id" UUID,
    "status" VARCHAR(20) NOT NULL,
    "provider_reference" VARCHAR(128),
    "paid_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "event_creation_payments_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "payments"
  ADD COLUMN IF NOT EXISTS "chapa_subaccount_id" VARCHAR(64);

-- CreateTable
CREATE TABLE "user_balances" (
    "user_id" UUID NOT NULL,
    "balance_etb" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_balances_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "refunds" (
    "refund_id" UUID NOT NULL,
    "event_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "amount_etb" DECIMAL(10,2) NOT NULL,
    "ticket_count" INTEGER NOT NULL,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refunds_pkey" PRIMARY KEY ("refund_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "pitch_owner_profiles_user_id_key" ON "pitch_owner_profiles"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "pitch_owner_profiles_chapa_subaccount_id_key" ON "pitch_owner_profiles"("chapa_subaccount_id");

-- CreateIndex
CREATE UNIQUE INDEX "facilitators_facilitator_user_id_key" ON "facilitators"("facilitator_user_id");

-- CreateIndex
CREATE INDEX "facilitators_pitch_owner_user_id_idx" ON "facilitators"("pitch_owner_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "promo_codes_code_key" ON "promo_codes"("code");

-- CreateIndex
CREATE INDEX "promo_codes_code_is_active_expires_at_idx" ON "promo_codes"("code", "is_active", "expires_at");

-- CreateIndex
CREATE INDEX "promo_codes_pitch_owner_user_id_idx" ON "promo_codes"("pitch_owner_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "event_creation_payments_event_id_key" ON "event_creation_payments"("event_id");

-- CreateIndex
CREATE INDEX "event_creation_payments_pitch_owner_user_id_idx" ON "event_creation_payments"("pitch_owner_user_id");

-- CreateIndex
CREATE INDEX "refunds_event_id_user_id_idx" ON "refunds"("event_id", "user_id");

-- AddForeignKey
ALTER TABLE "facilitators" ADD CONSTRAINT "facilitators_pitch_owner_user_id_fkey" FOREIGN KEY ("pitch_owner_user_id") REFERENCES "pitch_owner_profiles"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_creation_payments" ADD CONSTRAINT "event_creation_payments_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("event_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_creation_payments" ADD CONSTRAINT "event_creation_payments_pitch_owner_user_id_fkey" FOREIGN KEY ("pitch_owner_user_id") REFERENCES "pitch_owner_profiles"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_creation_payments" ADD CONSTRAINT "event_creation_payments_promo_code_id_fkey" FOREIGN KEY ("promo_code_id") REFERENCES "promo_codes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("event_id") ON DELETE CASCADE ON UPDATE CASCADE;
