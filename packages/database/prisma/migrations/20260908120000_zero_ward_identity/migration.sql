-- Additive Zero Ward identity. Does not update survey rows or Property IDs.

CREATE TYPE "WardKind" AS ENUM ('GEOGRAPHIC', 'ZERO');

ALTER TABLE "wards" ADD COLUMN "kind" "WardKind" NOT NULL DEFAULT 'GEOGRAPHIC';

ALTER TABLE "surveys" ADD COLUMN "originalWardId" TEXT;

CREATE INDEX "surveys_originalWardId_idx" ON "surveys"("originalWardId");

ALTER TABLE "surveys" ADD CONSTRAINT "surveys_originalWardId_fkey"
  FOREIGN KEY ("originalWardId") REFERENCES "wards"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Exactly one active Zero Ward per ULB.
CREATE UNIQUE INDEX "wards_ulbId_zero_kind_active_key"
  ON "wards" ("ulbId")
  WHERE "kind" = 'ZERO' AND "deletedAt" IS NULL;
