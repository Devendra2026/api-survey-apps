export type ReferenceEntryStatus = "ACTIVE" | "DISABLED" | "ARCHIVED"
export type TaxConfigStatus = "DRAFT" | "PUBLISHED" | "ARCHIVED"
export type GeoEntityStatus = "ACTIVE" | "DISABLED" | "ARCHIVED"

export interface ReferenceCategory {
  id: string
  code: string
  name: string
  description: string | null
  iconKey: string | null
  isSystem: boolean
  updatedAt: string
  _count: { entries: number }
  entries: Array<{ updatedAt: string; updatedBy: string | null }>
}

export interface ReferenceEntry {
  id: string
  categoryId: string
  code: string
  name: string
  description: string | null
  value: string | null
  status: ReferenceEntryStatus
  version: number
  sortOrder: number
  createdBy: string | null
  updatedBy: string | null
  createdAt: string
  updatedAt: string
}

export interface ConfigAuditLog {
  id: string
  entityType: string
  entityId: string
  action: string
  oldValue: unknown
  newValue: unknown
  reason: string | null
  actorId: string | null
  createdAt: string
}

export interface GeographyTreeNode {
  id: string
  type: "state" | "district" | "ulb" | "ward"
  name: string
  code?: string
  wardNumber?: string
  ulbType?: string
  status: GeoEntityStatus
  parentId?: string
  counts: Record<string, number>
  children?: GeographyTreeNode[]
}

export interface TaxRateCell {
  id: string
  taxConfigId: string
  roadWidthEntryId: string
  constructionEntryId: string
  annualRatePerSqFt: string | number
  roadWidthEntry?: ReferenceEntry
  constructionEntry?: ReferenceEntry
}

export interface TaxConfig {
  id: string
  wardId: string
  assessmentYearId: string
  status: TaxConfigStatus
  version: number
  effectiveFrom: string | null
  propertyTaxPct: string | number
  waterTaxPct: string | number
  drainageTaxPct: string | number
  penaltyPct: string | number
  assessablePct: string | number
  publishedAt: string | null
  publishedBy: string | null
  changeReason: string | null
  updatedAt: string
  cells: TaxRateCell[]
  assessmentYear?: ReferenceEntry
  ward?: {
    id: string
    wardName: string
    wardNumber: string
    ulb?: {
      id: string
      name: string
      district?: {
        id: string
        name: string
        state?: { id: string; name: string }
      }
    }
  }
}

export interface TaxPreviewResult {
  calculation: {
    grossAlv: number
    assessableAlv: number
    propertyTax: number
    waterTax: number
    drainageTax: number
    penalty: number
    demand: number
  }
  rates: Record<string, number> & { annualRate?: number }
  formulas: string[]
}

export interface TaxConfigVersion {
  id: string
  taxConfigId: string
  version: number
  snapshot: unknown
  reason: string | null
  createdBy: string | null
  createdAt: string
}

export type ConfigNavMatch = (pathname: string, search?: string) => boolean

function masterTab(search: string | undefined, tab: string): boolean {
  const params = new URLSearchParams(search ?? "")
  const current = params.get("tab") ?? "reference"
  return current === tab
}

export const CONFIG_NAV: ReadonlyArray<{
  href: string
  label: string
  match: ConfigNavMatch
}> = [
  { href: "/configuration", label: "Overview", match: (p) => p === "/configuration" },
  {
    href: "/master-data?tab=reference",
    label: "Reference Data",
    match: (p, s) =>
      p.startsWith("/configuration/reference") || (p.startsWith("/master-data") && masterTab(s, "reference")),
  },
  {
    href: "/master-data?tab=tenants",
    label: "Geographic Hierarchy",
    match: (p, s) =>
      p.startsWith("/configuration/geography") || (p.startsWith("/master-data") && masterTab(s, "tenants")),
  },
  {
    href: "/master-data?tab=tax-rates",
    label: "Tax Engine",
    match: (p, s) =>
      p.startsWith("/configuration/tax-engine") || (p.startsWith("/master-data") && masterTab(s, "tax-rates")),
  },
  {
    href: "/configuration/demand-rules",
    label: "Demand Rules",
    match: (p) => p.startsWith("/configuration/demand-rules"),
  },
  {
    href: "/configuration/settings",
    label: "Settings",
    match: (p) => p.startsWith("/configuration/settings"),
  },
]
