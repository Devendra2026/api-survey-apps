/**
 * Pure tax helpers shared by demand notices and QC Excel export.
 * TaxConfig annual rates — no ×12.
 */

export function roundMoney(amount: number): number {
  return Math.round(amount * 100) / 100
}

/** Residential ×1; commercial/shop doubles the panel rate (×2). */
export function resolveUsageRateMult(
  usageFactor: string | null | undefined,
  usageType: string | null | undefined,
  propertyUse?: string | null
): number {
  const key = `${usageFactor ?? ""} ${usageType ?? ""} ${propertyUse ?? ""}`.toLowerCase()
  if (key.includes("commercial") || key.includes("shop") || key.includes("godown")) return 2
  return 1
}

export function computeFloorAlv(
  areaSqFt: number,
  annualRatePerSqFt: number,
  usageMult: number,
  assessablePct: number,
  propertyTaxPct: number
): { grossAlv: number; assessableAlv: number; propertyTax: number } {
  const grossAlv = roundMoney(areaSqFt * annualRatePerSqFt * usageMult)
  const assessableAlv = roundMoney(grossAlv * (assessablePct / 100))
  const propertyTax = roundMoney(assessableAlv * (propertyTaxPct / 100))
  return { grossAlv, assessableAlv, propertyTax }
}

export function computeDemandTotals(
  totalAssessableAlv: number,
  propertyTax: number,
  waterTaxPct: number,
  drainageTaxPct: number,
  penaltyPct: number,
  includeWater: boolean,
  includeDrainage: boolean
): {
  waterTax: number
  drainageTax: number
  penalty: number
  totalAnnualDemand: number
} {
  const waterTax = includeWater ? roundMoney(totalAssessableAlv * (waterTaxPct / 100)) : 0
  const drainageTax = includeDrainage ? roundMoney(totalAssessableAlv * (drainageTaxPct / 100)) : 0
  const penalty = penaltyPct > 0 ? roundMoney(propertyTax * (penaltyPct / 100)) : 0
  const totalAnnualDemand = roundMoney(propertyTax + waterTax + drainageTax + penalty)
  return { waterTax, drainageTax, penalty, totalAnnualDemand }
}

export function formatAssessmentYearLabel(code: string): string {
  const match = /^AY_(\d{4})_(\d{4})$/.exec(code)
  if (match) return `${match[1]}-${match[2]}`
  return code.replaceAll("_", " ")
}

export function formatNoticeDate(date: Date = new Date()): string {
  return date.toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })
}

export function formatAmountPlain(amount: number): string {
  return amount.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export function humanizeEnum(value: string | null | undefined): string {
  if (!value) return "—"
  return value
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

export function toTaxNumber(value: { toString(): string } | number | string | null | undefined): number {
  if (value == null) return 0
  if (typeof value === "number") return Number.isFinite(value) ? value : 0
  const parsed = Number(value.toString())
  return Number.isFinite(parsed) ? parsed : 0
}

export type ExportTaxFloorInput = {
  floorPosition: string
  constructionType?: string | null
  usageFactor?: string | null
  usageType?: string | null
  areaSqFt?: number | { toString(): string } | null
}

export type ExportTaxRateTable = {
  assessablePct: number
  propertyTaxPct: number
  waterTaxPct: number
  drainageTaxPct: number
  penaltyPct: number
  /** Map key: `${zoneCode}::${constructionCode}` → annual rate per sqft */
  rateByZoneAndConstruction: Map<string, number>
  /** First rate for zone when floors lack construction (fallback). */
  anyRateByZone: Map<string, number>
}

export type ExportTaxSummary = {
  propertyTax: number
  waterTax: number
  drainageTax: number
  penalty: number
  totalDemand: number
}

export function taxRateKey(zoneCode: string, constructionCode: string): string {
  return `${zoneCode}::${constructionCode}`
}

/**
 * Compute QC export tax summary from a preloaded rate table.
 * Throws if zone/rates cannot produce a valid assessment.
 */
export function computeExportTaxSummary(input: {
  taxRateZone?: string | null
  propertyUse?: string | null
  waterConnection?: string | null
  totalBuiltAreaSqFt?: number | { toString(): string } | null
  plinthAreaSqFt?: number | { toString(): string } | null
  floors: ExportTaxFloorInput[]
  rates: ExportTaxRateTable
}): ExportTaxSummary {
  const zoneCode = (input.taxRateZone ?? "").trim()
  if (!zoneCode) {
    throw new Error("Survey tax rate zone is missing")
  }

  const { assessablePct, propertyTaxPct, waterTaxPct, drainageTaxPct, penaltyPct } = input.rates
  let propertyTax = 0
  let totalAssessableAlv = 0
  let floorCount = 0

  for (const floor of input.floors) {
    const constructionCode = (floor.constructionType ?? "").trim()
    if (!constructionCode) {
      throw new Error(`Floor ${floor.floorPosition} missing construction type`)
    }
    const annualRate = input.rates.rateByZoneAndConstruction.get(taxRateKey(zoneCode, constructionCode)) ?? 0
    if (annualRate <= 0) {
      throw new Error(`Rate cell missing for zone ${zoneCode} × ${constructionCode}`)
    }
    const areaSqFt = toTaxNumber(floor.areaSqFt)
    const usageMult = resolveUsageRateMult(floor.usageFactor, floor.usageType, input.propertyUse)
    const { assessableAlv, propertyTax: floorTax } = computeFloorAlv(
      areaSqFt,
      annualRate,
      usageMult,
      assessablePct,
      propertyTaxPct
    )
    propertyTax = roundMoney(propertyTax + floorTax)
    totalAssessableAlv = roundMoney(totalAssessableAlv + assessableAlv)
    floorCount += 1
  }

  if (floorCount === 0) {
    const annualRate = input.rates.anyRateByZone.get(zoneCode) ?? 0
    if (annualRate <= 0) {
      throw new Error("No floors and no usable rate cell")
    }
    const areaSqFt = toTaxNumber(input.totalBuiltAreaSqFt) || toTaxNumber(input.plinthAreaSqFt)
    const usageMult = resolveUsageRateMult(null, null, input.propertyUse)
    const { assessableAlv, propertyTax: floorTax } = computeFloorAlv(
      areaSqFt,
      annualRate,
      usageMult,
      assessablePct,
      propertyTaxPct
    )
    propertyTax = floorTax
    totalAssessableAlv = assessableAlv
  }

  const openLand = String(input.propertyUse ?? "").includes("OPEN_LAND")
  const includeWater = !openLand && input.waterConnection !== "NO"
  const { waterTax, drainageTax, penalty, totalAnnualDemand } = computeDemandTotals(
    totalAssessableAlv,
    propertyTax,
    waterTaxPct,
    drainageTaxPct,
    penaltyPct,
    includeWater,
    !openLand
  )

  const totalDemand = totalAnnualDemand
  const sumParts = roundMoney(propertyTax + waterTax + drainageTax + penalty)
  if (sumParts !== totalDemand) {
    throw new Error(`Total Demand mismatch: ${totalDemand} !== ${sumParts}`)
  }

  return { propertyTax, waterTax, drainageTax, penalty, totalDemand }
}
