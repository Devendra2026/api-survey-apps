export type FloorAssessmentRow = {
  sno: number
  floorLabel: string
  usageTypeLabel: string
  usageFactorLabel: string
  constructionLabel: string
  areaSqFt: number
  annualRate: number
  usageMult: number
  alv: number
  assessableAlv: number
  tax: number
}

export type DemandNoticeAssessment = {
  floorRows: FloorAssessmentRow[]
  totalArea: number
  totalAlv: number
  totalAssessableAlv: number
  assessablePct: number
  propertyTaxPct: number
  waterTaxPct: number
  drainageTaxPct: number
  penaltyPct: number
  propertyTax: number
  waterTax: number
  drainageTax: number
  penalty: number
  totalAnnualDemand: number
  annualBaseRate: number | null
  rateMissing: boolean
  rateMissingReason: string | null
}

export type DemandNoticeOffice = {
  headerLine1: string
  headerLine2: string
  ulbName: string
  districtName: string
  stateName: string
  hindiOffice: string
}

export type DemandNoticeDocument = {
  surveyId: string
  propertyId: string
  assessmentYear: string
  assessmentYearLabel: string
  noticeDate: string
  ownerName: string
  fatherName: string
  mobileNo: string
  oldHouseNo: string
  address: string
  taxZoneLabel: string
  wardLabel: string
  gisParcel: string
  propertyUseLabel: string
  latitude: number | null
  longitude: number | null
  frontPhotoUrl: string | null
  sidePhotoUrl: string | null
  office: DemandNoticeOffice
  assessment: DemandNoticeAssessment
  legalHindi: string
  legalEnglish: string
}

export type DemandNoticeRegisterRow = {
  surveyId: string
  propertyId: string
  wardId: string
  wardNumber: string
  ownerName: string
  assessmentYear: string
  assessmentYearLabel: string
  totalDemand: number | null
  rateMissing: boolean
  rateMissingReason: string | null
  approvedAt: string | null
}

export function formatInr(amount: number): string {
  return `₹ ${amount.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export function pctLabel(pct: number): string {
  const n = Number.isInteger(pct) ? String(pct) : pct.toFixed(1).replace(/\.0$/, "")
  return `${n}%`
}
