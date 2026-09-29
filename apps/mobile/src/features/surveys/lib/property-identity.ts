import { formatPropertyId, resolvePropertyWardNumber } from "@workspace/validation"

/**
 * Display-only Property ID preview. Nest `update` persists the same `formatPropertyId` result.
 * The use letter comes only from PROPERTY_USE_CODES. Parcel (1–5 digits) and unit (1–3 digits)
 * are padded to 5 and 3. Longer values are rejected, not truncated.
 */
export function previewPropertyId(input: {
  ulbCode: string | null | undefined
  /** Treated as the current ward number when `currentWard` is omitted (keeps existing call sites). */
  wardNo?: string | null | undefined
  currentWard?: { kind?: string | null; wardNumber?: string | null } | null
  originalWard?: { wardNumber?: string | null } | null
  storedWardNumber?: string | null
  parcelNo: string | null | undefined
  unitNo: string | null | undefined
  propertyUse: string | null | undefined
}): string | null {
  const ulbCode = (input.ulbCode ?? "").trim()
  const wardNo = resolvePropertyWardNumber({
    currentWard: input.currentWard ?? (input.wardNo != null ? { wardNumber: input.wardNo } : null),
    originalWard: input.originalWard,
    storedWardNumber: input.storedWardNumber,
  })
  const parcelNo = (input.parcelNo ?? "").trim()
  const unitNo = (input.unitNo ?? "").trim()
  const propertyUse = (input.propertyUse ?? "").trim()
  if (!/^\d{1,5}$/.test(parcelNo) || !/^\d{1,3}$/.test(unitNo)) return null
  if (!ulbCode || !wardNo || !propertyUse) return null
  return formatPropertyId({ ulbCode, wardNo, parcelNo, unitNo, propertyUse }) ?? null
}
