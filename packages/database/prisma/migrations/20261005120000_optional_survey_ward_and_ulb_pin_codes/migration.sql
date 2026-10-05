-- Field drafts can be saved before a ward is chosen. Existing rows stay filled.
ALTER TABLE "surveys" ALTER COLUMN "wardId" DROP NOT NULL;

-- Tenant location PIN from survey start. The address PIN stays on "pinCode".
ALTER TABLE "surveys" ADD COLUMN "locationPinCode" TEXT;
