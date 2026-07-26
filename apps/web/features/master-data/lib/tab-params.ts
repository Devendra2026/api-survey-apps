export type MasterDataTab = "reference" | "tenants" | "tax-rates"

export const MASTER_DATA_TABS: readonly MasterDataTab[] = ["reference", "tenants", "tax-rates"] as const

export function parseMasterDataTab(value: string | null | undefined): MasterDataTab {
  if (value === "tenants" || value === "tax-rates" || value === "reference") return value
  return "reference"
}

export function masterDataHref(tab: MasterDataTab, extras?: { category?: string }): string {
  const params = new URLSearchParams()
  params.set("tab", tab)
  if (extras?.category) params.set("category", extras.category)
  return `/master-data?${params.toString()}`
}
