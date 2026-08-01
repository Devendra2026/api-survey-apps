/**
 * Field-role allotment validation for SURVEYOR / FIELD_SUPERVISOR / QC_SUPERVISOR.
 * All Wards is represented as wardId: null (ULB-scoped row).
 */

export type FieldAllotmentGeo = {
  stateId: string
  districtId: string
  ulbId: string
  wardId: string | null
}

export class FieldAllotmentValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "FieldAllotmentValidationError"
  }
}

function fieldRoleLabel(roleName: string): string {
  if (roleName === "FIELD_SUPERVISOR") return "Supervisor"
  if (roleName === "QC_SUPERVISOR") return "QC Supervisor"
  return "Surveyor"
}

/** Normalize empty ward strings to null (All Wards). */
export function normalizeAllotmentWardId(wardId: string | null | undefined): string | null {
  if (wardId == null || wardId === "") return null
  return wardId
}

/**
 * Validates field-role allotment shape before persistence.
 * Throws FieldAllotmentValidationError with a user-facing message.
 */
export function validateFieldAllotments(roleName: string, allotments: FieldAllotmentGeo[]): void {
  const label = fieldRoleLabel(roleName)

  if (!allotments.length) {
    throw new FieldAllotmentValidationError(
      `${label} assignments require at least one State, District, and ULB allotment`
    )
  }

  for (const geo of allotments) {
    if (!geo.stateId || !geo.districtId || !geo.ulbId) {
      throw new FieldAllotmentValidationError(
        `${label} assignments require State, District, and ULB on every allotment`
      )
    }
  }

  const wardIds = allotments.map((a) => a.wardId).filter((id): id is string => Boolean(id))
  if (new Set(wardIds).size !== wardIds.length) {
    throw new FieldAllotmentValidationError("Duplicate ward allotments are not allowed")
  }

  // Per ULB: either specific ward rows OR a single All Wards row — not both.
  const byUlb = new Map<string, FieldAllotmentGeo[]>()
  for (const geo of allotments) {
    const list = byUlb.get(geo.ulbId) ?? []
    list.push(geo)
    byUlb.set(geo.ulbId, list)
  }

  for (const [ulbId, rows] of byUlb) {
    const allWardsRows = rows.filter((r) => r.wardId == null)
    const specificRows = rows.filter((r) => r.wardId != null)
    if (allWardsRows.length > 1) {
      throw new FieldAllotmentValidationError(`At most one All Wards allotment is allowed per ULB (${ulbId})`)
    }
    if (allWardsRows.length > 0 && specificRows.length > 0) {
      throw new FieldAllotmentValidationError("Cannot mix specific ward allotments with All Wards for the same ULB")
    }
  }

  if (roleName === "QC_SUPERVISOR") {
    if (byUlb.size !== 1) {
      throw new FieldAllotmentValidationError("QC Supervisor must be assigned to exactly one Location (ULB)")
    }
    const rows = [...byUlb.values()][0]!
    const allWards = rows.length === 1 && rows[0]!.wardId == null
    const singleWard = rows.length === 1 && rows[0]!.wardId != null
    if (!allWards && !singleWard) {
      throw new FieldAllotmentValidationError(
        "QC Supervisor must use Single Ward (one ward) or All Wards for the assigned Location"
      )
    }
  }
}
