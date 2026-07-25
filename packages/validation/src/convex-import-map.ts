/**
 * Maps Convex Excel export labels/slugs → Prisma enum values.
 */

function norm(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[\s/-]+/g, "_")
}

function upperSnake(value: string): string {
  return value
    .trim()
    .replace(/([a-z])([A-Z])/g, "$1_$2")
    .replace(/[\s/-]+/g, "_")
    .toUpperCase()
}

const OWNERSHIP: Record<string, string> = {
  individual: "INDIVIDUAL",
  joint: "JOINT",
  limited_company_firm: "LIMITED_COMPANY_FIRM",
  trust_society: "TRUST_SOCIETY",
  religious_body: "RELIGIOUS_BODY",
  state_government_body: "STATE_GOVERNMENT_BODY",
  central_government_body: "CENTRAL_GOVERNMENT_BODY",
  municipal_council_town_panchayat: "MUNICIPAL_COUNCIL_TOWN_PANCHAYAT",
  lease_property: "LEASE_PROPERTY",
  individual_single_joint: "JOINT",
  "individual_(single/joint)": "JOINT",
}

const PROPERTY_USE: Record<string, string> = {
  residential: "RESIDENTIAL",
  commercial: "COMMERCIAL",
  open_land: "OPEN_LAND",
  religious_property: "RELIGIOUS_PROPERTY",
  mix_property: "MIX_PROPERTY",
  mixed: "MIX_PROPERTY",
  non_residential_rented: "COMMERCIAL",
  residential_self: "RESIDENTIAL",
  residential_rented: "RESIDENTIAL",
}

const PROPERTY_TYPE: Record<string, string> = {
  residential_self: "RESIDENTIAL_SELF",
  residential_rented: "RESIDENTIAL_RENTED",
  shop_bakery: "SHOP_BAKERY",
  bank_office: "BANK_OFFICE",
  school_college: "SCHOOL_COLLEGE",
  mall_showroom: "MALL_SHOWROOM",
  petrol_pump: "PETROL_PUMP",
  hotel_marriage_restaurant: "HOTEL_MARRIAGE_RESTAURANT",
  hospital_nursing_pathology: "HOSPITAL_NURSING_PATHOLOGY",
  godown: "GODOWN",
  central_government: "CENTRAL_GOVERNMENT",
  state_government: "STATE_GOVERNMENT",
  industry: "INDUSTRY",
  cold_store: "COLD_STORE",
  open: "OPEN",
  open_land: "OPEN",
  agriculture: "AGRICULTURE",
  open_land_godown: "OPEN_LAND_GODOWN",
  mandir: "MANDIR",
  masjid: "MASJID",
  trust_dharamshala: "TRUST_DHARAMSHALA",
  shamshan_kabristan: "SHAMSHAN_KABRISTAN",
  gurudwara_church: "GURUDWARA_CHURCH",
  residential_and_commercial: "RESIDENTIAL_AND_COMMERCIAL",
  commercial: "SHOP_BAKERY",
  residential: "RESIDENTIAL_SELF",
}

const SITUATION: Record<string, string> = {
  main_market: "MAIN_MARKET",
  main_road: "MAIN_ROAD",
  interior: "INTERIOR",
}

const ROAD: Record<string, string> = {
  rcc: "RCC",
  dambar: "DAMBAR",
  damber: "DAMBAR",
  kaccha: "KACCHA",
  katcha: "KACCHA",
}

const TAX_ZONE: Record<string, string> = {
  below_9m: "BELOW_9M",
  meter_9_to_12: "METER_9_TO_12",
  meter_12_to_24: "METER_12_TO_24",
  above_24m: "ABOVE_24M",
  rate_zone_1_0_meters_and_upto_12_meters: "METER_9_TO_12",
  rate_zone_1: "METER_9_TO_12",
}

const WATER: Record<string, string> = {
  yes: "YES",
  no: "NO",
  partial: "PARTIAL",
}

const WATER_SOURCE: Record<string, string> = {
  government_tap: "GOVERNMENT_TAP",
  dug_well: "DUG_WELL",
  borewell: "BOREWELL",
  other: "OTHER",
}

const SANITATION: Record<string, string> = {
  sewer_system: "SEWER_SYSTEM",
  septic_tank: "SEPTIC_TANK",
  surface_drain: "SURFACE_DRAIN",
  no_toilet: "NO_TOILET",
  other: "OTHER",
  connected_to_specific_tank: "SEPTIC_TANK",
  connected_to_surface_drains: "SURFACE_DRAIN",
}

const FLOOR_POSITION: Record<string, string> = {
  basement: "BASEMENT",
  "-1": "BASEMENT",
  ground: "GROUND_FLOOR",
  ground_floor: "GROUND_FLOOR",
  gf: "GROUND_FLOOR",
  "0": "GROUND_FLOOR",
  first: "FIRST_FLOOR",
  first_floor: "FIRST_FLOOR",
  "1": "FIRST_FLOOR",
  second: "SECOND_FLOOR",
  second_floor: "SECOND_FLOOR",
  "2": "SECOND_FLOOR",
  third: "THIRD_FLOOR",
  third_floor: "THIRD_FLOOR",
  "3": "THIRD_FLOOR",
  fourth: "FOURTH_FLOOR",
  fourth_floor: "FOURTH_FLOOR",
  "4": "FOURTH_FLOOR",
  fifth: "FIFTH_FLOOR_PLUS",
  fifth_floor: "FIFTH_FLOOR_PLUS",
  fifth_floor_plus: "FIFTH_FLOOR_PLUS",
  "5": "FIFTH_FLOOR_PLUS",
  open_land: "OPEN_LAND",
  open_land_plot: "OPEN_LAND",
}

const FLOOR_POSITION_BY_INDEX = [
  "GROUND_FLOOR",
  "FIRST_FLOOR",
  "SECOND_FLOOR",
  "THIRD_FLOOR",
  "FOURTH_FLOOR",
  "FIFTH_FLOOR_PLUS",
] as const

const USAGE_FACTOR: Record<string, string> = {
  residential: "RESIDENTIAL",
  commercial: "COMMERCIAL",
  mixed: "MIXED",
  agriculture: "AGRICULTURE",
  godown: "GODOWN",
  open_land: "OPEN_LAND",
  open_land_under_construction: "UNDER_CONSTRUCTION",
  under_construction: "UNDER_CONSTRUCTION",
}

const USAGE_TYPE: Record<string, string> = {
  self_occupied: "SELF_OCCUPIED",
  rented: "RENTED",
}

const CONSTRUCTION: Record<string, string> = {
  pakka_building_with_rcc_roof: "PAKKA_BUILDING_WITH_RCC_ROOF",
  pakka_rcc_rb: "PAKKA_BUILDING_WITH_RCC_ROOF",
  tin_shed: "TIN_SHED",
  teen: "TIN_SHED",
  open_land: "OPEN_LAND",
  open_land_plot: "OPEN_LAND",
  under_construction: "UNDER_CONSTRUCTION",
  kaccha_building: "KACCHA_BUILDING",
  katcha: "KACCHA_BUILDING",
}

const PHOTO_TYPE: Record<string, string> = {
  front: "FRONT",
  side: "SIDE",
  inside: "INSIDE",
  document: "DOCUMENT",
}

const SURVEY_STATUS: Record<string, string> = {
  draft: "DRAFT",
  in_progress: "IN_PROGRESS",
  submitted: "SUBMITTED",
  approved: "APPROVED",
  rejected: "REJECTED",
  reopened: "REOPENED",
  completed: "APPROVED",
}

const QC_STATUS: Record<string, string> = {
  pending: "PENDING",
  pending_qc: "PENDING",
  approved: "APPROVED",
  rejected: "REJECTED",
}

const GPS_SOURCE: Record<string, string> = {
  device: "DEVICE",
  manual: "MANUAL",
  import: "IMPORT",
}

function mapEnum(table: Record<string, string>, raw: string | undefined | null): string | undefined {
  if (raw == null || String(raw).trim() === "") return undefined
  const key = norm(String(raw))
  if (table[key]) return table[key]
  const snake = upperSnake(String(raw))
  const values = new Set(Object.values(table))
  if (values.has(snake)) return snake
  return undefined
}

export function mapOwnershipType(raw?: string | null) {
  return mapEnum(OWNERSHIP, raw)
}
export function mapPropertyUse(raw?: string | null) {
  return mapEnum(PROPERTY_USE, raw)
}
export function mapPropertyType(raw?: string | null) {
  return mapEnum(PROPERTY_TYPE, raw)
}
export function mapSituation(raw?: string | null) {
  return mapEnum(SITUATION, raw)
}
export function mapRoadType(raw?: string | null) {
  return mapEnum(ROAD, raw)
}
export function mapTaxRateZone(raw?: string | null) {
  return mapEnum(TAX_ZONE, raw)
}
export function mapWaterConnection(raw?: string | null) {
  return mapEnum(WATER, raw)
}
export function mapSourceOfWater(raw?: string | null) {
  return mapEnum(WATER_SOURCE, raw)
}
export function mapSanitationType(raw?: string | null) {
  return mapEnum(SANITATION, raw)
}
export function mapFloorPosition(raw?: string | null) {
  return mapEnum(FLOOR_POSITION, raw)
}

/** Map 0-based floor index → Prisma FloorPosition (for Convex numeric positions). */
export function mapFloorPositionByIndex(index: number | null | undefined): string | undefined {
  if (index == null || !Number.isFinite(index)) return undefined
  const i = Math.trunc(index)
  if (i < 0) return "BASEMENT"
  if (i >= FLOOR_POSITION_BY_INDEX.length) return "FIFTH_FLOOR_PLUS"
  return FLOOR_POSITION_BY_INDEX[i]
}
export function mapUsageFactor(raw?: string | null) {
  return mapEnum(USAGE_FACTOR, raw)
}
export function mapUsageType(raw?: string | null) {
  return mapEnum(USAGE_TYPE, raw)
}
export function mapConstructionType(raw?: string | null) {
  return mapEnum(CONSTRUCTION, raw)
}
export function mapPhotoType(raw?: string | null) {
  return mapEnum(PHOTO_TYPE, raw)
}
export function mapSurveyStatus(raw?: string | null) {
  return mapEnum(SURVEY_STATUS, raw)
}
export function mapQcStatus(raw?: string | null) {
  return mapEnum(QC_STATUS, raw)
}
export function mapGpsSource(raw?: string | null) {
  return mapEnum(GPS_SOURCE, raw)
}

export function mapAssessmentYear(raw?: string | null): string | undefined {
  if (raw == null || String(raw).trim() === "") return undefined
  const s = String(raw).trim()
  if (s === "2025-2026" || s === "2025-26" || s === "AY_2025_2026") return "AY_2025_2026"
  if (s === "2026-2027" || s === "2026-27" || s === "AY_2026_2027") return "AY_2026_2027"
  if (s === "2024-2025" || s === "2024-25") return "AY_2025_2026"
  // "2026-2027", "AY 2026-27", etc.
  const compact = s.replace(/\s+/g, "").toUpperCase()
  if (compact.includes("2025") && compact.includes("2026")) return "AY_2025_2026"
  if (compact.includes("2026") && compact.includes("2027")) return "AY_2026_2027"
  if (/^2025-?26$/.test(compact.replace("AY_", ""))) return "AY_2025_2026"
  if (/^2026-?27$/.test(compact.replace("AY_", ""))) return "AY_2026_2027"
  return undefined
}

export function parseYn(raw?: string | null): boolean | undefined {
  if (raw == null || String(raw).trim() === "") return undefined
  const s = String(raw).trim().toLowerCase()
  if (["yes", "y", "true", "1"].includes(s)) return true
  if (["no", "n", "false", "0"].includes(s)) return false
  return undefined
}

export function parseNumber(raw?: string | number | null): number | undefined {
  if (raw == null || raw === "") return undefined
  const n = typeof raw === "number" ? raw : Number(String(raw).replace(/,/g, ""))
  return Number.isFinite(n) ? n : undefined
}

export function sqFtToSqMeter(sqFt: number | undefined): number | undefined {
  if (sqFt == null) return undefined
  return Math.round(sqFt * 0.092903 * 10000) / 10000
}

/** Convex full-export sheet names */
export const CONVEX_SHEETS = {
  surveys: "Surveys",
  coOwners: "CoOwners",
  floors: "Floors",
  photos: "Photos",
  guide: "Guide",
} as const

export const SURVEY_EXPORT_COLUMNS = [
  "Survey ID",
  "Local ID",
  "Property ID",
  "District ID",
  "District",
  "Municipality ID",
  "ULB / Local Body",
  "ULB Code",
  "Ward Number",
  "Sector / Zone",
  "Parcel Number",
  "Unit / Sub-No",
  "Property ID (Old)",
  "Constructed Year",
  "Slum Area",
  "Respondent Name",
  "Relationship with Owner",
  "Family Size",
  "Mobile Number",
  "Alt Mobile",
  "House / Door No",
  "Locality / Landmark",
  "Colony / Society",
  "City",
  "Pin Code",
  "Assessment Year",
  "Ownership Type",
  "Property Use",
  "Property Type",
  "Situation",
  "Road Type",
  "Tax Rate Zone",
  "Plot Area SqFt",
  "Plot Area SqMeter",
  "Plinth Area SqFt",
  "Plinth Area SqMeter",
  "Total Built Up Area SqFt",
  "Total Built Up Area SqMeter",
  "Water Connection?",
  "Source of Water",
  "Sanitation Type",
  "Door-to-door Waste Collection",
  "Electricity Consumer No",
  "GPS Latitude",
  "GPS Longitude",
  "GPS Accuracy (m)",
  "GPS Captured At",
  "GPS Provider",
  "GPS Mock Location",
  "Survey Status",
  "QC Status",
  "Surveyor",
  "Surveyor Email",
  "Server Version",
  "Client Updated At",
  "Submitted At",
  "Created At",
] as const
