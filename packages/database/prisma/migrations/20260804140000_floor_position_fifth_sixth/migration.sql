-- Step 1: add new FloorPosition values (must commit before use).
ALTER TYPE "FloorPosition" ADD VALUE IF NOT EXISTS 'FIFTH_FLOOR';
ALTER TYPE "FloorPosition" ADD VALUE IF NOT EXISTS 'SIXTH_FLOOR';
