/**
 * Canonical ward number for Nest ↔ Convex alignment.
 * Numeric wards strip leading zeros (`"01"` → `"1"`); alphanumeric kept trimmed (`"14A"`).
 */
export function normalizeWardNumber(wardNo: string): string {
  const trimmed = wardNo.trim()
  if (!trimmed) return trimmed
  if (/^\d+$/.test(trimmed)) {
    return String(Number.parseInt(trimmed, 10))
  }
  return trimmed
}

/** True when two ward number spellings refer to the same logical ward. */
export function wardNumbersMatch(a: string, b: string): boolean {
  const left = a.trim()
  const right = b.trim()
  if (left === right) return true
  return normalizeWardNumber(left) === normalizeWardNumber(right)
}
