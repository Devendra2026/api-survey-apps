/** Convex photo slots — source of truth for ETL image identity. */
export const PHOTO_SLOTS = ["front", "inside", "side", "document"] as const
export type PhotoSlot = (typeof PHOTO_SLOTS)[number]

export type MigrationStatus = "PENDING" | "IN_PROGRESS" | "COMPLETED" | "SKIPPED" | "FAILED"

export type EtlStage = "EXTRACT" | "TRANSFORM" | "DOWNLOAD" | "UPLOAD" | "LOAD" | "VALIDATE" | "SKIP"

export type PhotoTypeEnum = "FRONT" | "SIDE" | "INSIDE" | "DOCUMENT"

export const SLOT_TO_PHOTO_TYPE: Record<PhotoSlot, PhotoTypeEnum> = {
  front: "FRONT",
  side: "SIDE",
  inside: "INSIDE",
  document: "DOCUMENT",
}

export interface ConvexGps {
  latitude: number
  longitude: number
  accuracyMeters: number
  capturedAt: number
  provider?: string
  isMockLocation?: boolean
}

export interface ConvexOwner {
  name?: string
  fatherOrHusbandName?: string
  mobileNo?: string
  altMobileNo?: string
}

export interface ConvexFloor {
  _id: string
  clientFloorId: string
  position: number
  floorName: string
  usageFactor?: string
  usageType: string
  constructionType: string
  isOccupied: boolean
  areaSqft: number
}

export interface ConvexPhoto {
  slot: PhotoSlot
  storageId?: string
  sizeKb: number
  width?: number
  height?: number
  capturedAt: number
  url: string | null
}

export interface ConvexSurveyBundle {
  _id: string
  _creationTime: number
  localId: string
  surveyorId: string
  surveyorClerkId?: string | null
  surveyorEmail?: string | null
  surveyorName?: string | null
  districtId: string
  districtCode: string
  districtName: string
  municipalityId: string
  municipalityCode: string
  municipalityName: string
  wardNo: string
  status: string
  qcStatus: string
  serverVersion: number
  clientUpdatedAt: number
  submittedAt?: number
  completionPct?: number
  sectorNo?: string
  oldPropertyNo?: string
  propertyId?: string
  parcelNo: string
  unitNo: string
  constructedYear?: number
  isSlum: boolean
  respondentName?: string
  relationship?: string
  owners?: ConvexOwner[]
  familySize?: number
  mobileNo: string
  altMobileNo?: string
  houseNo?: string
  locality: string
  colonyName: string
  city: string
  pinCode: string
  assessmentYear: string
  ownershipType: string
  propertyType: string
  propertyUse: string
  situation: string
  roadType: string
  taxRateZone: string
  plotSqft: number
  plinthSqft: number
  municipalWaterConnection: boolean
  waterSource: string
  sanitationType: string
  municipalWasteCollection?: boolean
  electricityNo?: string
  gps?: ConvexGps
  floors: ConvexFloor[]
  photos: ConvexPhoto[]
}

export interface ListSurveyIdsResult {
  ids: string[]
  continueCursor: string
  isDone: boolean
}

export interface GeoCatalogIds {
  stateId: string
  districtId: string
  ulbId: string
  wardId: string
  districtCode: string
  wardNo: string
}

export interface MappedCoOwner {
  ownerIndex: number
  name: string
  fatherOrHusbandName?: string
  mobile?: string
  alternateMobile?: string
}

export interface MappedFloor {
  clientFloorId?: string
  floorPosition: string
  usageFactor?: string
  usageType?: string
  constructionType?: string
  occupancy?: string
  areaSqFt?: number
  position: number
}

export interface MappedPhotoPlan {
  slot: PhotoSlot
  photoType: PhotoTypeEnum
  sourceUrl: string
  objectKey: string
  width?: number
  height?: number
  sizeKb?: number
  capturedAt?: number
}

export interface MappedSurvey {
  legacySurveyId: string
  localId?: string
  propertyId: string
  propertyIdOld?: string
  parcelNumber?: string
  unitSubNo?: string
  sectorNo?: string
  constructedYear?: number
  isSlum: boolean
  wardNumber?: string
  ulbCode?: string
  districtName?: string
  respondentName?: string
  relationshipWithOwner?: string
  mobileNumber?: string
  alternateMobile?: string
  familySize?: number
  houseDoorNo?: string
  locality?: string
  colony?: string
  city?: string
  pinCode?: string
  ownershipType?: string
  propertyUse?: string
  propertyType?: string
  situation?: string
  roadType?: string
  taxRateZone?: string
  assessmentYear: string
  plotAreaSqFt?: number
  plotAreaSqMeter?: number
  plinthAreaSqFt?: number
  plinthAreaSqMeter?: number
  waterConnection?: string
  sourceOfWater?: string
  sanitationType?: string
  solidWasteCollection?: boolean
  electricityConsumerNo?: string
  latitude?: number
  longitude?: number
  gpsAccuracyMeters?: number
  gpsProvider?: string
  gpsMockLocation?: boolean
  gpsSource?: string
  capturedAt?: Date
  surveyStatus: string
  qcStatus: string
  serverVersion: number
  completionPct?: number
  clientUpdatedAt?: Date
  submittedAt?: Date
  stateId: string
  districtId: string
  ulbId: string
  wardId: string
  /** Nest district code used in object keys */
  districtCode: string
  createdById: string
  coOwners: MappedCoOwner[]
  floors: MappedFloor[]
  photos: MappedPhotoPlan[]
  checksum: string
  imagesExpected: number
}

export interface TransformContext {
  resolveGeo: (input: { districtCode: string; municipalityCode: string; wardNo: string }) => GeoCatalogIds | null
  resolveUserId: (input: { clerkId?: string | null; email?: string | null }) => string | null
  /** Fallback Nest user when surveyor cannot be resolved */
  systemUserId: string
}

export interface TransformSuccess {
  ok: true
  survey: MappedSurvey
  skip?: never
}

export interface TransformSkip {
  ok: true
  skip: true
  reason: string
  legacySurveyId: string
}

export interface TransformFailure {
  ok: false
  legacySurveyId: string
  stage: EtlStage
  error: string
}

export type TransformResult = TransformSuccess | TransformSkip | TransformFailure

export interface EtlJobStats {
  imported: number
  skipped: number
  duplicates: number
  failed: number
  imagesDownloaded: number
  imagesUploaded: number
  missingImages: number
  executionTimeMs: number
  avgSurveyMs: number
  surveysPerMinute: number
  [key: string]: number
}

export function emptyEtlJobStats(): EtlJobStats {
  return {
    imported: 0,
    skipped: 0,
    duplicates: 0,
    failed: 0,
    imagesDownloaded: 0,
    imagesUploaded: 0,
    missingImages: 0,
    executionTimeMs: 0,
    avgSurveyMs: 0,
    surveysPerMinute: 0,
  }
}

export const ALLOWED_IMAGE_MIME_TYPES = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
] as const

export const DEFAULT_MAX_IMAGE_BYTES = 15 * 1024 * 1024
export const DEFAULT_ETL_BATCH_SIZE = 100
export const DEFAULT_ETL_MAX_RETRIES = 5
/** Minutes without progress after which a QUEUED/RUNNING migration job is treated as abandoned. */
export const DEFAULT_ETL_STALE_JOB_MINUTES = 60
export const DEFAULT_IMAGE_CONCURRENCY = 4
export const ETL_PREFIX = "etah-images"
