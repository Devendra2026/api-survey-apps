-- Postal PIN catalog for a ULB. Survey address pinCode is unchanged.

CREATE TABLE "ulb_pin_codes" (
    "id" TEXT NOT NULL,
    "ulbId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ulb_pin_codes_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ulb_pin_codes_ulbId_code_key" ON "ulb_pin_codes"("ulbId", "code");

CREATE INDEX "ulb_pin_codes_ulbId_idx" ON "ulb_pin_codes"("ulbId");

ALTER TABLE "ulb_pin_codes"
  ADD CONSTRAINT "ulb_pin_codes_ulbId_fkey"
  FOREIGN KEY ("ulbId") REFERENCES "ulbs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
