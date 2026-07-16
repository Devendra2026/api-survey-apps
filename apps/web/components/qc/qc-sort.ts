/** Deterministic ascending sort: parse leading integer; null/undefined/non-numeric go last. */
export function sortByLeadingNumberAsc<T>(items: T[], getKey: (item: T) => string | number | null | undefined): T[] {
  return [...items].sort((a, b) => {
    const ka = parseLeadingNumber(getKey(a))
    const kb = parseLeadingNumber(getKey(b))
    if (ka == null && kb == null) return 0
    if (ka == null) return 1
    if (kb == null) return -1
    return ka - kb
  })
}

function parseLeadingNumber(value: string | number | null | undefined): number | null {
  if (value == null || value === "") return null
  if (typeof value === "number") return Number.isFinite(value) ? value : null
  const match = String(value)
    .trim()
    .match(/^(\d+)/)
  if (!match) return null
  const n = Number(match[1])
  return Number.isNaN(n) ? null : n
}
