import { padParcelNo } from "@workspace/validation"

/** Display parcel numbers with leading zeros (5 digits). Does not mutate stored value. */
export function formatParcelDisplay(parcelNumber: string | null | undefined): string {
  if (!parcelNumber?.trim()) return "—"
  const padded = padParcelNo(parcelNumber)
  return padded || parcelNumber.trim()
}
