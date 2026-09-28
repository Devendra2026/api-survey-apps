import type { PhotoType, SurveyEditableFields } from "../types.ts"

export const STEP_IDS = [
  "start",
  "property",
  "owner",
  "address",
  "taxation",
  "area",
  "services",
  "gps",
  "photos",
] as const
export type StepId = (typeof STEP_IDS)[number]

export const STEP_TITLES: Record<StepId, string> = {
  start: "Survey",
  property: "Property",
  owner: "Owner",
  address: "Address",
  taxation: "Taxation",
  area: "Area",
  services: "Services",
  gps: "GPS",
  photos: "Photos",
}

/** Merged local + server view the wizard evaluates. */
export type SurveySnapshot = SurveyEditableFields & {
  wardLabel: string | null
  floorCount: number
  coOwnerCount: number
  uploadedPhotoTypes: PhotoType[]
}

export type Requirement = { step: StepId; message: string }

function filled(value: unknown): boolean {
  if (value === null || value === undefined) return false
  if (typeof value === "string") return value.trim().length > 0
  return true
}

/**
 * Mirrors `SurveysService.submit()` exactly. Adding a rule here without adding it on the API
 * (or vice versa) would make the mobile checklist disagree with the server.
 */
export function submitRequirements(s: SurveySnapshot): Requirement[] {
  const out: Requirement[] = []
  if (!filled(s.propertyId)) out.push({ step: "property", message: "Property ID required" })
  if (!filled(s.ownershipType)) out.push({ step: "property", message: "Ownership type required" })
  if (!filled(s.propertyUse)) out.push({ step: "property", message: "Property use required" })
  if (!filled(s.propertyType)) out.push({ step: "property", message: "Property type required" })
  if (s.ownershipType === "JOINT" && s.coOwnerCount === 0) {
    out.push({ step: "owner", message: "Joint ownership needs at least one co-owner" })
  }
  if (s.floorCount === 0) out.push({ step: "area", message: "Add at least one floor" })
  if (!filled(s.latitude) || !filled(s.longitude)) {
    out.push({ step: "gps", message: "GPS coordinates required" })
  }
  if (!s.uploadedPhotoTypes.includes("FRONT")) {
    out.push({ step: "photos", message: "Front view photo required" })
  }
  return out
}

const STEP_FIELDS: Record<Exclude<StepId, "gps" | "photos">, (keyof SurveySnapshot)[]> = {
  start: ["wardLabel", "propertyId"],
  property: ["parcelNumber", "unitSubNo", "propertyIdOld", "ownershipType", "propertyUse", "propertyType"],
  owner: ["respondentName", "relationshipWithOwner", "mobileNumber", "alternateMobile", "familySize"],
  address: ["houseDoorNo", "locality", "colony", "city", "pinCode"],
  taxation: ["situation", "roadType", "taxRateZone", "assessmentYear"],
  area: ["plotAreaSqFt", "plinthAreaSqFt", "floorCount"],
  services: ["waterConnection", "sourceOfWater", "sanitationType", "solidWasteCollection"],
}

export type StepProgress = { filled: number; total: number; missing: string[] }

/** Informational completeness per section; only `missing` (from submit rules) blocks submission. */
export function stepProgress(s: SurveySnapshot): Record<StepId, StepProgress> {
  const requirements = submitRequirements(s)
  const missingFor = (step: StepId) => requirements.filter((r) => r.step === step).map((r) => r.message)

  const result = {} as Record<StepId, StepProgress>
  for (const step of STEP_IDS) {
    if (step === "gps") {
      const captured = filled(s.latitude) && filled(s.longitude)
      result.gps = { filled: captured ? 1 : 0, total: 1, missing: missingFor("gps") }
      continue
    }
    if (step === "photos") {
      const distinct = new Set(s.uploadedPhotoTypes)
      result.photos = { filled: distinct.size, total: 4, missing: missingFor("photos") }
      continue
    }
    const fields = STEP_FIELDS[step]
    const count = fields.filter((key) => {
      const value = s[key]
      return key === "floorCount" ? typeof value === "number" && value > 0 : filled(value)
    }).length
    result[step] = { filled: count, total: fields.length, missing: missingFor(step) }
  }
  return result
}

const SERVER_MESSAGE_STEPS: [RegExp, StepId][] = [
  [/floor/i, "area"],
  [/photo/i, "photos"],
  [/gps|latitude|longitude/i, "gps"],
  [/co-owner|joint/i, "owner"],
  [/property/i, "property"],
]

/** Routes an API submit error (one of the `SurveysService.submit` messages) to the step that fixes it. */
export function stepForServerMessage(message: string): StepId | null {
  for (const [pattern, step] of SERVER_MESSAGE_STEPS) {
    if (pattern.test(message)) return step
  }
  return null
}

export function isStepId(value: string): value is StepId {
  return STEP_IDS.some((step) => step === value)
}

/** QC remark `section` values are step ids; anything else falls back to message matching. */
export function stepForRemarkSection(section: string | null, body: string): StepId | null {
  if (section && isStepId(section)) return section
  return stepForServerMessage(body)
}
