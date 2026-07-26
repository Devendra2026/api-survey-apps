/** Pure demand-notice tax helpers (TaxConfig annual rates — no ×12). */

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
