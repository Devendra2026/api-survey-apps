node.exe : Loaded Prisma config from prisma.config.ts.
At C:\Program Files\nodejs\pnpm.ps1:16 char:5
+     & "$basedir/node$exe"  "$basedir/node_modules/corepack/dist/pnpm. ...
+     ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : NotSpecified: (Loaded Prisma c...isma.config.ts.:String) [], RemoteException
    + FullyQualifiedErrorId : NativeCommandError
 

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "OwnershipType" AS ENUM ('INDIVIDUAL', 'JOINT', 'LIMITED_COMPANY_FIRM', 'TRUST_SOCIETY', 'RELIGIOUS_BODY', 'STATE_GOVERNMENT_BODY', 'CENTRAL_GOVERNMENT_BODY', 'MUNICIPAL_COUNCIL_TOWN_PANCHAYAT', 'LEASE_PROPERTY');

-- CreateEnum
CREATE TYPE "PropertyUse" AS ENUM ('RESIDENTIAL', 'COMMERCIAL', 'OPEN_LAND', 'RELIGIOUS_PROPERTY', 'MIX_PROPERTY');

-- CreateEnum
CREATE TYPE "PropertyType" AS ENUM ('RESIDENTIAL_SELF', 'RESIDENTIAL_RENTED', 'SHOP_BAKERY', 'BANK_OFFICE', 'SCHOOL_COLLEGE', 'MALL_SHOWROOM', 'PETROL_PUMP', 'HOTEL_MARRIAGE_RESTAURANT', 'HOSPITAL_NURSING_PATHOLOGY', 'GODOWN', 'CENTRAL_GOVERNMENT', 'STATE_GOVERNMENT', 'INDUSTRY', 'COLD_STORE', 'OPEN', 'AGRICULTURE', 'OPEN_LAND_GODOWN', 'MANDIR', 'MASJID', 'TRUST_DHARAMSHALA', 'SHAMSHAN_KABRISTAN', 'GURUDWARA_CHURCH', 'RESIDENTIAL_AND_COMMERCIAL');

-- CreateEnum
CREATE TYPE "Situation" AS ENUM ('MAIN_MARKET', 'MAIN_ROAD', 'INTERIOR');

-- CreateEnum
CREATE TYPE "RoadType" AS ENUM ('RCC', 'DAMBAR', 'KACCHA');

-- CreateEnum
CREATE TYPE "TaxRateZone" AS ENUM ('BELOW_9M', 'METER_9_TO_12', 'METER_12_TO_24', 'ABOVE_24M');

-- CreateEnum
CREATE TYPE "AssessmentYear" AS ENUM ('AY_2025_2026', 'AY_2026_2027');

-- CreateEnum
CREATE TYPE "WaterConnection" AS ENUM ('YES', 'NO', 'PARTIAL');

-- CreateEnum
CREATE TYPE "SourceOfWater" AS ENUM ('GOVERNMENT_TAP', 'DUG_WELL', 'BOREWELL', 'OTHER');

-- CreateEnum
CREATE TYPE "SanitationType" AS ENUM ('SEWER_SYSTEM', 'SEPTIC_TANK', 'SURFACE_DRAIN', 'NO_TOILET', 'OTHER');

-- CreateEnum
CREATE TYPE "SurveyStatus" AS ENUM ('DRAFT', 'IN_PROGRESS', 'SUBMITTED', 'APPROVED', 'REJECTED', 'REOPENED');

-- CreateEnum
CREATE TYPE "usageFactor" AS ENUM ('RESIDENTIAL', 'COMMERCIAL', 'MIXED', 'AGRICULTURE', 'GODOWN', 'OPEN_LAND', 'UNDER_CONSTRUCTION');

-- CreateEnum
CREATE TYPE "usageType" AS ENUM ('SELF_OCCUPIED', 'RENTED');

-- CreateEnum
CREATE TYPE "ConstructionType" AS ENUM ('PAKKA_BUILDING_WITH_RCC_ROOF', 'TIN_SHED', 'OPEN_LAND', 'UNDER_CONSTRUCTION', 'KACCHA_BUILDING');

-- CreateEnum
CREATE TYPE "FloorPosition" AS ENUM ('BASEMENT', 'GROUND_FLOOR', 'FIRST_FLOOR', 'SECOND_FLOOR', 'THIRD_FLOOR', 'FOURTH_FLOOR', 'FIFTH_FLOOR_PLUS', 'OPEN_LAND');

-- CreateEnum
CREATE TYPE "PhotoType" AS ENUM ('FRONT', 'SIDE');

-- CreateEnum
CREATE TYPE "UlbType" AS ENUM ('MUNICIPAL_COUNCIL', 'TOWN_PANCHAYAT');

-- CreateEnum
CREATE TYPE "GPSCordinates" AS ENUM ('LATITUDE', 'LONGITUDE');

-- CreateEnum
CREATE TYPE "UserRoles" AS ENUM ('ADMIN', 'SURVEYOR', 'FIELD_SUPERVISOR', 'QC_SUPERVISOR', 'PENDING_APPROVAL');

-- CreateTable
CREATE TABLE "states" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "states_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "districts" (
    "id" TEXT NOT NULL,
    "stateId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "districts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ulbs" (
    "id" TEXT NOT NULL,
    "districtId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "type" "UlbType" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ulbs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wards" (
    "id" TEXT NOT NULL,
    "ulbId" TEXT NOT NULL,
    "wardNumber" TEXT NOT NULL,
    "wardName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "wards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "clerkUserId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "fullName" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roles" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permissions" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "role_permissions" (
    "id" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "permissionId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_tenant_roles" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "stateId" TEXT,
    "districtId" TEXT,
    "ulbId" TEXT,
    "wardId" TEXT,
    "assignedBy" TEXT NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "user_tenant_roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "surveys" (
    "id" TEXT NOT NULL,
    "stateId" TEXT NOT NULL,
    "districtId" TEXT NOT NULL,
    "ulbId" TEXT NOT NULL,
    "wardId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "localId" TEXT,
    "propertyIdOld" TEXT,
    "parcelNumber" TEXT,
    "unitSubNo" TEXT,
    "wardNumber" TEXT,
    "ulbCode" TEXT,
    "districtName" TEXT,
    "respondentName" TEXT,
    "relationshipWithOwner" TEXT,
    "mobileNumber" TEXT,
    "alternateMobile" TEXT,
    "familySize" INTEGER,
    "houseDoorNo" TEXT,
    "locality" TEXT,
    "colony" TEXT,
    "city" TEXT,
    "pinCode" TEXT,
    "ownershipType" "OwnershipType",
    "propertyUse" "PropertyUse",
    "propertyType" "PropertyType",
    "situation" "Situation",
    "roadType" "RoadType",
    "taxRateZone" "TaxRateZone",
    "assessmentYear" "AssessmentYear",
    "plotAreaSqFt" DECIMAL(14,4),
    "plotAreaSqMeter" DECIMAL(14,4),
    "plinthAreaSqFt" DECIMAL(14,4),
    "plinthAreaSqMeter" DECIMAL(14,4),
    "totalBuiltAreaSqFt" DECIMAL(14,4),
    "totalBuiltAreaSqMeter" DECIMAL(14,4),
    "waterConnection" "WaterConnection",
    "sourceOfWater" "SourceOfWater",
    "sanitationType" "SanitationType",
    "solidWasteCollection" BOOLEAN,
    "gpsCoordinates" "GPSCordinates",
    "capturedAt" TIMESTAMP(3),
    "surveyStatus" "SurveyStatus" NOT NULL DEFAULT 'DRAFT',
    "submittedAt" TIMESTAMP(3),
    "approvedAt" TIMESTAMP(3),
    "rejectedAt" TIMESTAMP(3),
    "qcRemarks" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "surveys_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "co_owners" (
    "id" TEXT NOT NULL,
    "surveyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "fatherOrHusbandName" TEXT,
    "mobile" TEXT,
    "alternateMobile" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "co_owners_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "floors" (
    "id" TEXT NOT NULL,
    "surveyId" TEXT NOT NULL,
    "floorPosition" "FloorPosition" NOT NULL,
    "usageFactor" "usageFactor",
    "usageType" "usageType",
    "constructionType" "ConstructionType",
    "occupancy" TEXT,
    "areaSqFt" DECIMAL(14,4),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "floors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "photos" (
    "id" TEXT NOT NULL,
    "surveyId" TEXT NOT NULL,
    "photoType" "PhotoType" NOT NULL,
    "url" TEXT NOT NULL,
    "width" INTEGER,
    "height" INTEGER,
    "sizeKB" INTEGER,
    "capturedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "photos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "survey_audits" (
    "id" TEXT NOT NULL,
    "surveyId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "oldValue" JSONB,
    "newValue" JSONB,
    "changedBy" TEXT NOT NULL,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "survey_audits_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "states_code_key" ON "states"("code");

-- CreateIndex
CREATE INDEX "states_name_idx" ON "states"("name");

-- CreateIndex
CREATE INDEX "districts_stateId_idx" ON "districts"("stateId");

-- CreateIndex
CREATE UNIQUE INDEX "districts_stateId_name_key" ON "districts"("stateId", "name");

-- CreateIndex
CREATE INDEX "ulbs_districtId_idx" ON "ulbs"("districtId");

-- CreateIndex
CREATE INDEX "ulbs_code_idx" ON "ulbs"("code");

-- CreateIndex
CREATE UNIQUE INDEX "ulbs_districtId_name_key" ON "ulbs"("districtId", "name");

-- CreateIndex
CREATE INDEX "wards_ulbId_idx" ON "wards"("ulbId");

-- CreateIndex
CREATE UNIQUE INDEX "wards_ulbId_wardNumber_key" ON "wards"("ulbId", "wardNumber");

-- CreateIndex
CREATE UNIQUE INDEX "users_clerkUserId_key" ON "users"("clerkUserId");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_isActive_idx" ON "users"("isActive");

-- CreateIndex
CREATE INDEX "users_fullName_idx" ON "users"("fullName");

-- CreateIndex
CREATE UNIQUE INDEX "roles_name_key" ON "roles"("name");

-- CreateIndex
CREATE UNIQUE INDEX "permissions_name_key" ON "permissions"("name");

-- CreateIndex
CREATE INDEX "role_permissions_permissionId_idx" ON "role_permissions"("permissionId");

-- CreateIndex
CREATE UNIQUE INDEX "role_permissions_roleId_permissionId_key" ON "role_permissions"("roleId", "permissionId");

-- CreateIndex
CREATE INDEX "user_tenant_roles_userId_idx" ON "user_tenant_roles"("userId");

-- CreateIndex
CREATE INDEX "user_tenant_roles_roleId_idx" ON "user_tenant_roles"("roleId");

-- CreateIndex
CREATE INDEX "user_tenant_roles_stateId_idx" ON "user_tenant_roles"("stateId");

-- CreateIndex
CREATE INDEX "user_tenant_roles_districtId_idx" ON "user_tenant_roles"("districtId");

-- CreateIndex
CREATE INDEX "user_tenant_roles_ulbId_idx" ON "user_tenant_roles"("ulbId");

-- CreateIndex
CREATE INDEX "user_tenant_roles_wardId_idx" ON "user_tenant_roles"("wardId");

-- CreateIndex
CREATE INDEX "user_tenant_roles_isActive_idx" ON "user_tenant_roles"("isActive");

-- CreateIndex
CREATE INDEX "user_tenant_roles_userId_isActive_idx" ON "user_tenant_roles"("userId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "surveys_propertyId_key" ON "surveys"("propertyId");

-- CreateIndex
CREATE INDEX "surveys_stateId_surveyStatus_idx" ON "surveys"("stateId", "surveyStatus");

-- CreateIndex
CREATE INDEX "surveys_districtId_surveyStatus_idx" ON "surveys"("districtId", "surveyStatus");

-- CreateIndex
CREATE INDEX "surveys_ulbId_surveyStatus_idx" ON "surveys"("ulbId", "surveyStatus");

-- CreateIndex
CREATE INDEX "surveys_wardId_surveyStatus_idx" ON "surveys"("wardId", "surveyStatus");

-- CreateIndex
CREATE INDEX "surveys_createdById_createdAt_idx" ON "surveys"("createdById", "createdAt");

-- CreateIndex
CREATE INDEX "surveys_surveyStatus_createdAt_idx" ON "surveys"("surveyStatus", "createdAt");

-- CreateIndex
CREATE INDEX "surveys_createdAt_idx" ON "surveys"("createdAt");

-- CreateIndex
CREATE INDEX "surveys_deletedAt_idx" ON "surveys"("deletedAt");

-- CreateIndex
CREATE INDEX "surveys_mobileNumber_idx" ON "surveys"("mobileNumber");

-- CreateIndex
CREATE INDEX "co_owners_surveyId_idx" ON "co_owners"("surveyId");

-- CreateIndex
CREATE INDEX "floors_surveyId_idx" ON "floors"("surveyId");

-- CreateIndex
CREATE INDEX "floors_surveyId_floorPosition_idx" ON "floors"("surveyId", "floorPosition");

-- CreateIndex
CREATE INDEX "photos_surveyId_idx" ON "photos"("surveyId");

-- CreateIndex
CREATE INDEX "photos_surveyId_photoType_idx" ON "photos"("surveyId", "photoType");

-- CreateIndex
CREATE INDEX "survey_audits_surveyId_idx" ON "survey_audits"("surveyId");

-- CreateIndex
CREATE INDEX "survey_audits_changedBy_idx" ON "survey_audits"("changedBy");

-- CreateIndex
CREATE INDEX "survey_audits_changedAt_idx" ON "survey_audits"("changedAt");

-- CreateIndex
CREATE INDEX "survey_audits_surveyId_changedAt_idx" ON "survey_audits"("surveyId", "changedAt");

-- AddForeignKey
ALTER TABLE "districts" ADD CONSTRAINT "districts_stateId_fkey" FOREIGN KEY ("stateId") REFERENCES "states"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ulbs" ADD CONSTRAINT "ulbs_districtId_fkey" FOREIGN KEY ("districtId") REFERENCES "districts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wards" ADD CONSTRAINT "wards_ulbId_fkey" FOREIGN KEY ("ulbId") REFERENCES "ulbs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "permissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_tenant_roles" ADD CONSTRAINT "user_tenant_roles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_tenant_roles" ADD CONSTRAINT "user_tenant_roles_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_tenant_roles" ADD CONSTRAINT "user_tenant_roles_stateId_fkey" FOREIGN KEY ("stateId") REFERENCES "states"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_tenant_roles" ADD CONSTRAINT "user_tenant_roles_districtId_fkey" FOREIGN KEY ("districtId") REFERENCES "districts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_tenant_roles" ADD CONSTRAINT "user_tenant_roles_ulbId_fkey" FOREIGN KEY ("ulbId") REFERENCES "ulbs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_tenant_roles" ADD CONSTRAINT "user_tenant_roles_wardId_fkey" FOREIGN KEY ("wardId") REFERENCES "wards"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_tenant_roles" ADD CONSTRAINT "user_tenant_roles_assignedBy_fkey" FOREIGN KEY ("assignedBy") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "surveys" ADD CONSTRAINT "surveys_stateId_fkey" FOREIGN KEY ("stateId") REFERENCES "states"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "surveys" ADD CONSTRAINT "surveys_districtId_fkey" FOREIGN KEY ("districtId") REFERENCES "districts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "surveys" ADD CONSTRAINT "surveys_ulbId_fkey" FOREIGN KEY ("ulbId") REFERENCES "ulbs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "surveys" ADD CONSTRAINT "surveys_wardId_fkey" FOREIGN KEY ("wardId") REFERENCES "wards"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "surveys" ADD CONSTRAINT "surveys_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "co_owners" ADD CONSTRAINT "co_owners_surveyId_fkey" FOREIGN KEY ("surveyId") REFERENCES "surveys"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "floors" ADD CONSTRAINT "floors_surveyId_fkey" FOREIGN KEY ("surveyId") REFERENCES "surveys"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "photos" ADD CONSTRAINT "photos_surveyId_fkey" FOREIGN KEY ("surveyId") REFERENCES "surveys"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "survey_audits" ADD CONSTRAINT "survey_audits_surveyId_fkey" FOREIGN KEY ("surveyId") REFERENCES "surveys"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "survey_audits" ADD CONSTRAINT "survey_audits_changedBy_fkey" FOREIGN KEY ("changedBy") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

