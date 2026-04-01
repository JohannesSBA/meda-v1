-- Allow multiple claims by same account for beneficiary workflows
DROP INDEX IF EXISTS "invitation_claims_invitation_id_claimed_by_user_id_key";
CREATE INDEX IF NOT EXISTS "invitation_claims_invitation_id_claimed_by_user_id_idx"
  ON "invitation_claims"("invitation_id", "claimed_by_user_id");

-- Host can attach an image to a place
ALTER TABLE "pitches"
  ADD COLUMN IF NOT EXISTS "picture_url" VARCHAR(255);
