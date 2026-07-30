/**
 * Resolve the display name for the property's primary owner.
 * Callers must load coOwners ordered by `ownerIndex` asc — see `surveyInclude`.
 */
export function resolvePrimaryOwnerName(
  coOwners: ReadonlyArray<{ name: string | null }> | null | undefined,
  respondentName?: string | null
): string | null {
  return coOwners?.[0]?.name?.trim() || respondentName?.trim() || null
}
