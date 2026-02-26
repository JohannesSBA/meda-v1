-- AlterTable
ALTER TABLE "invitations"
ADD COLUMN "max_claims" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "claimed_count" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "invitation_claims" (
    "invitation_claim_id" UUID NOT NULL,
    "invitation_id" UUID NOT NULL,
    "claimed_by_user_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "invitation_claims_pkey" PRIMARY KEY ("invitation_claim_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "invitation_claims_invitation_id_claimed_by_user_id_key"
ON "invitation_claims"("invitation_id", "claimed_by_user_id");

-- AddForeignKey
ALTER TABLE "invitation_claims"
ADD CONSTRAINT "invitation_claims_invitation_id_fkey"
FOREIGN KEY ("invitation_id") REFERENCES "invitations"("invitation_id")
ON DELETE CASCADE ON UPDATE CASCADE;
