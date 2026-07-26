-- CreateEnum
CREATE TYPE "RoleFamily" AS ENUM ('PLATFORM', 'DEPARTMENT');

-- AlterTable
ALTER TABLE "roles" ADD COLUMN "family" "RoleFamily" NOT NULL DEFAULT 'PLATFORM';

-- CreateIndex
CREATE INDEX "roles_family_idx" ON "roles"("family");
