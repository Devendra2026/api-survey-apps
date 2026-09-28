/**
 * Structured QC correction items attached to a "return to surveyor" action.
 * Section ids match the mobile survey wizard steps so the surveyor can jump
 * straight to the step that needs fixing.
 */
export const QC_CORRECTION_SECTIONS = [
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
export type QcCorrectionSection = (typeof QC_CORRECTION_SECTIONS)[number]

export const QC_CORRECTION_SECTION_LABELS: Record<QcCorrectionSection, string> = {
  start: "Survey / Property ID",
  property: "Property details",
  owner: "Owner & co-owners",
  address: "Address",
  taxation: "Taxation",
  area: "Area & floors",
  services: "Services",
  gps: "GPS location",
  photos: "Photos",
}

export const QC_CORRECTION_REASONS = ["Incorrect", "Missing", "Unclear", "Mismatch with document", "Other"] as const

export const QC_CORRECTION_MAX_ITEMS = 20
export const QC_CORRECTION_FIELD_MAX = 120
export const QC_CORRECTION_REASON_MAX = 120
export const QC_CORRECTION_NOTE_MAX = 1000

export function isQcCorrectionSection(value: unknown): value is QcCorrectionSection {
  return typeof value === "string" && (QC_CORRECTION_SECTIONS as readonly string[]).includes(value)
}
