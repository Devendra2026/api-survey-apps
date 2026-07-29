import {
  mapAssessmentYear,
  mapConstructionType,
  mapFloorPosition,
  mapFloorPositionByIndex,
  mapGpsSource,
  mapOwnershipType,
  mapPropertyType,
  mapPropertyUse,
  mapQcStatus,
  mapRoadType,
  mapSanitationType,
  mapSituation,
  mapSourceOfWater,
  mapSurveyStatus,
  mapTaxRateZone,
  mapUsageFactor,
  mapUsageType,
  mapWaterConnection,
  sqFtToSqMeter,
} from "@workspace/validation"
import { computeChecksum } from "../checksum/checksum.js"
import {
  ETL_DRAFT_DEFAULT_ASSESSMENT_YEAR,
  ETL_DRAFT_PLACEHOLDER_WARD,
  SLOT_TO_PHOTO_TYPE,
  type ConvexSurveyBundle,
  type MappedPhotoPlan,
  type MappedSurvey,
  type TransformContext,
  type TransformResult,
} from "../domain/types.js"
import { buildStorageKey } from "../images/storage-key.js"
import { validateConvexBundle } from "../validation/validate-bundle.js"

export interface TransformOptions {
  /** When true, already-completed surveys are reported as skip/duplicate. */
  existingStatus?: "COMPLETED" | "SKIPPED" | "FAILED" | "PENDING" | "IN_PROGRESS" | null
}

/**
 * Pure transform: Convex bundle → Nest-mapped survey payload.
 * Duplicate detection uses legacySurveyId status only (never name/timestamp).
 */
export function transformSurveyBundle(
  bundle: ConvexSurveyBundle,
  ctx: TransformContext,
  options: TransformOptions = {}
): TransformResult {
  const legacySurveyId = bundle._id

  if (options.existingStatus === "COMPLETED" || options.existingStatus === "SKIPPED") {
    return { ok: true, skip: true, reason: "duplicate", legacySurveyId }
  }

  const issues = validateConvexBundle(bundle)
  if (issues.length > 0) {
    // Incomplete source rows — skip (do not leave FAILED) so full migration can finish clean
    return {
      ok: true,
      skip: true,
      reason: `incomplete: ${issues.map((i) => `${i.field}: ${i.message}`).join("; ")}`,
      legacySurveyId,
    }
  }

  const isDraft = bundle.status === "draft"
  const wardNo = bundle.wardNo?.trim() || (isDraft ? ETL_DRAFT_PLACEHOLDER_WARD : "")

  const geo = ctx.resolveGeo({
    districtCode: bundle.districtCode,
    municipalityCode: bundle.municipalityCode,
    wardNo,
  })
  if (!geo) {
    return {
      ok: false,
      legacySurveyId,
      stage: "TRANSFORM",
      error: `Geo catalog not found for district=${bundle.districtCode} ulb=${bundle.municipalityCode} ward=${wardNo}`,
    }
  }

  const assessmentYear =
    mapAssessmentYear(bundle.assessmentYear) ?? (isDraft ? ETL_DRAFT_DEFAULT_ASSESSMENT_YEAR : undefined)
  if (!assessmentYear) {
    return {
      ok: false,
      legacySurveyId,
      stage: "TRANSFORM",
      error: `Missing required field: invalid assessmentYear (${bundle.assessmentYear})`,
    }
  }

  const createdById =
    ctx.resolveUserId({
      clerkId: bundle.surveyorClerkId,
      email: bundle.surveyorEmail,
    }) ?? ctx.systemUserId

  const propertyId =
    (bundle.propertyId?.trim() ||
      bundle.parcelNo?.trim() ||
      bundle.localId?.trim() ||
      legacySurveyId).toUpperCase()

  const photos: MappedPhotoPlan[] = []
  for (const photo of bundle.photos ?? []) {
    if (!photo.url) continue
    const photoType = SLOT_TO_PHOTO_TYPE[photo.slot]
    if (!photoType) continue
    photos.push({
      slot: photo.slot,
      photoType,
      sourceUrl: photo.url,
      // Extension finalized after MIME detection at upload time; placeholder webp path
      objectKey: buildStorageKey({
        districtCode: geo.districtCode,
        wardNo: geo.wardNo,
        legacySurveyId,
        slot: photo.slot,
        extension: "webp",
      }),
      width: photo.width,
      height: photo.height,
      sizeKb: photo.sizeKb,
      capturedAt: photo.capturedAt,
    })
  }

  // Stash district code for key rebuild after MIME detection (via photos[0] path or rebuild helper)
  const districtCodeForKeys = geo.districtCode

  const coOwners = (bundle.owners ?? [])
    .map((owner, index) => {
      const name = owner.name?.trim()
      if (!name) return null
      return {
        ownerIndex: index + 1,
        name,
        fatherOrHusbandName: owner.fatherOrHusbandName,
        mobile: owner.mobileNo,
        alternateMobile: owner.altMobileNo,
      }
    })
    .filter((row): row is NonNullable<typeof row> => row != null)

  const floorsRaw = (bundle.floors ?? []).map((floor, index) => ({
    clientFloorId: floor.clientFloorId,
    floorPosition:
      mapFloorPosition(floor.floorName) ??
      mapFloorPosition(floor.position == null ? null : String(floor.position)) ??
      mapFloorPositionByIndex(floor.position ?? index) ??
      "GROUND_FLOOR",
    usageFactor: mapUsageFactor(floor.usageFactor),
    usageType: mapUsageType(floor.usageType),
    constructionType: mapConstructionType(floor.constructionType),
    occupancy: floor.isOccupied ? "OCCUPIED" : "VACANT",
    areaSqFt: floor.areaSqft ?? 0,
    position: floor.position ?? index,
  }))
  // Prisma @@unique([surveyId, floorPosition]) — collapse duplicate mapped positions
  const floorsByPosition = new Map<string, (typeof floorsRaw)[number]>()
  for (const floor of floorsRaw) {
    const existing = floorsByPosition.get(floor.floorPosition)
    if (!existing) {
      floorsByPosition.set(floor.floorPosition, floor)
      continue
    }
    floorsByPosition.set(floor.floorPosition, {
      ...existing,
      areaSqFt: existing.areaSqFt + floor.areaSqFt,
    })
  }
  const floors = [...floorsByPosition.values()]

  const waterConnection = mapWaterConnection(
    bundle.municipalWaterConnection === true ? "yes" : bundle.municipalWaterConnection === false ? "no" : undefined
  )

  const mapped: MappedSurvey = {
    legacySurveyId,
    localId: bundle.localId,
    propertyId,
    propertyIdOld: bundle.oldPropertyNo,
    parcelNumber: bundle.parcelNo,
    unitSubNo: bundle.unitNo,
    sectorNo: bundle.sectorNo,
    constructedYear: bundle.constructedYear,
    isSlum: bundle.isSlum ?? false,
    wardNumber: wardNo,
    ulbCode: bundle.municipalityCode,
    districtName: bundle.districtName,
    respondentName: bundle.respondentName,
    relationshipWithOwner: bundle.relationship,
    mobileNumber: bundle.mobileNo,
    alternateMobile: bundle.altMobileNo,
    familySize: bundle.familySize,
    houseDoorNo: bundle.houseNo,
    locality: bundle.locality,
    colony: bundle.colonyName,
    city: bundle.city,
    pinCode: bundle.pinCode,
    ownershipType: mapOwnershipType(bundle.ownershipType),
    propertyUse: mapPropertyUse(bundle.propertyUse),
    propertyType: mapPropertyType(bundle.propertyType),
    situation: mapSituation(bundle.situation),
    roadType: mapRoadType(bundle.roadType),
    taxRateZone: mapTaxRateZone(bundle.taxRateZone),
    assessmentYear,
    plotAreaSqFt: bundle.plotSqft,
    plotAreaSqMeter: sqFtToSqMeter(bundle.plotSqft),
    plinthAreaSqFt: bundle.plinthSqft,
    plinthAreaSqMeter: sqFtToSqMeter(bundle.plinthSqft),
    waterConnection,
    sourceOfWater: mapSourceOfWater(bundle.waterSource),
    sanitationType: mapSanitationType(bundle.sanitationType),
    solidWasteCollection: bundle.municipalWasteCollection,
    electricityConsumerNo: bundle.electricityNo,
    latitude: bundle.gps?.latitude,
    longitude: bundle.gps?.longitude,
    gpsAccuracyMeters: bundle.gps?.accuracyMeters,
    gpsProvider: bundle.gps?.provider,
    gpsMockLocation: bundle.gps?.isMockLocation,
    gpsSource: mapGpsSource(bundle.gps ? "device" : undefined),
    capturedAt: bundle.gps?.capturedAt ? new Date(bundle.gps.capturedAt) : undefined,
    surveyStatus: mapSurveyStatus(bundle.status) ?? "SUBMITTED",
    qcStatus: mapQcStatus(bundle.qcStatus) ?? "PENDING",
    serverVersion: bundle.serverVersion ?? 1,
    completionPct: bundle.completionPct,
    clientUpdatedAt: bundle.clientUpdatedAt ? new Date(bundle.clientUpdatedAt) : undefined,
    submittedAt: bundle.submittedAt ? new Date(bundle.submittedAt) : undefined,
    stateId: geo.stateId,
    districtId: geo.districtId,
    ulbId: geo.ulbId,
    wardId: geo.wardId,
    districtCode: districtCodeForKeys,
    createdById,
    coOwners,
    floors,
    photos,
    checksum: "",
    imagesExpected: photos.length,
  }

  mapped.checksum = computeChecksum({
    ...mapped,
    photos: mapped.photos.map(({ sourceUrl: _s, objectKey: _o, ...rest }) => rest),
  })

  return { ok: true, survey: mapped }
}

export function rebuildPhotoKeysWithExtension(
  survey: MappedSurvey,
  districtCode: string,
  extensionBySlot: Partial<Record<MappedPhotoPlan["slot"], string>>
): MappedSurvey {
  const photos = survey.photos.map((photo) => ({
    ...photo,
    objectKey: buildStorageKey({
      districtCode,
      wardNo: survey.wardNumber ?? "unknown",
      legacySurveyId: survey.legacySurveyId,
      slot: photo.slot,
      extension: extensionBySlot[photo.slot] ?? "webp",
    }),
  }))
  return { ...survey, photos }
}

export function extractDistrictCodeFromObjectKey(objectKey?: string): string {
  if (!objectKey) return "unknown"
  const match = /district-([^/]+)/.exec(objectKey)
  return match?.[1] ?? "unknown"
}
