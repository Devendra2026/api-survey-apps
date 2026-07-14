import { z } from "zod"

export const OwnershipTypeSchema = z.enum([
  "INDIVIDUAL",
  "JOINT",
  "LIMITED_COMPANY_FIRM",
  "TRUST_SOCIETY",
  "RELIGIOUS_BODY",
  "STATE_GOVERNMENT_BODY",
  "CENTRAL_GOVERNMENT_BODY",
  "MUNICIPAL_COUNCIL_TOWN_PANCHAYAT",
  "LEASE_PROPERTY",
])

export type OwnershipTypeDto = z.infer<typeof OwnershipTypeSchema>

export const PropertyTypeSchema = z.enum([
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
])

export type PropertyTypeDto = z.infer<typeof PropertyTypeSchema>

export const PropertyUseSchema = z.enum([
  "RESIDENTIAL",
  "COMMERCIAL",
  "OPEN_LAND",
  "RELIGIOUS_PROPERTY",
  "MIX_PROPERTY",
])

export type PropertyUseDto = z.infer<typeof PropertyUseSchema>

export const SituationSchema = z.enum(["MAIN_MARKET", "MAIN_ROAD", "INTERIOR"])

export type SituationDto = z.infer<typeof SituationSchema>

export const RoadTypeSchema = z.enum(["RCC", "DAMBAR", "KACCHA"])

export type RoadTypeDto = z.infer<typeof RoadTypeSchema>

export const TaxRateZoneSchema = z.enum(["BELOW_9M", "METER_9_TO_12", "METER_12_TO_24", "ABOVE_24M"])

export type TaxRateZoneDto = z.infer<typeof TaxRateZoneSchema>

export const AssessmentYearSchema = z.enum(["AY_2025_2026", "AY_2026_2027"])

export type AssessmentYearDto = z.infer<typeof AssessmentYearSchema>

export const SurveyStatusSchema = z.enum(["DRAFT", "IN_PROGRESS", "SUBMITTED", "APPROVED", "REJECTED", "REOPENED"])

export type SurveyStatusDto = z.infer<typeof SurveyStatusSchema>

export const QcStatusSchema = z.enum(["PENDING", "APPROVED", "REJECTED"])

export type QcStatusDto = z.infer<typeof QcStatusSchema>

export const PhotoTypeSchema = z.enum(["FRONT", "SIDE", "INSIDE", "DOCUMENT"])

export type PhotoTypeDto = z.infer<typeof PhotoTypeSchema>
