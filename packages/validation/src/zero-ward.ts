import { wardNumbersMatch } from "./ward-normalize.js"

export const ZERO_WARD_NUMBER = "0"
export const ZERO_WARD_NAME = "Zero Ward"
export const ZERO_WARD_OPTION_LABEL = "Zero Ward — Duplicate / Reconciliation"

/** True when a ward name is the existing quarantine label, not a geographic name. */
export function isZeroWardName(wardName: string | null | undefined): boolean {
  const normalized = (wardName ?? "").trim().toLowerCase().replace(/\s+/g, " ")
  return normalized === "zero ward"
}

export function isZeroWardKind(kind: string | null | undefined): boolean {
  return kind === "ZERO"
}

/**
 * The ULB quarantine ward.
 * Matches kind ZERO, or the exact name "Zero Ward".
 * A similarly named geographic ward (for example "Zero Ward East") is not included.
 */
export function isSystemZeroWard(ward: { kind?: string | null; wardName?: string | null }): boolean {
  return isZeroWardKind(ward.kind) || isZeroWardName(ward.wardName)
}

/**
 * Ward number that belongs in Property ID / property identification.
 * Zero Ward's own number is never a geographic identity.
 */
export function resolvePropertyWardNumber(input: {
  currentWard?: { kind?: string | null; wardNumber?: string | null } | null
  originalWard?: { wardNumber?: string | null } | null
  storedWardNumber?: string | null
}): string {
  const currentNo = (input.currentWard?.wardNumber ?? "").trim()
  if (!isZeroWardKind(input.currentWard?.kind)) {
    return currentNo || (input.storedWardNumber ?? "").trim()
  }

  const originalNo = (input.originalWard?.wardNumber ?? "").trim()
  if (originalNo && !wardNumbersMatch(originalNo, currentNo)) return originalNo

  const stored = (input.storedWardNumber ?? "").trim()
  if (stored && !wardNumbersMatch(stored, currentNo)) return stored

  return ""
}
