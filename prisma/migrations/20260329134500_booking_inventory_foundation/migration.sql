-- CreateEnum
CREATE TYPE "OwnerSubscriptionStatus" AS ENUM ('ACTIVE', 'PAST_DUE', 'CANCELLED', 'EXPIRED', 'TRIAL');

-- CreateEnum
CREATE TYPE "SlotStatus" AS ENUM ('OPEN', 'RESERVED', 'BOOKED', 'BLOCKED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "BookingStatus" AS ENUM ('PENDING', 'CONFIRMED', 'EXPIRED', 'CANCELLED', 'COMPLETED');

-- CreateEnum
CREATE TYPE "ProductType" AS ENUM ('DAILY', 'MONTHLY');

-- CreateEnum
CREATE TYPE "PartyStatus" AS ENUM ('FORMING', 'PENDING_PAYMENT', 'ACTIVE', 'EXPIRED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PartyMemberStatus" AS ENUM ('INVITED', 'JOINED', 'PAID', 'EXPIRED', 'REMOVED');

-- CreateEnum
CREATE TYPE "PaymentPoolStatus" AS ENUM ('PENDING', 'FULFILLED', 'EXPIRED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ContributionStatus" AS ENUM ('PENDING', 'PAID', 'FAILED', 'EXPIRED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "TicketStatus" AS ENUM ('PURCHASED', 'ASSIGNMENT_PENDING', 'ASSIGNED', 'VALID', 'CHECKED_IN', 'EXPIRED', 'CANCELLED');

-- CreateTable
CREATE TABLE "pitches" (
    "id" UUID NOT NULL,
    "owner_id" UUID NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "description" TEXT,
    "category_id" UUID NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pitches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pitch_schedules" (
    "id" UUID NOT NULL,
    "pitch_id" UUID NOT NULL,
    "day_of_week" INTEGER NOT NULL,
    "start_time" VARCHAR(5) NOT NULL,
    "end_time" VARCHAR(5) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pitch_schedules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bookable_slots" (
    "id" UUID NOT NULL,
    "pitch_id" UUID NOT NULL,
    "category_id" UUID NOT NULL,
    "starts_at" TIMESTAMPTZ(6) NOT NULL,
    "ends_at" TIMESTAMPTZ(6) NOT NULL,
    "capacity" INTEGER NOT NULL,
    "price" DECIMAL(10,2) NOT NULL,
    "currency" VARCHAR(10) NOT NULL DEFAULT 'ETB',
    "product_type" "ProductType" NOT NULL,
    "status" "SlotStatus" NOT NULL DEFAULT 'OPEN',
    "requires_party" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "created_by_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bookable_slots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "parties" (
    "id" UUID NOT NULL,
    "owner_id" UUID NOT NULL,
    "name" VARCHAR(120),
    "status" "PartyStatus" NOT NULL DEFAULT 'FORMING',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "parties_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bookings" (
    "id" UUID NOT NULL,
    "slot_id" UUID NOT NULL,
    "user_id" UUID,
    "party_id" UUID,
    "product_type" "ProductType" NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "total_amount" DECIMAL(10,2) NOT NULL,
    "currency" VARCHAR(10) NOT NULL DEFAULT 'ETB',
    "payment_provider" "payment_provider",
    "provider_reference" VARCHAR(128),
    "status" "BookingStatus" NOT NULL DEFAULT 'PENDING',
    "expires_at" TIMESTAMPTZ(6),
    "paid_at" TIMESTAMPTZ(6),
    "failure_reason" VARCHAR(255),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bookings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "party_members" (
    "id" UUID NOT NULL,
    "party_id" UUID NOT NULL,
    "user_id" UUID,
    "invited_email" VARCHAR(255),
    "status" "PartyMemberStatus" NOT NULL DEFAULT 'INVITED',
    "joined_at" TIMESTAMPTZ(6),
    "paid_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "party_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pitch_subscriptions" (
    "id" UUID NOT NULL,
    "owner_id" UUID NOT NULL,
    "pitch_id" UUID,
    "status" "OwnerSubscriptionStatus" NOT NULL DEFAULT 'TRIAL',
    "starts_at" TIMESTAMPTZ(6) NOT NULL,
    "ends_at" TIMESTAMPTZ(6) NOT NULL,
    "renewal_at" TIMESTAMPTZ(6),
    "provider_ref" VARCHAR(128),
    "plan_code" VARCHAR(64) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pitch_subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_pools" (
    "id" UUID NOT NULL,
    "party_id" UUID NOT NULL,
    "booking_id" UUID NOT NULL,
    "total_amount" DECIMAL(10,2) NOT NULL,
    "amount_paid" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "currency" VARCHAR(10) NOT NULL DEFAULT 'ETB',
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "status" "PaymentPoolStatus" NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payment_pools_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_contributions" (
    "id" UUID NOT NULL,
    "pool_id" UUID NOT NULL,
    "user_id" UUID,
    "party_member_id" UUID,
    "expected_amount" DECIMAL(10,2) NOT NULL,
    "paid_amount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "status" "ContributionStatus" NOT NULL DEFAULT 'PENDING',
    "provider_ref" VARCHAR(128),
    "paid_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payment_contributions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "booking_tickets" (
    "id" UUID NOT NULL,
    "booking_id" UUID NOT NULL,
    "purchaser_id" UUID NOT NULL,
    "assigned_user_id" UUID,
    "assigned_name" VARCHAR(120),
    "assigned_email" VARCHAR(255),
    "status" "TicketStatus" NOT NULL DEFAULT 'ASSIGNMENT_PENDING',
    "checked_in_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "booking_tickets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_passes" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "party_id" UUID,
    "product_type" "ProductType" NOT NULL,
    "starts_at" TIMESTAMPTZ(6) NOT NULL,
    "ends_at" TIMESTAMPTZ(6) NOT NULL,
    "status" "BookingStatus" NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_passes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "host_activity_logs" (
    "id" UUID NOT NULL,
    "owner_id" UUID NOT NULL,
    "pitch_id" UUID,
    "entity_type" VARCHAR(40) NOT NULL,
    "entity_id" VARCHAR(64) NOT NULL,
    "action" VARCHAR(64) NOT NULL,
    "metadata_json" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "host_activity_logs_pkey" PRIMARY KEY ("id")
);

-- Seed fallback soccer category
INSERT INTO "categories" ("category_id", "category_name", "description")
VALUES (
    '3c0f6fb2-4b2a-4d62-9d58-0d2f1c1f4f1b',
    'Soccer',
    'Default fallback category for booking inventory and uncategorized events.'
)
ON CONFLICT ("category_id") DO UPDATE
SET
    "category_name" = EXCLUDED."category_name",
    "description" = EXCLUDED."description";

-- CreateIndex
CREATE INDEX "pitches_owner_id_is_active_idx" ON "pitches"("owner_id", "is_active");

-- CreateIndex
CREATE INDEX "pitches_category_id_idx" ON "pitches"("category_id");

-- CreateIndex
CREATE INDEX "pitch_schedules_pitch_id_day_of_week_is_active_idx" ON "pitch_schedules"("pitch_id", "day_of_week", "is_active");

-- CreateIndex
CREATE INDEX "bookable_slots_pitch_id_starts_at_ends_at_idx" ON "bookable_slots"("pitch_id", "starts_at", "ends_at");

-- CreateIndex
CREATE INDEX "bookable_slots_status_starts_at_idx" ON "bookable_slots"("status", "starts_at");

-- CreateIndex
CREATE INDEX "bookable_slots_category_id_idx" ON "bookable_slots"("category_id");

-- CreateIndex
CREATE INDEX "parties_owner_id_status_idx" ON "parties"("owner_id", "status");

-- CreateIndex
CREATE INDEX "bookings_slot_id_status_idx" ON "bookings"("slot_id", "status");

-- CreateIndex
CREATE INDEX "bookings_party_id_idx" ON "bookings"("party_id");

-- CreateIndex
CREATE INDEX "bookings_user_id_created_at_idx" ON "bookings"("user_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "bookings_provider_reference_key" ON "bookings"("provider_reference");

-- CreateIndex
CREATE INDEX "party_members_party_id_status_idx" ON "party_members"("party_id", "status");

-- CreateIndex
CREATE INDEX "party_members_user_id_idx" ON "party_members"("user_id");

-- CreateIndex
CREATE INDEX "pitch_subscriptions_owner_id_status_ends_at_idx" ON "pitch_subscriptions"("owner_id", "status", "ends_at");

-- CreateIndex
CREATE INDEX "pitch_subscriptions_pitch_id_idx" ON "pitch_subscriptions"("pitch_id");

-- CreateIndex
CREATE UNIQUE INDEX "payment_pools_booking_id_key" ON "payment_pools"("booking_id");

-- CreateIndex
CREATE INDEX "payment_pools_party_id_status_idx" ON "payment_pools"("party_id", "status");

-- CreateIndex
CREATE INDEX "payment_pools_status_expires_at_idx" ON "payment_pools"("status", "expires_at");

-- CreateIndex
CREATE INDEX "payment_contributions_pool_id_status_idx" ON "payment_contributions"("pool_id", "status");

-- CreateIndex
CREATE INDEX "payment_contributions_user_id_idx" ON "payment_contributions"("user_id");

-- CreateIndex
CREATE INDEX "payment_contributions_party_member_id_idx" ON "payment_contributions"("party_member_id");

-- CreateIndex
CREATE UNIQUE INDEX "payment_contributions_provider_ref_key" ON "payment_contributions"("provider_ref");

-- CreateIndex
CREATE INDEX "booking_tickets_booking_id_status_idx" ON "booking_tickets"("booking_id", "status");

-- CreateIndex
CREATE INDEX "booking_tickets_assigned_user_id_idx" ON "booking_tickets"("assigned_user_id");

-- CreateIndex
CREATE INDEX "booking_tickets_purchaser_id_idx" ON "booking_tickets"("purchaser_id");

-- CreateIndex
CREATE INDEX "user_passes_user_id_status_idx" ON "user_passes"("user_id", "status");

-- CreateIndex
CREATE INDEX "user_passes_party_id_idx" ON "user_passes"("party_id");

-- CreateIndex
CREATE INDEX "host_activity_logs_owner_id_created_at_idx" ON "host_activity_logs"("owner_id", "created_at");

-- CreateIndex
CREATE INDEX "host_activity_logs_pitch_id_created_at_idx" ON "host_activity_logs"("pitch_id", "created_at");

-- CreateIndex
CREATE INDEX "host_activity_logs_entity_type_entity_id_idx" ON "host_activity_logs"("entity_type", "entity_id");

-- AddForeignKey
ALTER TABLE "pitches" ADD CONSTRAINT "pitches_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("category_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pitch_schedules" ADD CONSTRAINT "pitch_schedules_pitch_id_fkey" FOREIGN KEY ("pitch_id") REFERENCES "pitches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookable_slots" ADD CONSTRAINT "bookable_slots_pitch_id_fkey" FOREIGN KEY ("pitch_id") REFERENCES "pitches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookable_slots" ADD CONSTRAINT "bookable_slots_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("category_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_slot_id_fkey" FOREIGN KEY ("slot_id") REFERENCES "bookable_slots"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_party_id_fkey" FOREIGN KEY ("party_id") REFERENCES "parties"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "party_members" ADD CONSTRAINT "party_members_party_id_fkey" FOREIGN KEY ("party_id") REFERENCES "parties"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pitch_subscriptions" ADD CONSTRAINT "pitch_subscriptions_pitch_id_fkey" FOREIGN KEY ("pitch_id") REFERENCES "pitches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_pools" ADD CONSTRAINT "payment_pools_party_id_fkey" FOREIGN KEY ("party_id") REFERENCES "parties"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_pools" ADD CONSTRAINT "payment_pools_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_contributions" ADD CONSTRAINT "payment_contributions_pool_id_fkey" FOREIGN KEY ("pool_id") REFERENCES "payment_pools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_contributions" ADD CONSTRAINT "payment_contributions_party_member_id_fkey" FOREIGN KEY ("party_member_id") REFERENCES "party_members"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_tickets" ADD CONSTRAINT "booking_tickets_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_passes" ADD CONSTRAINT "user_passes_party_id_fkey" FOREIGN KEY ("party_id") REFERENCES "parties"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "host_activity_logs" ADD CONSTRAINT "host_activity_logs_pitch_id_fkey" FOREIGN KEY ("pitch_id") REFERENCES "pitches"("id") ON DELETE SET NULL ON UPDATE CASCADE;
