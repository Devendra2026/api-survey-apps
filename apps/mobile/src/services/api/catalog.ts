import { apiGet, isApiClientError } from "./client"

export type CatalogOption = {
  value: string
  label: string
}

type CatalogEntry = {
  code: string
  name: string
  status?: string
}

type CatalogPage = {
  items: CatalogEntry[]
}

/** Active reference-catalog rows. Survey fields store `code` (the Prisma enum), not the display name. */
export async function listActiveCatalogOptions(categoryCode: string): Promise<CatalogOption[]> {
  const page = await apiGet<CatalogPage>(
    `/configuration/categories/${encodeURIComponent(categoryCode)}/entries?status=ACTIVE&limit=200&page=1`
  )
  return page.items
    .filter((entry) => entry.status === undefined || entry.status === "ACTIVE")
    .map((entry) => ({ value: entry.code, label: entry.name }))
}

export function catalogLoadMessage(error: unknown): string {
  if (!isApiClientError(error)) return "Unable to load options."
  if (error.statusCode === 403) return "You do not have permission to access these options."
  if (error.kind === "network" || error.kind === "timeout") return "Unable to load options."
  if (error.statusCode >= 500) return "Unable to load data. Try again."
  return error.message || "Unable to load options."
}
