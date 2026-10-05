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
  kind?: string
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

export const CONFIG_BASE = "/configuration"

export type ConfigNavGroupId = "geo" | "reference" | "tax" | "system"

export type ConfigNavItem = {
  href: string
  label: string
  /** lucide icon name key resolved in SideNav */
  icon?: "map" | "layers" | "calculator" | "fileText" | "layout" | "settings"
  match: (pathname: string) => boolean
}

export type ConfigNavGroup = {
  id: ConfigNavGroupId
  label: string
  items: ConfigNavItem[]
}

export const CONFIG_NAV_GROUPS: ConfigNavGroup[] = [
  {
    id: "geo",
    label: "Geographic Hierarchy",
    items: [
      {
        href: `${CONFIG_BASE}/geography`,
        label: "Tenants & Wards",
        icon: "map",
        match: (pathname) => pathname.startsWith(`${CONFIG_BASE}/geography`),
      },
    ],
  },
  {
    id: "reference",
    label: "Reference Data",
    items: [],
  },
  {
    id: "tax",
    label: "Tax & Rules",
    items: [
      {
        href: `${CONFIG_BASE}/tax-engine`,
        label: "Tax Engine",
        icon: "calculator",
        match: (pathname) => pathname.startsWith(`${CONFIG_BASE}/tax-engine`),
      },
      {
        href: `${CONFIG_BASE}/demand-rules`,
        label: "Demand Rules",
        icon: "fileText",
        match: (pathname) => pathname.startsWith(`${CONFIG_BASE}/demand-rules`),
      },
    ],
  },
  {
    id: "system",
    label: "System",
    items: [
      {
        href: CONFIG_BASE,
        label: "Overview",
        icon: "layout",
        match: (pathname) => pathname === CONFIG_BASE,
      },
      {
        href: `${CONFIG_BASE}/settings`,
        label: "Settings",
        icon: "settings",
        match: (pathname) => pathname.startsWith(`${CONFIG_BASE}/settings`),
      },
    ],
  },
]

/** Flat list for leftover consumers of the old horizontal tabs. */
export const CONFIG_NAV = CONFIG_NAV_GROUPS.flatMap((group) => group.items)
