export interface SurveyExportBundle {
  id: string
  propertyId: string
  localId?: string | null
  propertyIdOld?: string | null
  parcelNumber?: string | null
  unitSubNo?: string | null
  sectorNo?: string | null
  constructedYear?: number | null
  isSlum?: boolean | null
  wardNumber?: string | null
  respondentName?: string | null
  relationshipWithOwner?: string | null
  mobileNumber?: string | null
  alternateMobile?: string | null
  familySize?: number | null
  houseDoorNo?: string | null
  locality?: string | null
  colony?: string | null
  city?: string | null
  pinCode?: string | null
  assessmentYear: string
  ownershipType?: string | null
  propertyUse?: string | null
  propertyType?: string | null
  situation?: string | null
  roadType?: string | null
  taxRateZone?: string | null
  plotAreaSqFt?: Numeric | null
  plotAreaSqMeter?: Numeric | null
  plinthAreaSqFt?: Numeric | null
  plinthAreaSqMeter?: Numeric | null
  totalBuiltAreaSqFt?: Numeric | null
  totalBuiltAreaSqMeter?: Numeric | null
  waterConnection?: string | null
  sourceOfWater?: string | null
  sanitationType?: string | null
  solidWasteCollection?: boolean | null
  electricityConsumerNo?: string | null
  latitude?: Numeric | null
  longitude?: Numeric | null
  gpsAccuracyMeters?: Numeric | null
  capturedAt?: Date | null
  gpsProvider?: string | null
  gpsMockLocation?: boolean | null
  surveyStatus: string
  qcStatus: string
  serverVersion?: number | null
  clientUpdatedAt?: Date | null
  submittedAt?: Date | null
  approvedAt?: Date | null
  qcRemarks?: string | null
  /** Latest QC approver display name (from SurveyAudit). */
  qcApprovedByName?: string | null
  createdAt: Date
  createdBy?: Person | null
  assignedTo?: Person | null
  ward?: { wardName: string; wardNumber: string } | null
  ulb?: { name: string; code: string } | null
  district?: { name: string } | null
  coOwners: CoOwnerExportRow[]
  floors: FloorExportRow[]
  photos: PhotoExportRow[]
  /** Optional precomputed tax for QC Final rows. */
  taxSummary?: {
    propertyTax: number
    waterTax: number
    drainageTax: number
    penalty: number
    totalDemand: number
  } | null
}

export type Numeric = number | { toString(): string }

export interface Person {
  fullName: string
  email: string
}

export interface CoOwnerExportRow {
  ownerIndex?: number
  name: string
  fatherOrHusbandName?: string | null
  mobile?: string | null
  alternateMobile?: string | null
}

export interface FloorExportRow {
  clientFloorId?: string | null
  position?: number
  floorPosition: string
  usageFactor?: string | null
  usageType?: string | null
  constructionType?: string | null
  occupancy?: string | null
  areaSqFt?: Numeric | null
}

export interface PhotoExportRow {
  photoType: string
  url: string
  capturedAt?: Date | null
  sizeKB?: number | null
  width?: number | null
  height?: number | null
}
