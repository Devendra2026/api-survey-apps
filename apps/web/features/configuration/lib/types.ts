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
  rates: Record<string, number>
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

export const CONFIG_NAV = [
  { href: "/configuration", label: "Overview", match: (p: string) => p === "/configuration" },
  {
    href: "/configuration/reference",
    label: "Reference Data",
    match: (p: string) => p.startsWith("/configuration/reference"),
  },
  {
    href: "/configuration/geography",
    label: "Geographic Hierarchy",
    match: (p: string) => p.startsWith("/configuration/geography") || p.startsWith("/master-data"),
  },
  {
    href: "/configuration/tax-engine",
    label: "Tax Engine",
    match: (p: string) => p.startsWith("/configuration/tax-engine"),
  },
  {
    href: "/configuration/demand-rules",
    label: "Demand Rules",
    match: (p: string) => p.startsWith("/configuration/demand-rules"),
  },
  {
    href: "/configuration/settings",
    label: "Settings",
    match: (p: string) => p.startsWith("/configuration/settings"),
  },
] as const
