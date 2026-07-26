/** Display-only helpers for Geographic Hierarchy / Master Data. */

export function formatWardPillLabel(wardNumber: string, wardName: string): string {
  const digits = wardNumber.replace(/\D/g, "")
  const padded = (digits || "0").padStart(2, "0").slice(-2)
  const name = wardName.trim()
  return name ? `W${padded}-${name}` : `W${padded}`
}

export function ulbTypeBadge(ulbType: string | undefined): string {
  if (ulbType === "TOWN_PANCHAYAT") return "TP"
  return "MC"
}
