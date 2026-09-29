-- Additive: signup role intent for mobile/admin display (not authorization).
-- Nullable only; existing rows and writers are unaffected.
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "requestedRole" TEXT;
