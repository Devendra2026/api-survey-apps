/**
 * Property ID helpers — mirrors legacy Convex propertyId.ts
 * Format: {ULB 6}-{Ward 3}-{Parcel 5}-{Unit 3}-{UseLetter}
 * Example: 801262-001-00004-001-R
 */

export const PROPERTY_ID_PATTERN = /^\d{6}-\d{3}-\d{5}-\d{3}-[A-Z]$/
export const LEGACY_PROPERTY_ID_PATTERN = /^\d{6}-\d{3}-\d{5}-[A-Z]$/

export const PROPERTY_USE_CODES: Record<string, string> = {
  residential: "R",
  RESIDENTIAL: "R",
  commercial: "C",
  COMMERCIAL: "C",
  open_land: "P",
  OPEN_LAND: "P",
  religious_property: "H",
  RELIGIOUS_PROPERTY: "H",
  mix_property: "M",
  MIX_PROPERTY: "M",
  agricultural_land: "A",
  AGRICULTURE: "A",
}

export function padUlbCode(code: string): string {
  const digits = code.replace(/\D/g, "")
  if (!digits) return ""
  return digits.padStart(6, "0").slice(-6)
}

export function padWardNo(wardNo: string): string {
  const digits = wardNo.replace(/\D/g, "")
  if (!digits) return ""
  return digits.padStart(3, "0").slice(-3)
}

export function padParcelNo(parcelNo: string): string {
  const digits = parcelNo.replace(/\D/g, "")
  if (!digits) return ""
  return digits.padStart(5, "0").slice(-5)
}

export function padUnitNo(unitNo: string): string {
  const digits = unitNo.replace(/\D/g, "")
  if (!digits) return ""
  return digits.padStart(3, "0").slice(-3)
}

export function normalizeParcelKey(parcelNo: string): string {
  const digits = parcelNo.replace(/\D/g, "")
  if (!digits) return parcelNo.trim()
  const n = Number.parseInt(digits, 10)
  return Number.isNaN(n) ? parcelNo.trim() : String(n)
}

export function propertyUseCode(propertyUse: string | undefined): string {
  if (!propertyUse) return ""
  return PROPERTY_USE_CODES[propertyUse] ?? propertyUse.charAt(0).toUpperCase()
}

export function formatPropertyId(parts: {
  ulbCode: string
  wardNo: string
  parcelNo: string
  unitNo: string
  propertyUse: string
}): string | undefined {
  const ulb = padUlbCode(parts.ulbCode)
  const ward = padWardNo(parts.wardNo)
  const parcel = padParcelNo(parts.parcelNo)
  const unit = padUnitNo(parts.unitNo)
  const use = propertyUseCode(parts.propertyUse)
  if (!ulb || !ward || !parcel || !unit || !use) return undefined
  return `${ulb}-${ward}-${parcel}-${unit}-${use}`
}

export function isNewPropertyIdFormat(id: string): boolean {
  return PROPERTY_ID_PATTERN.test(id.trim().toUpperCase())
}

export function comparePropertyIds(a?: string, b?: string): number {
  const ka = (a ?? "").trim().toUpperCase()
  const kb = (b ?? "").trim().toUpperCase()
  if (!ka && !kb) return 0
  if (!ka) return 1
  if (!kb) return -1
  return ka.localeCompare(kb, undefined, { numeric: true })
}
