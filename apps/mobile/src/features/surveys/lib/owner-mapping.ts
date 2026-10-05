import type { SurveyPatch } from "../types.ts"

export type OwnerSortable = {
  id: string
  createdAt?: string
}

export type OwnerContactInput = {
  isPrimary: boolean
  mobile: string | null
  alternateMobile: string | null
}

/** Earliest co-owner row is Owner 1. `ownerIndex` is not writable on the API. */
export function sortOwners<T extends OwnerSortable>(owners: readonly T[]): T[] {
  return [...owners].sort((left, right) => {
    const leftAt = left.createdAt ?? ""
    const rightAt = right.createdAt ?? ""
    if (leftAt !== rightAt) return leftAt < rightAt ? -1 : 1
    return left.id < right.id ? -1 : 1
  })
}

export function primaryOwnerId(owners: readonly OwnerSortable[]): string | null {
  return sortOwners(owners)[0]?.id ?? null
}

/**
 * Keeps a co-owner that was just created locally when a survey save returns an older owner list.
 * Owners present on the incoming record stay in that order.
 */
export function mergeCoOwners<T extends { id: string }>(
  previous: readonly T[] | undefined,
  incoming: readonly T[] | undefined
): T[] {
  const next = incoming ?? []
  const incomingIds = new Set(next.map((owner) => owner.id))
  const localOnly = (previous ?? []).filter((owner) => !incomingIds.has(owner.id))
  if (localOnly.length === 0) return next
  return [...next, ...localOnly]
}

/** Respondent edits never include owner or household columns. */
export function respondentFieldsPatch(input: {
  respondentName: string | null
  relationshipWithOwner: string | null
}): Pick<SurveyPatch, "respondentName" | "relationshipWithOwner"> {
  return {
    respondentName: input.respondentName,
    relationshipWithOwner: input.relationshipWithOwner,
  }
}

/**
 * Owner 1 phones are the survey contact columns used by QC and export.
 * Later owners do not replace them.
 */
export function ownerContactPatch(
  input: OwnerContactInput
): Pick<SurveyPatch, "mobileNumber" | "alternateMobile"> | null {
  if (!input.isPrimary) return null
  return {
    mobileNumber: input.mobile,
    alternateMobile: input.alternateMobile,
  }
}
