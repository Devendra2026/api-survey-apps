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

/**
 * Numeric ascending compare for ward numbers (`"2"` before `"10"`, `"W02"` ≡ `"2"`).
 * Non-numeric / empty values sort after numbered wards, then by normalized string.
 */
export function compareWardNumbersAsc(a: string, b: string): number {
  const na = normalizeWardNumber(a)
  const nb = normalizeWardNumber(b)
  const ia = /^\d+$/.test(na) ? Number.parseInt(na, 10) : null
  const ib = /^\d+$/.test(nb) ? Number.parseInt(nb, 10) : null
  if (ia != null && ib != null && ia !== ib) return ia - ib
  if (ia != null && ib == null) return -1
  if (ia == null && ib != null) return 1
  return na.localeCompare(nb, undefined, { numeric: true, sensitivity: "base" })
}

/** Stable numeric ascending sort of ward-like rows. */
export function sortWardsByNumberAsc<T extends { wardNumber: string }>(wards: T[]): T[] {
  return [...wards].sort((left, right) => compareWardNumbersAsc(left.wardNumber, right.wardNumber))
}
