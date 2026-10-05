export type PinCodeOption = {
  value: string
  label: string
}

/**
 * Dropdown options for a ULB PIN catalog. A saved code that is no longer
 * registered stays at the top so the field does not look empty.
 */
export function pinCodeOptions(codes: readonly string[], current: string | null): PinCodeOption[] {
  const seen = new Set<string>()
  const options: PinCodeOption[] = []
  for (const code of codes) {
    const trimmed = code.trim()
    if (trimmed === "" || seen.has(trimmed)) continue
    seen.add(trimmed)
    options.push({ value: trimmed, label: trimmed })
  }
  const saved = current?.trim() ?? ""
  if (saved !== "" && !seen.has(saved)) {
    options.unshift({ value: saved, label: saved })
  }
  return options
}
