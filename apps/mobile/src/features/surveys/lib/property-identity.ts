import { formatPropertyId, padParcelNo, padUlbCode, padUnitNo, padWardNo, resolvePropertyWardNumber } from "@workspace/validation"

type PropertyIdParts = {
  ulbCode: string | null | undefined
  /** Treated as the current ward number when `currentWard` is omitted (keeps existing call sites). */
  wardNo?: string | null | undefined
  currentWard?: { kind?: string | null; wardNumber?: string | null } | null
  originalWard?: { wardNumber?: string | null } | null
  storedWardNumber?: string | null
  parcelNo: string | null | undefined
  unitNo: string | null | undefined
}

function resolveIdentityParts(input: PropertyIdParts): {
  ulbCode: string
  wardNo: string
  parcelNo: string
  unitNo: string
} | null {
  const ulbCode = (input.ulbCode ?? "").trim()
  const wardNo = resolvePropertyWardNumber({
    currentWard: input.currentWard ?? (input.wardNo != null ? { wardNumber: input.wardNo } : null),
    originalWard: input.originalWard,
    storedWardNumber: input.storedWardNumber,
  })
  const parcelNo = (input.parcelNo ?? "").trim()
  const unitNo = (input.unitNo ?? "").trim()
  if (!/^\d{1,5}$/.test(parcelNo) || !/^\d{1,3}$/.test(unitNo)) return null
  if (!ulbCode || !wardNo) return null
  return { ulbCode, wardNo, parcelNo, unitNo }
}

/**
 * Padded base `{ULB}-{Ward}-{Parcel}-{Unit}` before property use is chosen.
 * Example: `801262-001-00747-001`. Returns null when any part is missing or too long.
 */
export function previewPropertyIdBase(input: PropertyIdParts): string | null {
  const parts = resolveIdentityParts(input)
  if (!parts) return null
  const ulbCode = padUlbCode(parts.ulbCode)
  const wardNo = padWardNo(parts.wardNo)
  const parcelNo = padParcelNo(parts.parcelNo)
  const unitNo = padUnitNo(parts.unitNo)
  if (!ulbCode || !wardNo || !parcelNo || !unitNo) return null
  return `${ulbCode}-${wardNo}-${parcelNo}-${unitNo}`
}

/**
 * Display-only Property ID preview. Nest `update` persists the same `formatPropertyId` result.
 * The use letter comes only from PROPERTY_USE_CODES. Parcel (1–5 digits) and unit (1–3 digits)
 * are padded to 5 and 3. Longer values are rejected, not truncated.
 */
export function previewPropertyId(input: PropertyIdParts & { propertyUse: string | null | undefined }): string | null {
  const parts = resolveIdentityParts(input)
  const propertyUse = (input.propertyUse ?? "").trim()
  if (!parts || !propertyUse) return null
  return formatPropertyId({ ...parts, propertyUse }) ?? null
}

/**
 * Full formula ID when property use is mapped, otherwise the padded base without the use letter.
 */
export function propertyIdPreview(input: PropertyIdParts & { propertyUse: string | null | undefined }): {
  value: string | null
  isComplete: boolean
} {
  const full = previewPropertyId(input)
  if (full) return { value: full, isComplete: true }
  return { value: previewPropertyIdBase(input), isComplete: false }
}
