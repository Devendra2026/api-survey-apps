/**
 * Dual-map helpers: Prisma enum codes ↔ Configuration Registry ReferenceEntry codes.
 * Survey fields still store enum strings in Wave 1–3; Wave 4+ can resolve entry IDs.
 */
export const ENUM_TO_CATEGORY: Record<string, string> = {
  AssessmentYear: "ASSESSMENT_YEAR",
  OwnershipType: "OWNERSHIP_TYPE",
  PropertyUse: "PROPERTY_USE",
  PropertyType: "PROPERTY_TYPE",
  RoadType: "ROAD_TYPE",
  TaxRateZone: "TAX_RATE_ZONE",
  ConstructionType: "CONSTRUCTION_TYPE",
  Situation: "SITUATION",
  UsageFactor: "USAGE_FACTOR",
  UsageType: "USAGE_TYPE",
}

export function enumCodeToCatalogCode(enumName: string, code: string): { categoryCode: string; entryCode: string } {
  const categoryCode = ENUM_TO_CATEGORY[enumName]
  if (!categoryCode) {
    throw new Error(`Unknown enum catalog mapping: ${enumName}`)
  }
  return { categoryCode, entryCode: code }
}
