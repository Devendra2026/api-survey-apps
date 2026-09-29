/**
 * Wire types for `/surveys/:id/record`, `/surveys` list rows and child resources.
 * Enum unions mirror `packages/database/prisma/schema.prisma`; Prisma Decimal columns arrive as strings.
 */

export const SURVEY_STATUSES = ["DRAFT", "IN_PROGRESS", "SUBMITTED", "APPROVED", "REJECTED", "REOPENED"] as const
export type SurveyStatus = (typeof SURVEY_STATUSES)[number]

export const QC_STATUSES = ["PENDING", "APPROVED", "REJECTED"] as const
export type QcStatus = (typeof QC_STATUSES)[number]

export const OWNERSHIP_TYPES = [
  "INDIVIDUAL",
  "JOINT",
  "LIMITED_COMPANY_FIRM",
  "TRUST_SOCIETY",
  "RELIGIOUS_BODY",
  "STATE_GOVERNMENT_BODY",
  "CENTRAL_GOVERNMENT_BODY",
  "MUNICIPAL_COUNCIL_TOWN_PANCHAYAT",
  "LEASE_PROPERTY",
] as const
export type OwnershipType = (typeof OWNERSHIP_TYPES)[number]

export const PROPERTY_USES = ["RESIDENTIAL", "COMMERCIAL", "OPEN_LAND", "RELIGIOUS_PROPERTY", "MIX_PROPERTY"] as const
export type PropertyUse = (typeof PROPERTY_USES)[number]

export const PROPERTY_TYPES = [
  "RESIDENTIAL_SELF",
  "RESIDENTIAL_RENTED",
  "SHOP_BAKERY",
  "BANK_OFFICE",
  "SCHOOL_COLLEGE",
  "MALL_SHOWROOM",
  "PETROL_PUMP",
  "HOTEL_MARRIAGE_RESTAURANT",
  "HOSPITAL_NURSING_PATHOLOGY",
  "GODOWN",
  "CENTRAL_GOVERNMENT",
  "STATE_GOVERNMENT",
  "INDUSTRY",
  "COLD_STORE",
  "OPEN",
  "AGRICULTURE",
  "OPEN_LAND_GODOWN",
  "MANDIR",
  "MASJID",
  "TRUST_DHARAMSHALA",
  "SHAMSHAN_KABRISTAN",
  "GURUDWARA_CHURCH",
  "RESIDENTIAL_AND_COMMERCIAL",
] as const
export type PropertyType = (typeof PROPERTY_TYPES)[number]

export const SITUATIONS = ["MAIN_MARKET", "MAIN_ROAD", "INTERIOR"] as const
export type Situation = (typeof SITUATIONS)[number]

export const ROAD_TYPES = ["RCC", "DAMBAR", "KACCHA"] as const
export type RoadType = (typeof ROAD_TYPES)[number]

export const TAX_RATE_ZONES = ["BELOW_9M", "METER_9_TO_12", "METER_12_TO_24", "ABOVE_24M"] as const
export type TaxRateZone = (typeof TAX_RATE_ZONES)[number]

export const ASSESSMENT_YEARS = ["AY_2025_2026", "AY_2026_2027"] as const
export type AssessmentYear = (typeof ASSESSMENT_YEARS)[number]

export const WATER_CONNECTIONS = ["YES", "NO", "PARTIAL"] as const
export type WaterConnection = (typeof WATER_CONNECTIONS)[number]

export const SOURCES_OF_WATER = ["GOVERNMENT_TAP", "DUG_WELL", "BOREWELL", "OTHER"] as const
export type SourceOfWater = (typeof SOURCES_OF_WATER)[number]

export const SANITATION_TYPES = ["SEWER_SYSTEM", "SEPTIC_TANK", "SURFACE_DRAIN", "NO_TOILET", "OTHER"] as const
export type SanitationType = (typeof SANITATION_TYPES)[number]

export const FLOOR_POSITIONS = [
  "BASEMENT",
  "GROUND_FLOOR",
  "FIRST_FLOOR",
  "SECOND_FLOOR",
  "THIRD_FLOOR",
  "FOURTH_FLOOR",
  "FIFTH_FLOOR",
  "SIXTH_FLOOR",
  "OPEN_LAND",
] as const
export type FloorPosition = (typeof FLOOR_POSITIONS)[number]

export const USAGE_FACTORS = [
  "RESIDENTIAL",
  "COMMERCIAL",
  "MIXED",
  "AGRICULTURE",
  "GODOWN",
  "OPEN_LAND",
  "UNDER_CONSTRUCTION",
] as const
export type UsageFactor = (typeof USAGE_FACTORS)[number]

export const USAGE_TYPES = ["SELF_OCCUPIED", "RENTED"] as const
export type UsageType = (typeof USAGE_TYPES)[number]

export const CONSTRUCTION_TYPES = [
  "PAKKA_BUILDING_WITH_RCC_ROOF",
  "TIN_SHED",
  "OPEN_LAND",
  "UNDER_CONSTRUCTION",
  "KACCHA_BUILDING",
] as const
export type ConstructionType = (typeof CONSTRUCTION_TYPES)[number]

export const PHOTO_TYPES = ["FRONT", "SIDE", "INSIDE", "DOCUMENT"] as const
export type PhotoType = (typeof PHOTO_TYPES)[number]

export type DecimalWire = string | number | null

export type SurveyFloor = {
  id: string
  surveyId: string
  floorPosition: FloorPosition
  usageFactor: UsageFactor
  usageType: UsageType | null
  constructionType: ConstructionType
  areaSqFt: DecimalWire
}

export type SurveyCoOwner = {
  id: string
  surveyId: string
  ownerIndex: number
  name: string
  fatherOrHusbandName: string | null
  mobile: string | null
}

export type SurveyPhoto = {
  id: string
  surveyId: string
  photoType: PhotoType
  objectKey: string | null
  capturedAt: string | null
  createdAt: string
}

export type QcRemarkThreadItem = {
  id: string
  body: string
  section: string | null
  field: string | null
  reason: string | null
  resolvedAt: string | null
  createdAt: string
  author: { id: string; fullName: string } | null
}

/** Survey columns the field wizard edits through `PATCH /surveys/:id`. */
export type SurveyEditableFields = {
  propertyId: string
  parcelNumber: string | null
  unitSubNo: string | null
  propertyIdOld: string | null
  respondentName: string | null
  relationshipWithOwner: string | null
  mobileNumber: string | null
  alternateMobile: string | null
  familySize: number | null
  houseDoorNo: string | null
  locality: string | null
  colony: string | null
  city: string | null
  pinCode: string | null
  ownershipType: OwnershipType | null
  propertyUse: PropertyUse | null
  propertyType: PropertyType | null
  situation: Situation | null
  roadType: RoadType | null
  taxRateZone: TaxRateZone | null
  assessmentYear: AssessmentYear
  plotAreaSqFt: DecimalWire
  plinthAreaSqFt: DecimalWire
  waterConnection: WaterConnection | null
  sourceOfWater: SourceOfWater | null
  sanitationType: SanitationType | null
  solidWasteCollection: boolean | null
  latitude: DecimalWire
  longitude: DecimalWire
  gpsAccuracyMeters: DecimalWire
  capturedAt: string | null
}

export type SurveyRecord = SurveyEditableFields & {
  id: string
  stateId: string
  districtId: string
  ulbId: string
  wardId: string
  createdById: string
  assignedToId: string | null
  surveyStatus: SurveyStatus
  qcStatus: QcStatus
  serverVersion: number
  qcRemarks: string | null
  submittedAt: string | null
  rejectedAt: string | null
  approvedAt: string | null
  createdAt: string
  updatedAt: string
  floors: SurveyFloor[]
  coOwners: SurveyCoOwner[]
  photos: SurveyPhoto[]
  qcRemarkThread?: QcRemarkThreadItem[]
  /** Present on the record endpoint; used for Property ID preview (same as Nest). */
  ulbCode?: string | null
  wardNumber?: string | null
  ward: { id: string; wardName: string; wardNumber: string; kind?: string | null } | null
  originalWard?: { wardNumber?: string | null } | null
  ulb: { id: string; name: string; code: string | null } | null
  district: { id: string; name: string } | null
  assignedTo: { id: string; fullName: string } | null
}

export const DECIMAL_FIELDS = [
  "plotAreaSqFt",
  "plinthAreaSqFt",
  "latitude",
  "longitude",
  "gpsAccuracyMeters",
] as const satisfies readonly (keyof SurveyEditableFields)[]
export type DecimalField = (typeof DECIMAL_FIELDS)[number]

/** Body for `PATCH /surveys/:id`: only changed keys, decimals as numbers. */
export type SurveyPatch = Partial<Omit<SurveyEditableFields, DecimalField>> &
  Partial<Record<DecimalField, number | null>> & { gpsSource?: "DEVICE" }

export type CursorPage<T> = {
  items: T[]
  meta: { limit: number; nextCursor: string | null }
}

export type BucketTotals = {
  fieldDraft: number
  pendingQc: number
  approved: number
  returned: number
  rework: number
  total: number
}

export type FieldMetrics = {
  scope: "self" | "team"
  todayStart: string
  totals: BucketTotals & { createdToday: number; submittedToday: number; resubmitted: number }
  wards: {
    wardId: string
    wardNumber: string | null
    wardName: string | null
    ulbName: string | null
    totals: BucketTotals
  }[]
  surveyors: {
    userId: string
    fullName: string
    wards: string[]
    totals: BucketTotals
    createdToday: number
    submittedToday: number
    lastActivityAt: string | null
  }[]
  assignedSurveyorCount: number | null
  activeSurveyorCount: number | null
}

export type WardOption = { id: string; wardNumber: string; wardName: string; ulbId: string }
