/** Display parcel numbers with leading zeros (5 digits). Does not mutate stored value. */
export function formatParcelDisplay(parcelNumber: string | null | undefined): string {
  if (!parcelNumber?.trim()) return "—"
  const digits = parcelNumber.replace(/\D/g, "")
  if (!digits) return parcelNumber.trim()
  return digits.padStart(5, "0")
}
