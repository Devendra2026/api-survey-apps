/**
 * Canonical ward number for Nest ↔ Convex alignment.
 * Numeric wards strip leading zeros (`"01"` → `"1"`).
 * Code-like forms (`"W02"`, `"AGR-W02"`) collapse to the same digit key as `"2"` / `"02"`.
 * Other alphanumeric codes (`"14A"`) are kept trimmed.
 */
export function normalizeWardNumber(wardNo: string): string {
  const trimmed = wardNo.trim()
  if (!trimmed) return trimmed

  const wOnly = trimmed.match(/^W(\d+)$/i)
  if (wOnly?.[1]) {
    return String(Number.parseInt(wOnly[1], 10))
  }

  const codeSuffix = trimmed.match(/-W(\d+)$/i)
  if (codeSuffix?.[1]) {
    return String(Number.parseInt(codeSuffix[1], 10))
  }

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
