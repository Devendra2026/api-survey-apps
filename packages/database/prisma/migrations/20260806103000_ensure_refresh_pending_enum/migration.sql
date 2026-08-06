-- Idempotent repair: earlier migration used ADD VALUE inside a DO block, which
-- PostgreSQL rejects ("cannot be executed from a function"), so some envs have
-- the API code for REFRESH_PENDING without the Postgres enum label.
ALTER TYPE "MigrationJobType" ADD VALUE IF NOT EXISTS 'REFRESH_PENDING';
