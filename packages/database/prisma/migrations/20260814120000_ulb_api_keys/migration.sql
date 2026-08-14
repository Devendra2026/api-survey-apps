-- Hashed M2M API keys for external ULB portals. One active key per ULB.
CREATE TABLE "ulb_api_keys" (
    "id" TEXT NOT NULL,
    "ulbId" TEXT NOT NULL,
    "keyHash" TEXT NOT NULL,
    "keyPrefix" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "ulb_api_keys_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ulb_api_keys_keyHash_key" ON "ulb_api_keys"("keyHash");

CREATE INDEX "ulb_api_keys_ulbId_isActive_idx" ON "ulb_api_keys"("ulbId", "isActive");

CREATE UNIQUE INDEX "ulb_api_keys_ulbId_active_key"
  ON "ulb_api_keys" ("ulbId")
  WHERE "isActive" = true;

ALTER TABLE "ulb_api_keys"
  ADD CONSTRAINT "ulb_api_keys_ulbId_fkey"
  FOREIGN KEY ("ulbId") REFERENCES "ulbs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ulb_api_keys"
  ADD CONSTRAINT "ulb_api_keys_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
