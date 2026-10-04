/** Six-digit postal PIN, the same shape as POST /ulbs/:id/pin-codes. */
const PIN_CODE_PATTERN = /^\d{6}$/

export const PIN_DUPLICATE_MESSAGE = "This PIN is already registered for the ULB"
export const PIN_NETWORK_FAILURE_MESSAGE = "The code could not be saved. Try again."
export const PIN_EMPTY_MESSAGE =
  "No PIN codes are registered yet. Surveyors will have an empty PIN menu for this ULB until one is added."
export const ULB_NOT_FOUND_MESSAGE = "ULB was not found"

/**
 * Client gate before POST. Null means the trimmed value is safe to send.
 */
export function pinCodeInputError(raw: string): string | null {
  if (PIN_CODE_PATTERN.test(raw.trim())) return null
  return "PIN must be 6 digits"
}
