export type FloorAssessmentRowDto = {
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

export type DemandNoticeAssessmentDto = {
  floorRows: FloorAssessmentRowDto[]
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

export type DemandNoticeOfficeDto = {
  headerLine1: string
  headerLine2: string
  ulbName: string
  districtName: string
  stateName: string
  hindiOffice: string
}

export type DemandNoticeDocumentDto = {
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
  office: DemandNoticeOfficeDto
  assessment: DemandNoticeAssessmentDto
  legalHindi: string
  legalEnglish: string
}

export type DemandNoticeRegisterRowDto = {
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

export const DEMAND_NOTICE_LEGAL = {
  english:
    "Any objection to this assessment must be submitted in writing to the Executive Officer within 15 days from the date of this notice. Failure to do so will result in the demand being considered final and recoverable as arrears.",
  hindi:
    "इस मूल्यांकन पर कोई भी आपत्ति इस नोटिस की तिथि से 15 दिनों के भीतर अधिशासी अधिकारी को लिखित रूप में प्रस्तुत की जानी चाहिए। ऐसा न करने पर मांग को अंतिम मानकर बकाया के रूप में वसूली जाएगी।",
} as const
