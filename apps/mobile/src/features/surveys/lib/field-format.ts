/**
 * Lightweight field validators for mobile survey UX.
 * Do not invent business rules beyond format checks already implied by existing maxLength / keyboards.
 */

export const MIN_CONSTRUCTED_YEAR = 1800

export function constructedYearError(value: number | null): string | undefined {
  if (value === null) return undefined
  const maxYear = new Date().getFullYear()
  if (!Number.isInteger(value) || value < MIN_CONSTRUCTED_YEAR || value > maxYear) {
    return `Year must be from ${MIN_CONSTRUCTED_YEAR} to ${maxYear}.`
  }
  return undefined
}

export function parseConstructedYear(value: string): { year: number | null; error?: string; pending?: boolean } {
  const trimmed = value.trim()
  if (trimmed === "") return { year: null }
  if (!/^\d+$/.test(trimmed)) return { year: null, error: "Enter a 4-digit year." }
  if (trimmed.length < 4) return { year: null, pending: true }
  const year = Number(trimmed)
  const error = constructedYearError(year)
  if (error) return { year: null, error }
  return { year }
}

export const PARCEL_NUMBER_ERROR = "Parcel number must be 1 to 5 digits."
export const UNIT_NUMBER_ERROR = "Unit number must be 1 to 3 digits."
export const PARCEL_NUMBER_TOO_LONG = "Parcel number cannot be more than 5 digits."
export const UNIT_NUMBER_TOO_LONG = "Unit number cannot be more than 3 digits."

/** Keeps only digits. Does not truncate; callers validate length. */
export function digitsOnly(value: string): string {
  return value.replace(/\D/g, "")
}

export function parcelNumberError(value: string | null): string | undefined {
  if (value === null || value.trim() === "") return PARCEL_NUMBER_ERROR
  if (!/^\d+$/.test(value)) return PARCEL_NUMBER_ERROR
  if (value.length > 5) return PARCEL_NUMBER_TOO_LONG
  return undefined
}

export function unitNumberError(value: string | null): string | undefined {
  if (value === null || value.trim() === "") return UNIT_NUMBER_ERROR
  if (!/^\d+$/.test(value)) return UNIT_NUMBER_ERROR
  if (value.length > 3) return UNIT_NUMBER_TOO_LONG
  return undefined
}

export function pinCodeError(value: string | null): string | undefined {
  if (value === null || value.trim() === "") return undefined
  const trimmed = value.trim()
  if (!/^\d{6}$/.test(trimmed)) return "PIN must be 6 digits"
  return undefined
}

/** Accepts 10-digit Indian mobiles or longer international strings up to 15 digits. */
export function phoneError(value: string | null): string | undefined {
  if (value === null || value.trim() === "") return undefined
  const digits = value.replace(/\D/g, "")
  if (digits.length < 10 || digits.length > 15) return "Enter a valid mobile number"
  return undefined
}
