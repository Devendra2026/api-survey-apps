-- CreateEnum
CREATE TYPE "GeoEntityStatus" AS ENUM ('ACTIVE', 'DISABLED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ReferenceEntryStatus" AS ENUM ('ACTIVE', 'DISABLED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "TaxConfigStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- AlterTable
ALTER TABLE "districts" ADD COLUMN     "status" "GeoEntityStatus" NOT NULL DEFAULT 'ACTIVE',
ADD COLUMN     "updatedBy" TEXT;

-- AlterTable
ALTER TABLE "states" ADD COLUMN     "status" "GeoEntityStatus" NOT NULL DEFAULT 'ACTIVE',
ADD COLUMN     "updatedBy" TEXT;

-- AlterTable
ALTER TABLE "ulbs" ADD COLUMN     "status" "GeoEntityStatus" NOT NULL DEFAULT 'ACTIVE',
ADD COLUMN     "updatedBy" TEXT;

-- AlterTable
ALTER TABLE "wards" ADD COLUMN     "status" "GeoEntityStatus" NOT NULL DEFAULT 'ACTIVE',
ADD COLUMN     "updatedBy" TEXT;

-- CreateTable
CREATE TABLE "reference_categories" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "iconKey" TEXT,
    "isSystem" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reference_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reference_entries" (
    "id" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "value" TEXT,
    "status" "ReferenceEntryStatus" NOT NULL DEFAULT 'ACTIVE',
    "version" INTEGER NOT NULL DEFAULT 1,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reference_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tax_configs" (
    "id" TEXT NOT NULL,
    "wardId" TEXT NOT NULL,
    "assessmentYearId" TEXT NOT NULL,
    "status" "TaxConfigStatus" NOT NULL DEFAULT 'DRAFT',
    "version" INTEGER NOT NULL DEFAULT 1,
    "effectiveFrom" TIMESTAMP(3),
    "propertyTaxPct" DECIMAL(8,4) NOT NULL DEFAULT 10,
    "waterTaxPct" DECIMAL(8,4) NOT NULL DEFAULT 0,
    "drainageTaxPct" DECIMAL(8,4) NOT NULL DEFAULT 0,
    "penaltyPct" DECIMAL(8,4) NOT NULL DEFAULT 0,
    "assessablePct" DECIMAL(8,4) NOT NULL DEFAULT 80,
    "publishedAt" TIMESTAMP(3),
    "publishedBy" TEXT,
    "changeReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tax_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tax_rate_cells" (
    "id" TEXT NOT NULL,
    "taxConfigId" TEXT NOT NULL,
    "roadWidthEntryId" TEXT NOT NULL,
    "constructionEntryId" TEXT NOT NULL,
    "annualRatePerSqFt" DECIMAL(14,4) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tax_rate_cells_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tax_config_versions" (
    "id" TEXT NOT NULL,
    "taxConfigId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "snapshot" JSONB NOT NULL,
    "reason" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tax_config_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "config_audit_logs" (
    "id" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "oldValue" JSONB,
    "newValue" JSONB,
    "reason" TEXT,
    "actorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "config_audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "reference_categories_code_key" ON "reference_categories"("code");

-- CreateIndex
CREATE INDEX "reference_entries_categoryId_status_idx" ON "reference_entries"("categoryId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "reference_entries_categoryId_code_key" ON "reference_entries"("categoryId", "code");

-- CreateIndex
CREATE INDEX "tax_configs_wardId_assessmentYearId_idx" ON "tax_configs"("wardId", "assessmentYearId");

-- CreateIndex
CREATE INDEX "tax_configs_status_idx" ON "tax_configs"("status");

-- CreateIndex
CREATE UNIQUE INDEX "tax_configs_wardId_assessmentYearId_key" ON "tax_configs"("wardId", "assessmentYearId");

-- CreateIndex
CREATE UNIQUE INDEX "tax_rate_cells_taxConfigId_roadWidthEntryId_constructionEnt_key" ON "tax_rate_cells"("taxConfigId", "roadWidthEntryId", "constructionEntryId");

-- CreateIndex
CREATE INDEX "tax_config_versions_taxConfigId_version_idx" ON "tax_config_versions"("taxConfigId", "version");

-- CreateIndex
CREATE INDEX "config_audit_logs_entityType_entityId_idx" ON "config_audit_logs"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "config_audit_logs_createdAt_idx" ON "config_audit_logs"("createdAt");

-- CreateIndex
CREATE INDEX "districts_status_idx" ON "districts"("status");

-- CreateIndex
CREATE INDEX "states_status_idx" ON "states"("status");

-- CreateIndex
CREATE INDEX "ulbs_status_idx" ON "ulbs"("status");

-- CreateIndex
CREATE INDEX "wards_status_idx" ON "wards"("status");

-- AddForeignKey
ALTER TABLE "reference_entries" ADD CONSTRAINT "reference_entries_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "reference_categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tax_configs" ADD CONSTRAINT "tax_configs_wardId_fkey" FOREIGN KEY ("wardId") REFERENCES "wards"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tax_configs" ADD CONSTRAINT "tax_configs_assessmentYearId_fkey" FOREIGN KEY ("assessmentYearId") REFERENCES "reference_entries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tax_rate_cells" ADD CONSTRAINT "tax_rate_cells_taxConfigId_fkey" FOREIGN KEY ("taxConfigId") REFERENCES "tax_configs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tax_rate_cells" ADD CONSTRAINT "tax_rate_cells_roadWidthEntryId_fkey" FOREIGN KEY ("roadWidthEntryId") REFERENCES "reference_entries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tax_rate_cells" ADD CONSTRAINT "tax_rate_cells_constructionEntryId_fkey" FOREIGN KEY ("constructionEntryId") REFERENCES "reference_entries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tax_config_versions" ADD CONSTRAINT "tax_config_versions_taxConfigId_fkey" FOREIGN KEY ("taxConfigId") REFERENCES "tax_configs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
