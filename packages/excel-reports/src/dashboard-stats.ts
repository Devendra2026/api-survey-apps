import type { SurveyExportBundle } from "./types.js"
import { number } from "./convex-full.js"

export type DashboardStats = {
  totalSurveys: number
  residential: number
  commercial: number
  mixed: number
  vacant: number
  government: number
  totalPlotArea: number
  totalBuiltUpArea: number
}

export function createEmptyDashboardStats(): DashboardStats {
  return {
    totalSurveys: 0,
    residential: 0,
    commercial: 0,
    mixed: 0,
    vacant: 0,
    government: 0,
    totalPlotArea: 0,
    totalBuiltUpArea: 0,
  }
}

function bucketPropertyUse(
  propertyUse: string | null | undefined
): keyof Pick<DashboardStats, "residential" | "commercial" | "mixed" | "vacant" | "government"> | null {
  const key = (propertyUse ?? "").toUpperCase()
  if (key.includes("RESIDENT")) return "residential"
  if (key.includes("COMMERCIAL") || key.includes("GODOWN") || key.includes("SHOP")) return "commercial"
  if (key.includes("MIX")) return "mixed"
  if (key.includes("OPEN_LAND") || key.includes("VACANT") || key.includes("AGRICULT")) return "vacant"
  if (key.includes("GOVERN") || key.includes("RELIGIOUS") || key.includes("PUBLIC")) return "government"
  return null
}

export function accumulateDashboardStats(stats: DashboardStats, row: SurveyExportBundle): void {
  stats.totalSurveys += 1
  const bucket = bucketPropertyUse(row.propertyUse)
  if (bucket) stats[bucket] += 1
  const plot = number(row.plotAreaSqFt)
  const built = number(row.totalBuiltAreaSqFt)
  if (typeof plot === "number") stats.totalPlotArea += plot
  if (typeof built === "number") stats.totalBuiltUpArea += built
}
