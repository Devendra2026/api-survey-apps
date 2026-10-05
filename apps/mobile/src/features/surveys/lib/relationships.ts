/** Respondent relationship with the owner. Stored as the selected label. */
export const RELATIONSHIP_WITH_OWNER_OPTIONS = [
  "Self",
  "Husband",
  "Wife",
  "Father",
  "Mother",
  "Son",
  "Daughter",
  "Brother",
  "Sister",
  "Grandfather",
  "Grandmother",
  "Tenant",
  "Caretaker",
  "Other",
] as const

/** Full relationship list, keeping a previously saved value that is not in the list. */
export function relationshipOptions(current: string | null): { value: string; label: string }[] {
  const options = RELATIONSHIP_WITH_OWNER_OPTIONS.map((option) => ({ value: option, label: option }))
  const trimmed = current?.trim() ?? ""
  if (trimmed !== "" && !options.some((option) => option.value === trimmed)) {
    return [{ value: trimmed, label: trimmed }, ...options]
  }
  return [...options]
}
