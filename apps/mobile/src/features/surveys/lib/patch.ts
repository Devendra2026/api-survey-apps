import { constructedYearError } from "./field-format.ts"
import {
  ASSESSMENT_YEARS,
  OWNERSHIP_TYPES,
  PROPERTY_TYPES,
  PROPERTY_USES,
  ROAD_TYPES,
  SANITATION_TYPES,
  SITUATIONS,
  SOURCES_OF_WATER,
  TAX_RATE_ZONES,
  WATER_CONNECTIONS,
  type SurveyEditableFields,
  type SurveyPatch,
} from "../types.ts"

const STRING_KEYS = [
  "wardId",
  "parcelNumber",
  "unitSubNo",
  "sectorNo",
  "propertyIdOld",
  "respondentName",
  "relationshipWithOwner",
  "mobileNumber",
  "alternateMobile",
  "houseDoorNo",
  "locality",
  "colony",
  "city",
  "pinCode",
  "capturedAt",
] as const

const NUMBER_KEYS = [
  "familySize",
  "plotAreaSqFt",
  "plinthAreaSqFt",
  "latitude",
  "longitude",
  "gpsAccuracyMeters",
] as const

const ENUM_KEYS = {
  ownershipType: OWNERSHIP_TYPES,
  propertyUse: PROPERTY_USES,
  propertyType: PROPERTY_TYPES,
  situation: SITUATIONS,
  roadType: ROAD_TYPES,
  taxRateZone: TAX_RATE_ZONES,
  waterConnection: WATER_CONNECTIONS,
  sourceOfWater: SOURCES_OF_WATER,
  sanitationType: SANITATION_TYPES,
} as const

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function pickEnum<T extends string>(allowed: readonly T[], value: unknown): T | null | undefined {
  if (value === null) return null
  return allowed.find((candidate) => candidate === value)
}

/**
 * Rebuilds a `SurveyPatch` from untrusted JSON (device storage). Unknown keys and wrong types are
 * dropped so a corrupted entry can never send a field the API DTO would reject.
 */
export function sanitizePatch(raw: unknown): SurveyPatch {
  if (!isRecord(raw)) return {}
  const out: SurveyPatch = {}

  for (const key of STRING_KEYS) {
    const value = raw[key]
    if (key === "wardId") {
      if (typeof value === "string" && value.trim() !== "") out.wardId = value.trim()
      continue
    }
    if (value === null || typeof value === "string") out[key] = value
  }
  for (const key of NUMBER_KEYS) {
    const value = raw[key]
    if (value === null || (typeof value === "number" && Number.isFinite(value))) out[key] = value
  }

  // Do not copy client-generated propertyId into the outgoing patch — Nest writes it on update.

  const solid = raw.solidWasteCollection
  if (solid === null || typeof solid === "boolean") out.solidWasteCollection = solid
  if (typeof raw.isSlum === "boolean") out.isSlum = raw.isSlum
  if (raw.constructedYear === null) {
    out.constructedYear = null
  } else if (typeof raw.constructedYear === "number" && !constructedYearError(raw.constructedYear)) {
    out.constructedYear = raw.constructedYear
  }

  const year = pickEnum(ASSESSMENT_YEARS, raw.assessmentYear)
  if (year) out.assessmentYear = year

  const ownership = pickEnum(ENUM_KEYS.ownershipType, raw.ownershipType)
  if (ownership !== undefined) out.ownershipType = ownership
  const use = pickEnum(ENUM_KEYS.propertyUse, raw.propertyUse)
  if (use !== undefined) out.propertyUse = use
  const type = pickEnum(ENUM_KEYS.propertyType, raw.propertyType)
  if (type !== undefined) out.propertyType = type
  const situation = pickEnum(ENUM_KEYS.situation, raw.situation)
  if (situation !== undefined) out.situation = situation
  const road = pickEnum(ENUM_KEYS.roadType, raw.roadType)
  if (road !== undefined) out.roadType = road
  const zone = pickEnum(ENUM_KEYS.taxRateZone, raw.taxRateZone)
  if (zone !== undefined) out.taxRateZone = zone
  const water = pickEnum(ENUM_KEYS.waterConnection, raw.waterConnection)
  if (water !== undefined) out.waterConnection = water
  const source = pickEnum(ENUM_KEYS.sourceOfWater, raw.sourceOfWater)
  if (source !== undefined) out.sourceOfWater = source
  const sanitation = pickEnum(ENUM_KEYS.sanitationType, raw.sanitationType)
  if (sanitation !== undefined) out.sanitationType = sanitation

  if (raw.gpsSource === "DEVICE") out.gpsSource = "DEVICE"
  return out
}

export function isEmptyPatch(patch: SurveyPatch): boolean {
  return Object.keys(patch).length === 0
}

/** Later edits win key-by-key. */
export function mergePatch(base: SurveyPatch, next: SurveyPatch): SurveyPatch {
  return { ...base, ...next }
}

const PATCH_KEYS: readonly (keyof SurveyPatch)[] = [
  ...STRING_KEYS,
  ...NUMBER_KEYS,
  "propertyId",
  "solidWasteCollection",
  "isSlum",
  "constructedYear",
  "assessmentYear",
  "ownershipType",
  "propertyUse",
  "propertyType",
  "situation",
  "roadType",
  "taxRateZone",
  "waterConnection",
  "sourceOfWater",
  "sanitationType",
  "gpsSource",
]

/** Removes keys whose value was confirmed by the server while newer edits may still be pending. */
export function subtractSentPatch(pending: SurveyPatch, sent: SurveyPatch): SurveyPatch {
  const remaining: SurveyPatch = { ...pending }
  for (const key of PATCH_KEYS) {
    if (key in sent && remaining[key] === sent[key]) delete remaining[key]
  }
  return remaining
}

function decimalToNumber(value: SurveyEditableFields["latitude"]): number | null {
  if (value === null) return null
  const n = typeof value === "number" ? value : Number(value)
  return Number.isFinite(n) ? n : null
}

/** Server record → the editable-field view used by the form (decimals as numbers). */
export function recordToFields(record: SurveyEditableFields): SurveyEditableFields {
  return {
    ...record,
    sectorNo: record.sectorNo ?? null,
    constructedYear: record.constructedYear ?? null,
    isSlum: record.isSlum ?? false,
    plotAreaSqFt: decimalToNumber(record.plotAreaSqFt),
    plinthAreaSqFt: decimalToNumber(record.plinthAreaSqFt),
    latitude: decimalToNumber(record.latitude),
    longitude: decimalToNumber(record.longitude),
    gpsAccuracyMeters: decimalToNumber(record.gpsAccuracyMeters),
  }
}

/** Applies a pending patch on top of server fields for display. */
export function applyPatch(fields: SurveyEditableFields, patch: SurveyPatch): SurveyEditableFields {
  const { gpsSource: _gpsSource, ...rest } = patch
  return { ...fields, ...rest }
}
