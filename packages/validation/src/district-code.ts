/** District codes are exactly 3 uppercase A–Z letters, unique per state. */
export const DISTRICT_CODE_REGEX = /^[A-Z]{3}$/

export function normalizeDistrictCode(raw: string): string {
  return raw.trim().toUpperCase()
}

export function isValidDistrictCode(code: string): boolean {
  return DISTRICT_CODE_REGEX.test(code)
}

/** Derive a 3-letter placeholder from a district name (letters only, pad with X). */
export function deriveDistrictCodeFromName(name: string): string {
  const letters = name.replace(/[^A-Za-z]/g, "").toUpperCase()
  return (letters + "XXX").slice(0, 3)
}

/**
 * Allocate a unique 3-letter code within a state.
 * Mutates `usedInState` to include the returned code.
 */
export function allocateUniqueDistrictCode(preferredOrName: string, usedInState: Set<string>): string {
  let candidate = normalizeDistrictCode(preferredOrName)
  if (!isValidDistrictCode(candidate)) {
    candidate = deriveDistrictCodeFromName(preferredOrName)
  }

  if (!usedInState.has(candidate)) {
    usedInState.add(candidate)
    return candidate
  }

  const first = candidate[0] ?? "X"
  for (let i = 0; i < 26 * 26; i++) {
    const next = first + String.fromCharCode(65 + Math.floor(i / 26)) + String.fromCharCode(65 + (i % 26))
    if (!usedInState.has(next)) {
      usedInState.add(next)
      return next
    }
  }

  throw new Error("Unable to allocate unique district code within state")
}
