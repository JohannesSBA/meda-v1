-- CreateEnum
CREATE TYPE "HostTrustBadge" AS ENUM ('NEW_HOST', 'RELIABLE_HOST', 'HIGHLY_RATED', 'NEEDS_IMPROVEMENT');

-- CreateTable
CREATE TABLE "host_reviews" (
    "id" UUID NOT NULL,
    "event_id" UUID NOT NULL,
    "host_id" UUID NOT NULL,
    "reviewer_id" UUID NOT NULL,
    "booking_id" UUID,
    "rating" INTEGER NOT NULL,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "host_reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "host_trust_metrics" (
    "id" UUID NOT NULL,
    "host_id" UUID NOT NULL,
    "avg_rating" DECIMAL(4,3) NOT NULL DEFAULT 0,
    "review_count" INTEGER NOT NULL DEFAULT 0,
    "attendance_rate" DECIMAL(5,4) NOT NULL DEFAULT 0,
    "cancellation_rate" DECIMAL(5,4) NOT NULL DEFAULT 0,
    "refund_rate" DECIMAL(5,4) NOT NULL DEFAULT 0,
    "repeat_player_rate" DECIMAL(5,4) NOT NULL DEFAULT 0,
    "trust_score" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "trust_score_version" VARCHAR(16) NOT NULL DEFAULT 'v1',
    "trust_badge" "HostTrustBadge" NOT NULL DEFAULT 'NEW_HOST',
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "host_trust_metrics_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "host_reviews_reviewer_id_event_id_key" ON "host_reviews"("reviewer_id", "event_id");
CREATE INDEX "host_reviews_host_id_created_at_idx" ON "host_reviews"("host_id", "created_at");
CREATE INDEX "host_reviews_event_id_reviewer_id_idx" ON "host_reviews"("event_id", "reviewer_id");
CREATE INDEX "host_reviews_booking_id_idx" ON "host_reviews"("booking_id");
CREATE UNIQUE INDEX "host_trust_metrics_host_id_key" ON "host_trust_metrics"("host_id");
CREATE INDEX "host_trust_metrics_trust_badge_trust_score_idx" ON "host_trust_metrics"("trust_badge", "trust_score");

-- AddForeignKey
ALTER TABLE "host_reviews" ADD CONSTRAINT "host_reviews_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("event_id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "host_reviews" ADD CONSTRAINT "host_reviews_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE SET NULL ON UPDATE CASCADE;
